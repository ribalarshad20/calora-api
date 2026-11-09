import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DayJournalModel } from '../../infra/db/models/day-journal.js';
import { DiaryEntryModel } from '../../infra/db/models/diary-entry.js';
import { parseDateKey } from '../../lib/date.js';

const upsertBody = z.object({
  date: z.string(),
  mood: z.enum(['great', 'good', 'okay', 'low', 'rough', '']).optional(),
  moodScore: z.number().int().min(1).max(5).nullable().optional(),
  dayNote: z.string().max(2000).optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  sleepQuality: z.number().int().min(1).max(5).nullable().optional(),
});

function serialize(doc: InstanceType<typeof DayJournalModel>) {
  return {
    id: doc._id.toString(),
    date: doc.date,
    mood: doc.mood || '',
    moodScore: doc.moodScore,
    dayNote: doc.dayNote || '',
    energy: doc.energy,
    sleepQuality: doc.sleepQuality,
  };
}

export const journalRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /** Recent day notes + meal notes for the Notes history screen. */
  app.get('/feed', async (req) => {
    const q = z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .parse(req.query);
    const from = parseDateKey(q.from);
    const to = parseDateKey(q.to);

    const [journals, mealNotes] = await Promise.all([
      DayJournalModel.find({
        userId: req.userId,
        date: { $gte: from, $lte: to },
        $or: [{ dayNote: { $exists: true, $ne: '' } }, { mood: { $exists: true, $ne: '' } }],
      }).sort({ date: -1 }),
      DiaryEntryModel.find({
        userId: req.userId,
        date: { $gte: from, $lte: to },
        notes: { $exists: true, $ne: '' },
      })
        .sort({ date: -1, createdAt: -1 })
        .limit(100),
    ]);

    return {
      data: {
        days: journals.map(serialize),
        mealNotes: mealNotes.map((e) => ({
          id: e._id.toString(),
          date: e.date,
          mealType: e.mealType,
          name: e.name,
          notes: e.notes || '',
          mood: (e as { mood?: string }).mood || '',
          calories: e.macros?.calories ?? 0,
        })),
      },
    };
  });

  app.get('/:date', async (req) => {
    const { date: raw } = z.object({ date: z.string() }).parse(req.params);
    const date = parseDateKey(raw);
    const doc = await DayJournalModel.findOne({ userId: req.userId, date });
    return {
      data: doc
        ? serialize(doc)
        : {
            id: null,
            date,
            mood: '',
            moodScore: null,
            dayNote: '',
            energy: null,
            sleepQuality: null,
          },
    };
  });

  app.put('/', async (req) => {
    const body = upsertBody.parse(req.body);
    const date = parseDateKey(body.date);
    const $set: Record<string, unknown> = {};
    if (body.mood !== undefined) $set.mood = body.mood;
    if (body.moodScore !== undefined) $set.moodScore = body.moodScore;
    if (body.dayNote !== undefined) $set.dayNote = body.dayNote;
    if (body.energy !== undefined) $set.energy = body.energy;
    if (body.sleepQuality !== undefined) $set.sleepQuality = body.sleepQuality;

    const doc = await DayJournalModel.findOneAndUpdate(
      { userId: req.userId, date },
      { $set: { userId: req.userId, date, ...$set } },
      { upsert: true, new: true },
    );
    return { data: serialize(doc!) };
  });
};
