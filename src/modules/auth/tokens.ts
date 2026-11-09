import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Env } from '../../config/env.js';

export type AccessPayload = {
  sub: string;
  email: string;
  type: 'access';
};

export function signAccessToken(env: Env, payload: Omit<AccessPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(env: Env, token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return decoded;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiryDate(env: Env): Date {
  const match = /^(\d+)([dhms])$/.exec(env.JWT_REFRESH_TTL);
  const now = Date.now();
  if (!match) return new Date(now + 30 * 24 * 60 * 60 * 1000);
  const n = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 'd'
      ? n * 86400000
      : unit === 'h'
        ? n * 3600000
        : unit === 'm'
          ? n * 60000
          : n * 1000;
  return new Date(now + ms);
}
