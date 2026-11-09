import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { WorkoutSessionModel } from '../../infra/db/models/workout-session.js';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { AppError } from '../../lib/errors.js';
import { parseDateKey } from '../../lib/date.js';
import { EXERCISE_CATALOG } from './exercise-catalog.js';

const setSchema = z.object({
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0).default(0),
  reps: z.number().int().min(0).default(0),
  rpe: z.number().min(1).max(10).nullable().optional(),
  completed: z.boolean().default(true),
});

const exerciseSchema = z.object({
  name: z.string().min(1).max(120),
  muscleGroup: z.string().max(60).optional(),
  notes: z.string().max(300).optional(),
  sets: z.array(setSchema).default([]),
});

const sessionBody = z.object({
  date: z.string(),
  title: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  durationMin: z.number().min(0).optional(),
  caloriesBurned: z.number().min(0).optional(),
  exercises: z.array(exerciseSchema).default([]),
  finished: z.boolean().optional(),
});

function volumeKg(exercises: Array<{ sets: Array<{ weightKg: number; reps: number; completed?: boolean }> }>) {
  return exercises.reduce((sum, ex) => {
    return (
      sum +
      ex.sets.reduce((s, set) => {
        if (set.completed === false) return s;
        return s + set.weightKg * set.reps;
      }, 0)
    );
  }, 0);
}

function serialize(doc: InstanceType<typeof WorkoutSessionModel>) {
  const exercises = (doc.exercises ?? []).map((ex) => ({
    id: (ex as { _id?: { toString(): string } })._id?.toString() ?? '',
    name: ex.name,
    muscleGroup: ex.muscleGroup ?? '',
    notes: ex.notes ?? '',
    sets: (ex.sets ?? []).map((s) => ({
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      rpe: s.rpe,
      completed: s.completed !== false,
    })),
  }));
  return {
    id: doc._id.toString(),
    date: doc.date,
    title: doc.title,
    notes: doc.notes,
    durationMin: doc.durationMin,
    caloriesBurned: doc.caloriesBurned,
    exercises,
    totalVolumeKg: Math.round(volumeKg(exercises)),
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
  };
}

/** Rough kcal from volume + duration when client doesn't send burn. */
function estimateSessionCalories(
  durationMin: number,
  totalVolumeKg: number,
  weightKg: number,
): number {
  const metish = 6;
  const fromTime = (metish * 3.5 * weightKg * Math.max(durationMin, 1)) / 200;
  const fromVolume = totalVolumeKg * 0.05;
  return Math.round(Math.max(fromTime, fromVolume));
}

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/sessions', async (req) => {
    const q = z.object({ date: z.string().optional() }).parse(req.query);
    const filter: Record<string, unknown> = { userId: req.userId };
    if (q.date) filter.date = parseDateKey(q.date);
    const docs = await WorkoutSessionModel.find(filter).sort({ createdAt: -1 }).limit(40);
    return { data: docs.map(serialize) };
  });

  app.get('/sessions/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const doc = await WorkoutSessionModel.findOne({ _id: id, userId: req.userId });
    if (!doc) throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    return { data: serialize(doc) };
  });

  app.post('/sessions', async (req, reply) => {
    const body = sessionBody.parse(req.body);
    const date = parseDateKey(body.date);
    const profile = await ProfileModel.findOne({ userId: req.userId });
    const weightKg = profile?.weightKg ?? 70;
    const vol = volumeKg(body.exercises);
    const durationMin = body.durationMin ?? 0;
    const caloriesBurned =
      body.caloriesBurned ?? estimateSessionCalories(durationMin, vol, weightKg);

    const doc = await WorkoutSessionModel.create({
      userId: req.userId,
      date,
      title: body.title ?? 'Workout',
      notes: body.notes ?? '',
      durationMin,
      caloriesBurned,
      exercises: body.exercises,
      finishedAt: body.finished === false ? null : new Date(),
    });

    return reply.code(201).send({ data: serialize(doc) });
  });

  app.put('/sessions/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = sessionBody.partial().extend({ date: z.string().optional() }).parse(req.body);
    const existing = await WorkoutSessionModel.findOne({ _id: id, userId: req.userId });
    if (!existing) throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');

    const profile = await ProfileModel.findOne({ userId: req.userId });
    const weightKg = profile?.weightKg ?? 70;
    const exercises = body.exercises ?? existing.exercises;
    const vol = volumeKg(exercises as never);
    const durationMin = body.durationMin ?? existing.durationMin;
    const caloriesBurned =
      body.caloriesBurned ?? estimateSessionCalories(durationMin, vol, weightKg);

    existing.title = body.title ?? existing.title;
    existing.notes = body.notes ?? existing.notes;
    existing.durationMin = durationMin;
    existing.caloriesBurned = caloriesBurned;
    if (body.date) existing.date = parseDateKey(body.date);
    if (body.exercises) existing.exercises = body.exercises as never;
    if (body.finished === true) existing.finishedAt = new Date();
    await existing.save();

    return { data: serialize(existing) };
  });

  app.delete('/sessions/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const res = await WorkoutSessionModel.deleteOne({ _id: id, userId: req.userId });
    if (res.deletedCount === 0) throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
    return reply.code(204).send();
  });

  app.get('/exercise-library', async (req) => {
    const q = z
      .object({
        q: z.string().optional(),
        muscleGroup: z.string().optional(),
      })
      .parse(req.query);
    const needle = q.q?.trim().toLowerCase() ?? '';
    const group = q.muscleGroup?.trim().toLowerCase() ?? '';
    const data = EXERCISE_CATALOG.filter((item) => {
      if (group && item.muscleGroup.toLowerCase() !== group) return false;
      if (!needle) return true;
      return (
        item.name.toLowerCase().includes(needle) ||
        item.muscleGroup.toLowerCase().includes(needle)
      );
    });
    return { data };
  });
};
