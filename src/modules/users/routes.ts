import type { FastifyPluginAsync } from 'fastify';
import { UserModel } from '../../infra/db/models/user.js';
import { ProfileModel } from '../../infra/db/models/profile.js';
import { AppError } from '../../lib/errors.js';

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/me', async (req) => {
    const user = await UserModel.findById(req.userId).select('-passwordHash');
    if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    const profile = await ProfileModel.findOne({ userId: req.userId });
    return {
      data: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        onboardingComplete: user.onboardingComplete,
        theme: profile?.theme ?? 'sage_mist',
        hasProfile: Boolean(profile),
      },
    };
  });
};
