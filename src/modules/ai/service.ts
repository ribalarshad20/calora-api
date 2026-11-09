import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { AiUsageModel } from '../../infra/db/models/ai-usage.js';
import { toDateKey } from '../../lib/date.js';

const mealItemSchema = z.object({
  name: z.string(),
  grams: z.number().nullable().optional(),
  servingQty: z.number().optional(),
  servingUnit: z.string().optional(),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  confidence: z.number().min(0).max(1).optional(),
});

const mealParseSchema = z.object({
  items: z.array(mealItemSchema).min(1),
  notes: z.string().optional(),
});

export type ParsedMeal = z.infer<typeof mealParseSchema>;

async function bumpUsage(
  env: Env,
  userId: string,
  kind: 'text' | 'photo',
): Promise<void> {
  const date = toDateKey();
  const usage = await AiUsageModel.findOneAndUpdate(
    { userId, date },
    { $setOnInsert: { textCount: 0, photoCount: 0 } },
    { upsert: true, new: true },
  );

  if (kind === 'text' && usage!.textCount >= env.AI_DAILY_TEXT_LIMIT) {
    throw new AppError(429, 'Daily AI text limit reached', 'AI_TEXT_LIMIT');
  }
  if (kind === 'photo' && usage!.photoCount >= env.AI_DAILY_PHOTO_LIMIT) {
    throw new AppError(429, 'Daily AI photo limit reached', 'AI_PHOTO_LIMIT');
  }

  await AiUsageModel.updateOne(
    { userId, date },
    { $inc: kind === 'text' ? { textCount: 1 } : { photoCount: 1 } },
  );
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model response');
  return JSON.parse(raw.slice(start, end + 1));
}

const SYSTEM_PROMPT = `You are Calora, a nutrition estimator. Return ONLY valid JSON:
{"items":[{"name":string,"grams":number|null,"servingQty":number,"servingUnit":string,"calories":number,"proteinG":number,"carbsG":number,"fatG":number,"confidence":0-1}],"notes":string}
Estimate realistic macros. Prefer grams when possible. Be conservative on calories. Schema version: meal_parse_v1.`;

export async function parseMealText(
  env: Env,
  userId: string,
  text: string,
): Promise<ParsedMeal> {
  if (!env.GROQ_API_KEY) {
    return heuristicParse(text);
  }

  await bumpUsage(env, userId, 'text');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AppError(502, `Groq error: ${body.slice(0, 200)}`, 'GROQ_ERROR');
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = json.choices[0]?.message?.content ?? '{}';
  return mealParseSchema.parse(extractJson(content));
}

export async function parseMealPhoto(
  env: Env,
  userId: string,
  imageBase64: string,
  mimeType: string,
  hint?: string,
): Promise<ParsedMeal> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      503,
      'Gemini API key not configured. Set GEMINI_API_KEY.',
      'GEMINI_NOT_CONFIGURED',
    );
  }

  await bumpUsage(env, userId, 'photo');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const prompt = `${SYSTEM_PROMPT}\nIdentify foods in this meal photo and estimate portions.${hint ? `\nUser hint: ${hint}` : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AppError(502, `Gemini error: ${body.slice(0, 200)}`, 'GEMINI_ERROR');
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return mealParseSchema.parse(extractJson(text));
}

/** Offline-friendly fallback when Groq key is missing (dev / demo). */
function heuristicParse(text: string): ParsedMeal {
  const parts = text
    .split(/,| and | \+ | with /i)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const items = (parts.length ? parts : [text]).map((name) => ({
    name,
    grams: 100,
    servingQty: 1,
    servingUnit: 'serving',
    calories: 150,
    proteinG: 8,
    carbsG: 15,
    fatG: 6,
    confidence: 0.35,
  }));

  return {
    items,
    notes: 'Heuristic estimate (configure GROQ_API_KEY for AI accuracy).',
  };
}

export async function coachingReply(
  env: Env,
  userId: string,
  message: string,
  context: string,
): Promise<string> {
  if (!env.GROQ_API_KEY) {
    return 'Configure GROQ_API_KEY to enable Calora coaching. Meanwhile: stay consistent with protein, hydrate, and hit a small daily step goal.';
  }
  await bumpUsage(env, userId, 'text');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'You are Calora, a calm nutrition coach. Be concise, kind, non-medical. Use the user context. Avoid shame.',
        },
        { role: 'user', content: `Context:\n${context}\n\nQuestion:\n${message}` },
      ],
    }),
  });

  if (!res.ok) {
    throw new AppError(502, 'Groq coaching failed', 'GROQ_ERROR');
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0]?.message?.content ?? '';
}
