import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

function extractBearer(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('userId', '');
  app.decorateRequest('userEmail', '');

  app.decorate('authenticate', async (req: FastifyRequest) => {
    const token = extractBearer(req);
    if (!token) throw new AppError(401, 'Missing access token', 'UNAUTHORIZED');
    try {
      const payload = verifyAccessToken(app.env, token);
      req.userId = payload.sub;
      req.userEmail = payload.email;
    } catch {
      throw new AppError(401, 'Invalid or expired access token', 'UNAUTHORIZED');
    }
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
  }
}

export default fp(authPlugin, { name: 'auth-plugin' });
