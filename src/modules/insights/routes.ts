import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DiaryEntryModel } from '../../infra/db/models/diary-entry.js';
import { ActivityDayModel } from '../../infra/db/models/activity-day.js';
import { WeightLogModel } from '../../infra/db/models/weight-log.js';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { WaterLogModel } from '../../infra/db/models/water-log.js';
import { parseDateKey } from '../../lib/date.js';

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export const insightsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/range', async (req) => {
    const q = z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .parse(req.query);
    const from = parseDateKey(q.from);
    const to = parseDateKey(q.to);
    const days = daysBetween(from, to);

    const [entries, activities, weights, waters, profile] = await Promise.all([
      DiaryEntryModel.find({ userId: req.userId, date: { $gte: from, $lte: to } }),
      ActivityDayModel.find({ userId: req.userId, date: { $gte: from, $lte: to } }),
      WeightLogModel.find({ userId: req.userId, date: { $gte: from, $lte: to } }).sort({
        date: 1,
      }),
      WaterLogModel.find({ userId: req.userId, date: { $gte: from, $lte: to } }),
      ProfileModel.findOne({ userId: req.userId }),
    ]);

    const byDateFood = new Map<string, number>();
    for (const e of entries) {
      byDateFood.set(e.date, (byDateFood.get(e.date) ?? 0) + e.macros.calories);
    }
    const byDateSteps = new Map(activities.map((a) => [a.date, a.steps]));
    const byDateWater = new Map<string, number>();
    for (const w of waters) {
      byDateWater.set(w.date, (byDateWater.get(w.date) ?? 0) + w.amountMl);
    }

    const target = profile?.calorieTarget ?? 2000;
    const series = days.map((date) => ({
      date,
      calories: Math.round(byDateFood.get(date) ?? 0),
      steps: byDateSteps.get(date) ?? 0,
      waterMl: byDateWater.get(date) ?? 0,
      onTarget:
        byDateFood.has(date) &&
        Math.abs((byDateFood.get(date) ?? 0) - target) <= target * 0.1,
    }));

    let streak = 0;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if ((series[i].calories ?? 0) > 0) streak += 1;
      else break;
    }

    const loggedDays = series.filter((d) => d.calories > 0).length;
    const adherence =
      loggedDays === 0
        ? 0
        : Math.round((series.filter((d) => d.onTarget).length / loggedDays) * 100);

    return {
      data: {
        from,
        to,
        calorieTarget: target,
        streakDays: streak,
        adherencePct: adherence,
        avgCalories:
          loggedDays === 0
            ? 0
            : Math.round(series.reduce((s, d) => s + d.calories, 0) / loggedDays),
        avgSteps: Math.round(
          series.reduce((s, d) => s + d.steps, 0) / Math.max(1, series.length),
        ),
        series,
        weight: weights.map((w) => ({ date: w.date, weightKg: w.weightKg })),
      },
    };
  });
};
