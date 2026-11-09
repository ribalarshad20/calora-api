import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { WeightLogModel } from '../../infra/db/models/weight-log.js';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { parseDateKey } from '../../lib/date.js';
import { computeTargets } from '../../lib/nutrition.js';
import { AppError } from '../../lib/errors.js';

export const weightRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.put('/', async (req) => {
    const body = z
      .object({
        date: z.string(),
        weightKg: z.number().min(30).max(300),
        note: z.string().max(200).optional(),
        updateProfile: z.boolean().optional(),
      })
      .parse(req.body);
    const date = parseDateKey(body.date);

    const log = await WeightLogModel.findOneAndUpdate(
      { userId: req.userId, date },
      { $set: { weightKg: body.weightKg, note: body.note ?? '' } },
      { upsert: true, new: true },
    );

    if (body.updateProfile !== false) {
      const profile = await ProfileModel.findOne({ userId: req.userId });
      if (profile) {
        const targets = computeTargets({
          sex: profile.sex,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: body.weightKg,
          goal: profile.goal,
          activityLevel: profile.activityLevel,
        });
        profile.weightKg = body.weightKg;
        Object.assign(profile, targets);
        await profile.save();
      }
    }

    return {
      data: {
        id: log!._id.toString(),
        date: log!.date,
        weightKg: log!.weightKg,
        note: log!.note,
      },
    };
  });

  app.get('/history', async (req) => {
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.coerce.number().int().positive().max(365).optional(),
      })
      .parse(req.query);

    const filter: Record<string, unknown> = { userId: req.userId };
    if (q.from || q.to) {
      filter.date = {};
      if (q.from) (filter.date as Record<string, string>).$gte = parseDateKey(q.from);
      if (q.to) (filter.date as Record<string, string>).$lte = parseDateKey(q.to);
    }

    const logs = await WeightLogModel.find(filter)
      .sort({ date: -1 })
      .limit(q.limit ?? 90);

    return {
      data: logs.map((l) => ({
        id: l._id.toString(),
        date: l.date,
        weightKg: l.weightKg,
        note: l.note,
      })),
    };
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const res = await WeightLogModel.deleteOne({ _id: id, userId: req.userId });
    if (res.deletedCount === 0) throw new AppError(404, 'Weight log not found', 'WEIGHT_NOT_FOUND');
    return reply.code(204).send();
  });
};
