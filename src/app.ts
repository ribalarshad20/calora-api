import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import type { Env } from './config/env.js';
import { isAppError } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { usersRoutes } from './modules/users/routes.js';
import { profileRoutes } from './modules/profile/routes.js';
import { diaryRoutes } from './modules/diary/routes.js';
import { foodsRoutes } from './modules/foods/routes.js';
import { activityRoutes } from './modules/activity/routes.js';
import { waterRoutes } from './modules/water/routes.js';
import { weightRoutes } from './modules/weight/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { insightsRoutes } from './modules/insights/routes.js';
import { journalRoutes } from './modules/journal/routes.js';
import mongoose from 'mongoose';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
}

export async function buildApp(env: Env) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  app.decorate('env', env);

  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Calora API',
        description: 'Production calorie tracker backend',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(authPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'calora-api',
    time: new Date().toISOString(),
  }));

  app.get('/ready', async (_req, reply) => {
    const state = mongoose.connection.readyState;
    if (state !== 1) {
      return reply.code(503).send({ status: 'not_ready', db: state });
    }
    return { status: 'ready', db: 'connected' };
  });

  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(usersRoutes, { prefix: '/v1/users' });
  await app.register(profileRoutes, { prefix: '/v1/profile' });
  await app.register(diaryRoutes, { prefix: '/v1/diary' });
  await app.register(foodsRoutes, { prefix: '/v1/foods' });
  await app.register(activityRoutes, { prefix: '/v1/activity' });
  await app.register(waterRoutes, { prefix: '/v1/water' });
  await app.register(weightRoutes, { prefix: '/v1/weight' });
  await app.register(aiRoutes, { prefix: '/v1/ai' });
  await app.register(insightsRoutes, { prefix: '/v1/insights' });
  await app.register(journalRoutes, { prefix: '/v1/journal' });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: err.issues,
          requestId: req.id,
        },
      });
    }
    if (isAppError(err)) {
      return reply.code(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId: req.id,
        },
      });
    }

    req.log.error(err);
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        requestId: req.id,
      },
    });
  });

  return app;
}
