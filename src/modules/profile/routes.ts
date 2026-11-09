import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { UserModel } from '../../infra/db/models/user.js';
import { AppError } from '../../lib/errors.js';
import { computeTargets } from '../../lib/nutrition.js';

const upsertBody = z.object({
  sex: z.enum(['male', 'female', 'other']),
  age: z.number().int().min(13).max(120),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  goal: z.enum(['lose', 'maintain', 'gain']),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  waterGoalMl: z.number().int().min(500).max(8000).optional(),
  theme: z
    .enum([
      'cyber_active',
      'bio_mint',
      'nordic_calm',
      'synth_violet',
      'sage_mist',
      'dawn_cream',
      'harbor_calm',
      'midnight',
    ])
    .optional(),
});

const themeBody = z.object({
  theme: z.enum(['cyber_active', 'bio_mint', 'nordic_calm', 'synth_violet']),
});

function serialize(doc: InstanceType<typeof ProfileModel>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    sex: doc.sex,
    age: doc.age,
    heightCm: doc.heightCm,
    weightKg: doc.weightKg,
    goal: doc.goal,
    activityLevel: doc.activityLevel,
    bmr: doc.bmr,
    tdee: doc.tdee,
    calorieTarget: doc.calorieTarget,
    proteinG: doc.proteinG,
    carbsG: doc.carbsG,
    fatG: doc.fatG,
    waterGoalMl: doc.waterGoalMl,
    theme: doc.theme,
  };
}

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/me', async (req) => {
    const profile = await ProfileModel.findOne({ userId: req.userId });
    if (!profile) throw new AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
    return { data: serialize(profile) };
  });

  app.put('/me', async (req) => {
    const body = upsertBody.parse(req.body);
    const targets = computeTargets(body);
    const profile = await ProfileModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          userId: req.userId,
          ...body,
          ...targets,
          waterGoalMl: body.waterGoalMl ?? 2500,
          theme: body.theme ?? 'nordic_calm',
        },
      },
      { upsert: true, new: true },
    );

    await UserModel.findByIdAndUpdate(req.userId, { onboardingComplete: true });
    return { data: serialize(profile!) };
  });

  app.patch('/theme', async (req) => {
    const body = themeBody.parse(req.body);
    const profile = await ProfileModel.findOneAndUpdate(
      { userId: req.userId },
      { $set: { theme: body.theme } },
      { new: true },
    );
    if (!profile) throw new AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
    return { data: serialize(profile) };
  });
};
