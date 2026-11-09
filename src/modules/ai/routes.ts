import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { DiaryEntryModel } from '../../infra/db/models/diary-entry.js';
import { toDateKey } from '../../lib/date.js';
import * as ai from './service.js';

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.post('/parse-meal', async (req) => {
    const body = z.object({ text: z.string().min(2).max(2000) }).parse(req.body);
    const parsed = await ai.parseMealText(app.env, req.userId, body.text);
    return { data: { ...parsed, schemaVersion: 'meal_parse_v1' } };
  });

  app.post('/parse-meal-photo', async (req) => {
    const body = z
      .object({
        imageBase64: z.string().min(20),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        hint: z.string().max(300).optional(),
      })
      .parse(req.body);
    const parsed = await ai.parseMealPhoto(
      app.env,
      req.userId,
      body.imageBase64,
      body.mimeType,
      body.hint,
    );
    return { data: { ...parsed, schemaVersion: 'meal_parse_v1' } };
  });

  app.post('/coach', async (req) => {
    const body = z.object({ message: z.string().min(1).max(1000) }).parse(req.body);
    const date = toDateKey();
    const [profile, entries] = await Promise.all([
      ProfileModel.findOne({ userId: req.userId }),
      DiaryEntryModel.find({ userId: req.userId, date }).limit(30),
    ]);
    const consumed = entries.reduce((s, e) => s + e.macros.calories, 0);
    const context = [
      profile
        ? `Goal=${profile.goal}, target=${profile.calorieTarget} kcal, weight=${profile.weightKg}kg`
        : 'No profile yet',
      `Today consumed ≈ ${Math.round(consumed)} kcal across ${entries.length} entries`,
    ].join('\n');

    const reply = await ai.coachingReply(app.env, req.userId, body.message, context);
    return { data: { reply } };
  });
};
