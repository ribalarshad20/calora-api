import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ActivityDayModel } from '../../infra/db/models/activity-day.js';
import { WorkoutModel } from '../../infra/db/models/workout.js';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { AppError } from '../../lib/errors.js';
import { parseDateKey } from '../../lib/date.js';
import { estimateStepCalories, estimateWorkoutCalories, MET_TABLE } from '../../lib/nutrition.js';

const syncBody = z.object({
  date: z.string(),
  steps: z.number().int().min(0),
  activeCalories: z.number().min(0).optional(),
  source: z.enum(['health_connect', 'device_sensor', 'manual']),
});

const workoutBody = z.object({
  date: z.string(),
  type: z.string().min(1),
  label: z.string().max(120).optional(),
  durationMin: z.number().positive(),
  caloriesBurned: z.number().min(0).optional(),
});

export const activityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/met-table', async () => ({ data: MET_TABLE }));

  app.put('/steps', async (req) => {
    const body = syncBody.parse(req.body);
    const date = parseDateKey(body.date);
    const profile = await ProfileModel.findOne({ userId: req.userId });
    const weightKg = profile?.weightKg ?? 70;
    const stepCalories =
      body.activeCalories && body.activeCalories > 0
        ? Math.round(body.activeCalories)
        : estimateStepCalories(body.steps, weightKg);

    const doc = await ActivityDayModel.findOneAndUpdate(
      { userId: req.userId, date },
      {
        $set: {
          steps: body.steps,
          stepCalories,
          activeCalories: body.activeCalories ?? 0,
          source: body.source,
        },
      },
      { upsert: true, new: true },
    );

    return {
      data: {
        date: doc!.date,
        steps: doc!.steps,
        stepCalories: doc!.stepCalories,
        activeCalories: doc!.activeCalories,
        source: doc!.source,
      },
    };
  });

  app.post('/workouts', async (req, reply) => {
    const body = workoutBody.parse(req.body);
    const date = parseDateKey(body.date);
    const profile = await ProfileModel.findOne({ userId: req.userId });
    const weightKg = profile?.weightKg ?? 70;
    const caloriesBurned =
      body.caloriesBurned ?? estimateWorkoutCalories(body.type, body.durationMin, weightKg);

    const workout = await WorkoutModel.create({
      userId: req.userId,
      date,
      type: body.type,
      label: body.label ?? '',
      durationMin: body.durationMin,
      caloriesBurned,
    });

    return reply.code(201).send({
      data: {
        id: workout._id.toString(),
        date: workout.date,
        type: workout.type,
        label: workout.label,
        durationMin: workout.durationMin,
        caloriesBurned: workout.caloriesBurned,
      },
    });
  });

  app.delete('/workouts/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const res = await WorkoutModel.deleteOne({ _id: id, userId: req.userId });
    if (res.deletedCount === 0) throw new AppError(404, 'Workout not found', 'WORKOUT_NOT_FOUND');
    return reply.code(204).send();
  });
};
