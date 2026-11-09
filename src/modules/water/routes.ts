import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { WaterLogModel } from '../../infra/db/models/water-log.js';
import { parseDateKey } from '../../lib/date.js';
import { AppError } from '../../lib/errors.js';

export const waterRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.post('/', async (req, reply) => {
    const body = z
      .object({
        date: z.string(),
        amountMl: z.number().int().min(1).max(5000),
      })
      .parse(req.body);
    const date = parseDateKey(body.date);
    const log = await WaterLogModel.create({
      userId: req.userId,
      date,
      amountMl: body.amountMl,
    });
    return reply.code(201).send({
      data: { id: log._id.toString(), date: log.date, amountMl: log.amountMl },
    });
  });

  app.get('/', async (req) => {
    const q = z.object({ date: z.string() }).parse(req.query);
    const date = parseDateKey(q.date);
    const logs = await WaterLogModel.find({ userId: req.userId, date }).sort({ createdAt: 1 });
    const totalMl = logs.reduce((s, l) => s + l.amountMl, 0);
    return {
      data: {
        totalMl,
        logs: logs.map((l) => ({
          id: l._id.toString(),
          amountMl: l.amountMl,
          createdAt: l.createdAt,
        })),
      },
    };
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const res = await WaterLogModel.deleteOne({ _id: id, userId: req.userId });
    if (res.deletedCount === 0) throw new AppError(404, 'Water log not found', 'WATER_NOT_FOUND');
    return reply.code(204).send();
  });
};
