import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DiaryEntryModel } from '../../infra/db/models/diary-entry.js';
import { AppError } from '../../lib/errors.js';
import * as diary from './service.js';

const createBody = z.object({
  date: z.string(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string().min(1).max(200),
  brand: z.string().max(120).optional(),
  servingQty: z.number().positive().optional(),
  servingUnit: z.string().max(40).optional(),
  grams: z.number().positive().nullable().optional(),
  macros: z.object({
    calories: z.number().min(0),
    proteinG: z.number().min(0),
    carbsG: z.number().min(0),
    fatG: z.number().min(0),
  }),
  source: z.enum(['manual', 'barcode', 'custom', 'ai_text', 'ai_photo', 'favorite']).optional(),
  barcode: z.string().nullable().optional(),
  idempotencyKey: z.string().max(80).nullable().optional(),
  notes: z.string().max(500).optional(),
  mood: z.enum(['great', 'good', 'okay', 'low', 'rough', '']).optional(),
  moodScore: z.number().int().min(1).max(5).nullable().optional(),
});

export const diaryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/day/:date', async (req, reply) => {
    const { date } = z.object({ date: z.string() }).parse(req.params);
    const result = await diary.getDaySummary(req.userId, date);
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === `"${result.etag}"`) {
      return reply.code(304).send();
    }
    reply.header('ETag', `"${result.etag}"`);
    return { data: result };
  });

  app.get('/entries', async (req) => {
    const q = z.object({ date: z.string() }).parse(req.query);
    const entries = await diary.listByDate(req.userId, q.date);
    return { data: entries };
  });

  app.post('/entries', async (req, reply) => {
    const body = createBody.parse(req.body);
    const entry = await diary.createEntry({ userId: req.userId, ...body });
    return reply.code(201).send({ data: entry });
  });

  app.patch('/entries/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        notes: z.string().max(500).optional(),
        name: z.string().min(1).max(200).optional(),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
        mood: z.enum(['great', 'good', 'okay', 'low', 'rough', '']).optional(),
        moodScore: z.number().int().min(1).max(5).nullable().optional(),
      })
      .parse(req.body);
    const updated = await DiaryEntryModel.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: body },
      { new: true },
    );
    if (!updated) throw new AppError(404, 'Entry not found', 'ENTRY_NOT_FOUND');
    return {
      data: {
        id: updated._id.toString(),
        date: updated.date,
        mealType: updated.mealType,
        name: updated.name,
        brand: updated.brand,
        macros: updated.macros,
        source: updated.source,
        notes: updated.notes,
        mood: updated.mood ?? '',
        moodScore: updated.moodScore ?? null,
      },
    };
  });

  app.delete('/entries/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await diary.deleteEntry(req.userId, id);
    return reply.code(204).send();
  });
};
