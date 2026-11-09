import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as authService from './service.js';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80),
  inviteCode: z.string().optional(),
  deviceLabel: z.string().max(80).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceLabel: z.string().max(80).optional(),
});

const refreshBody = z.object({
  refreshToken: z.string().min(10),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    const body = registerBody.parse(req.body);
    const result = await authService.register(app.env, body);
    return reply.code(201).send({ data: result });
  });

  app.post('/login', async (req) => {
    const body = loginBody.parse(req.body);
    const result = await authService.login(app.env, body);
    return { data: result };
  });

  app.post('/refresh', async (req) => {
    const body = refreshBody.parse(req.body);
    const result = await authService.refresh(app.env, body.refreshToken);
    return { data: result };
  });

  app.post('/logout', async (req, reply) => {
    const body = refreshBody.parse(req.body);
    await authService.logout(body.refreshToken);
    return reply.code(204).send();
  });

  app.post(
    '/logout-all',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      await authService.logoutAll(req.userId);
      return reply.code(204).send();
    },
  );
};
