import { createHash } from 'node:crypto';
import { DiaryEntryModel } from '../../infra/db/models/diary-entry.js';
import { ActivityDayModel } from '../../infra/db/models/activity-day.js';
import { WorkoutModel } from '../../infra/db/models/workout.js';
import { WorkoutSessionModel } from '../../infra/db/models/workout-session.js';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { WaterLogModel } from '../../infra/db/models/water-log.js';
import { DayJournalModel } from '../../infra/db/models/day-journal.js';
import { AppError } from '../../lib/errors.js';
import { parseDateKey } from '../../lib/date.js';

export type CreateEntryInput = {
  userId: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  brand?: string;
  servingQty?: number;
  servingUnit?: string;
  grams?: number | null;
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  source?: 'manual' | 'barcode' | 'custom' | 'ai_text' | 'ai_photo' | 'favorite';
  barcode?: string | null;
  idempotencyKey?: string | null;
  notes?: string;
  mood?: 'great' | 'good' | 'okay' | 'low' | 'rough' | '';
  moodScore?: number | null;
};

function serializeEntry(doc: InstanceType<typeof DiaryEntryModel>) {
  return {
    id: doc._id.toString(),
    date: doc.date,
    mealType: doc.mealType,
    name: doc.name,
    brand: doc.brand,
    servingQty: doc.servingQty,
    servingUnit: doc.servingUnit,
    grams: doc.grams,
    macros: doc.macros,
    source: doc.source,
    barcode: doc.barcode,
    notes: doc.notes,
    mood: doc.mood ?? '',
    moodScore: doc.moodScore ?? null,
    createdAt: doc.createdAt,
  };
}

export async function createEntry(input: CreateEntryInput) {
  const date = parseDateKey(input.date);
  try {
    const entry = await DiaryEntryModel.create({ ...input, date });
    return serializeEntry(entry);
  } catch (err: unknown) {
    if (
      input.idempotencyKey &&
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      const existing = await DiaryEntryModel.findOne({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      });
      if (existing) return serializeEntry(existing);
    }
    throw err;
  }
}

export async function listByDate(userId: string, dateRaw: string) {
  const date = parseDateKey(dateRaw);
  const entries = await DiaryEntryModel.find({ userId, date }).sort({ createdAt: 1 });
  return entries.map(serializeEntry);
}

export async function deleteEntry(userId: string, id: string) {
  const res = await DiaryEntryModel.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw new AppError(404, 'Entry not found', 'ENTRY_NOT_FOUND');
}

export async function getDaySummary(userId: string, dateRaw: string) {
  const date = parseDateKey(dateRaw);
  const [entries, activity, workouts, sessions, waterLogs, profile, journal] =
    await Promise.all([
      DiaryEntryModel.find({ userId, date }),
      ActivityDayModel.findOne({ userId, date }),
      WorkoutModel.find({ userId, date }),
      WorkoutSessionModel.find({ userId, date }),
      WaterLogModel.find({ userId, date }),
      ProfileModel.findOne({ userId }),
      DayJournalModel.findOne({ userId, date }),
    ]);

  const food = entries.reduce(
    (acc, e) => {
      acc.calories += e.macros.calories;
      acc.proteinG += e.macros.proteinG;
      acc.carbsG += e.macros.carbsG;
      acc.fatG += e.macros.fatG;
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const workoutCalories =
    workouts.reduce((s, w) => s + w.caloriesBurned, 0) +
    sessions.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0);
  const stepCalories = activity?.stepCalories ?? 0;
  const activeCalories = activity?.activeCalories ?? 0;
  const burned = workoutCalories + Math.max(stepCalories, activeCalories);
  const calorieTarget = profile?.calorieTarget ?? 2000;
  const remaining = calorieTarget - food.calories + burned;
  const waterMl = waterLogs.reduce((s, w) => s + w.amountMl, 0);

  const etag = createHash('sha1')
    .update(
      JSON.stringify({
        food,
        burned,
        steps: activity?.steps ?? 0,
        waterMl,
        n: entries.length,
        wn: workouts.length,
      }),
    )
    .digest('hex');

  return {
    etag,
    summary: {
      date,
      calorieTarget,
      proteinTarget: profile?.proteinG ?? 0,
      carbsTarget: profile?.carbsG ?? 0,
      fatTarget: profile?.fatG ?? 0,
      waterGoalMl: profile?.waterGoalMl ?? 2500,
      consumed: food,
      burned: {
        total: burned,
        workouts: workoutCalories,
        steps: stepCalories,
        active: activeCalories,
      },
      remaining,
      steps: activity?.steps ?? 0,
      stepsSource: activity?.source ?? null,
      waterMl,
      entryCount: entries.length,
      mood: journal?.mood || '',
      moodScore: journal?.moodScore ?? null,
      dayNote: journal?.dayNote || '',
      energy: journal?.energy ?? null,
      sleepQuality: journal?.sleepQuality ?? null,
    },
    entries: entries.map(serializeEntry),
    workouts: [
      ...workouts.map((w) => ({
        id: w._id.toString(),
        type: w.type,
        label: w.label,
        durationMin: w.durationMin,
        caloriesBurned: w.caloriesBurned,
        kind: 'simple' as const,
      })),
      ...sessions.map((w) => ({
        id: w._id.toString(),
        type: 'session',
        label: w.title || 'Workout',
        durationMin: w.durationMin,
        caloriesBurned: w.caloriesBurned,
        kind: 'session' as const,
      })),
    ],
  };
}
