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

    const byDateFood = new Map<
      string,
      { calories: number; proteinG: number; carbsG: number; fatG: number; meals: number }
    >();
    for (const e of entries) {
      const cur = byDateFood.get(e.date) ?? {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        meals: 0,
      };
      cur.calories += e.macros.calories;
      cur.proteinG += e.macros.proteinG;
      cur.carbsG += e.macros.carbsG;
      cur.fatG += e.macros.fatG;
      cur.meals += 1;
      byDateFood.set(e.date, cur);
    }

    const byDateSteps = new Map(activities.map((a) => [a.date, a.steps]));
    const byDateWater = new Map<string, number>();
    for (const w of waters) {
      byDateWater.set(w.date, (byDateWater.get(w.date) ?? 0) + w.amountMl);
    }

    const target = profile?.calorieTarget ?? 2000;
    const proteinTarget = profile?.proteinG ?? 120;
    const waterGoal = profile?.waterGoalMl ?? 2500;

    const series = days.map((date) => {
      const food = byDateFood.get(date);
      const calories = Math.round(food?.calories ?? 0);
      return {
        date,
        calories,
        proteinG: Math.round(food?.proteinG ?? 0),
        carbsG: Math.round(food?.carbsG ?? 0),
        fatG: Math.round(food?.fatG ?? 0),
        meals: food?.meals ?? 0,
        steps: byDateSteps.get(date) ?? 0,
        waterMl: byDateWater.get(date) ?? 0,
        onTarget: Boolean(food) && Math.abs(calories - target) <= target * 0.1,
        waterHit: (byDateWater.get(date) ?? 0) >= waterGoal,
      };
    });

    let streak = 0;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if ((series[i].calories ?? 0) > 0) streak += 1;
      else break;
    }

    const logged = series.filter((d) => d.calories > 0);
    const loggedDays = logged.length;
    const waterDays = series.filter((d) => d.waterMl > 0);
    const adherence =
      loggedDays === 0
        ? 0
        : Math.round((series.filter((d) => d.onTarget).length / loggedDays) * 100);

    const avg = (vals: number[]) =>
      vals.length === 0 ? 0 : Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);

    const best = [...logged].sort((a, b) => a.calories - b.calories)[0];
    const heaviest = [...logged].sort((a, b) => b.calories - a.calories)[0];
    const bestSteps = [...series].sort((a, b) => b.steps - a.steps)[0];

    let weightDelta: number | null = null;
    if (weights.length >= 2) {
      weightDelta =
        Math.round((weights[weights.length - 1].weightKg - weights[0].weightKg) * 10) / 10;
    }

    return {
      data: {
        from,
        to,
        calorieTarget: target,
        proteinTarget,
        waterGoalMl: waterGoal,
        streakDays: streak,
        adherencePct: adherence,
        loggedDays,
        daysOnTarget: series.filter((d) => d.onTarget).length,
        avgCalories: avg(logged.map((d) => d.calories)),
        avgProteinG: avg(logged.map((d) => d.proteinG)),
        avgCarbsG: avg(logged.map((d) => d.carbsG)),
        avgFatG: avg(logged.map((d) => d.fatG)),
        avgSteps: avg(series.map((d) => d.steps)),
        avgWaterMl: avg(waterDays.map((d) => d.waterMl)),
        waterHitDays: series.filter((d) => d.waterHit).length,
        totalMeals: entries.length,
        bestCalorieDay: best
          ? { date: best.date, calories: best.calories }
          : null,
        highestCalorieDay: heaviest
          ? { date: heaviest.date, calories: heaviest.calories }
          : null,
        bestStepsDay: bestSteps && bestSteps.steps > 0
          ? { date: bestSteps.date, steps: bestSteps.steps }
          : null,
        weightDeltaKg: weightDelta,
        series,
        weight: weights.map((w) => ({ date: w.date, weightKg: w.weightKg })),
      },
    };
  });
};
