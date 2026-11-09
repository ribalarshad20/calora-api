import argon2 from 'argon2';
import type { Env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { UserModel } from '../../infra/db/models/user.js';
import { SessionModel } from '../../infra/db/models/session.js';
import {
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  signAccessToken,
} from './tokens.js';

async function issueSession(
  env: Env,
  user: { _id: import('mongoose').Types.ObjectId; email: string; name: string; onboardingComplete: boolean },
  deviceLabel?: string,
) {
  const refreshToken = generateRefreshToken();
  await SessionModel.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    deviceLabel: deviceLabel ?? 'unknown',
    expiresAt: refreshExpiryDate(env),
  });

  const accessToken = signAccessToken(env, {
    sub: user._id.toString(),
    email: user.email,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      onboardingComplete: user.onboardingComplete,
    },
  };
}

export async function register(
  env: Env,
  input: { email: string; password: string; name: string; inviteCode?: string; deviceLabel?: string },
) {
  if (env.INVITE_CODE && input.inviteCode !== env.INVITE_CODE) {
    throw new AppError(403, 'Invalid invite code', 'INVALID_INVITE');
  }

  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name.trim(),
  });

  return issueSession(env, user, input.deviceLabel);
}

export async function login(
  env: Env,
  input: { email: string; password: string; deviceLabel?: string },
) {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (!user) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');

  const ok = await argon2.verify(user.passwordHash, input.password);
  if (!ok) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');

  return issueSession(env, user, input.deviceLabel);
}

export async function refresh(env: Env, refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const session = await SessionModel.findOne({
    refreshTokenHash: tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH');

  const user = await UserModel.findById(session.userId);
  if (!user) throw new AppError(401, 'User not found', 'USER_NOT_FOUND');

  session.revokedAt = new Date();
  await session.save();

  return issueSession(env, user, session.deviceLabel ?? undefined);
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await SessionModel.updateOne(
    { refreshTokenHash: tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function logoutAll(userId: string) {
  await SessionModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
