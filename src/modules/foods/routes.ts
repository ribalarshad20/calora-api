import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FoodCustomModel } from '../../infra/db/models/food-custom.js';
import { fetchByBarcode, searchOff } from './off.js';

const customBody = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(120).optional(),
  servingUnit: z.string().max(40).optional(),
  servingGrams: z.number().positive().nullable().optional(),
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  favorite: z.boolean().optional(),
});

export const foodsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/search', async (req) => {
    const q = z
      .object({
        q: z.string().min(1),
        page: z.coerce.number().int().positive().optional(),
      })
      .parse(req.query);

    const off = await searchOff(app.env, q.q, q.page ?? 1);
    let custom = await FoodCustomModel.find({
      userId: req.userId,
      name: { $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    }).limit(20);

    return {
      data: {
        openFoodFacts: off,
        custom: custom.map((c) => ({
          id: c._id.toString(),
          name: c.name,
          brand: c.brand,
          servingUnit: c.servingUnit,
          servingGrams: c.servingGrams,
          calories: c.calories,
          proteinG: c.proteinG,
          carbsG: c.carbsG,
          fatG: c.fatG,
          favorite: c.favorite,
        })),
      },
    };
  });

  app.get('/barcode/:code', async (req) => {
    const { code } = z.object({ code: z.string().min(4) }).parse(req.params);
    const product = await fetchByBarcode(app.env, code);
    return { data: product };
  });

  app.get('/custom', async (req) => {
    const items = await FoodCustomModel.find({ userId: req.userId }).sort({
      favorite: -1,
      updatedAt: -1,
    });
    return {
      data: items.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        brand: c.brand,
        servingUnit: c.servingUnit,
        servingGrams: c.servingGrams,
        calories: c.calories,
        proteinG: c.proteinG,
        carbsG: c.carbsG,
        fatG: c.fatG,
        favorite: c.favorite,
      })),
    };
  });

  app.post('/custom', async (req, reply) => {
    const body = customBody.parse(req.body);
    const created = await FoodCustomModel.create({ userId: req.userId, ...body });
    return reply.code(201).send({
      data: {
        id: created._id.toString(),
        ...body,
        favorite: body.favorite ?? false,
      },
    });
  });

  app.patch('/custom/:id/favorite', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ favorite: z.boolean() }).parse(req.body);
    const updated = await FoodCustomModel.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: { favorite: body.favorite } },
      { new: true },
    );
    return { data: { id, favorite: updated?.favorite ?? body.favorite } };
  });
};
