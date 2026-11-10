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

const SYSTEM_PROMPT = `You are Calora, a nutrition estimator for everyday logging. Return ONLY valid JSON:
{"items":[{"name":string,"grams":number|null,"servingQty":number,"servingUnit":string,"calories":number,"proteinG":number,"carbsG":number,"fatG":number,"confidence":0-1}],"notes":string}
Rules:
- Split multi-food meals into separate items.
- Honor explicit amounts (g, kg, ml, cups, pieces, bowls, plates, handfuls).
- If the user gives grams/weight, set grams and scale macros to that amount.
- Prefer realistic home/restaurant portions when amount is vague.
- Be slightly conservative on calories. Include Pakistani & common fast foods when named.
- Schema version: meal_parse_v1.`;

const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'] as const;

async function groqJsonCompletion(
  env: Env,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const models = Array.from(
    new Set([env.GROQ_MODEL, ...GROQ_FALLBACK_MODELS].filter(Boolean)),
  );
  let lastErr = 'Groq unavailable';

  for (const model of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages,
        response_format: { type: 'json_object' },
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return json.choices[0]?.message?.content ?? '{}';
    }

    lastErr = (await res.text()).slice(0, 240);
    // Try next model on missing/decommissioned IDs; otherwise stop.
    if (!/model_not_found|decommissioned|does not exist/i.test(lastErr)) {
      throw new AppError(502, `Groq error: ${lastErr}`, 'GROQ_ERROR');
    }
  }

  throw new AppError(502, `Groq error: ${lastErr}`, 'GROQ_ERROR');
}

export async function parseMealText(
  env: Env,
  userId: string,
  text: string,
): Promise<ParsedMeal> {
  if (!env.GROQ_API_KEY) {
    return heuristicParse(text);
  }

  await bumpUsage(env, userId, 'text');

  try {
    const content = await groqJsonCompletion(env, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ]);
    return mealParseSchema.parse(extractJson(content));
  } catch (err) {
    // Keep food logging usable if Groq model config is stale on deploy.
    if (err instanceof AppError && err.code === 'GROQ_ERROR') {
      const fallback = heuristicParse(text);
      return {
        ...fallback,
        notes: `${fallback.notes ?? ''} (AI temporarily unavailable)`.trim(),
      };
    }
    throw err;
  }
}

const GEMINI_FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
] as const;

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

  const prompt = `${SYSTEM_PROMPT}\nIdentify foods in this meal photo and estimate portions.${hint ? `\nUser hint: ${hint}` : ''}`;
  const models = Array.from(
    new Set([env.GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS].filter(Boolean)),
  );
  let lastErr = 'Gemini unavailable';

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
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

    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      return mealParseSchema.parse(extractJson(text));
    }

    lastErr = (await res.text()).slice(0, 240);
    // Retired / unknown model IDs → try next. Other errors stop (quota, bad image, etc.).
    if (
      !/no longer available|not found|is not found|NOT_FOUND|does not exist/i.test(
        lastErr,
      )
    ) {
      throw new AppError(502, `Gemini error: ${lastErr}`, 'GEMINI_ERROR');
    }
  }

  throw new AppError(502, `Gemini error: ${lastErr}`, 'GEMINI_ERROR');
}

type Per100 = { kcal: number; p: number; c: number; f: number };

const HEURISTIC_FOODS: Array<{ match: RegExp; per100: Per100; defaultG: number }> = [
  { match: /chicken|murgh/i, per100: { kcal: 165, p: 31, c: 0, f: 3.6 }, defaultG: 150 },
  { match: /beef|steak|keema/i, per100: { kcal: 250, p: 26, c: 0, f: 15 }, defaultG: 150 },
  { match: /egg/i, per100: { kcal: 155, p: 13, c: 1.1, f: 11 }, defaultG: 50 },
  { match: /rice|biryani|pulao/i, per100: { kcal: 130, p: 2.7, c: 28, f: 0.3 }, defaultG: 180 },
  { match: /roti|chapati|naan|paratha/i, per100: { kcal: 300, p: 8, c: 50, f: 7 }, defaultG: 60 },
  { match: /dal|daal|lentil/i, per100: { kcal: 116, p: 9, c: 20, f: 0.4 }, defaultG: 200 },
  { match: /salad|lettuce|cucumber/i, per100: { kcal: 25, p: 1.5, c: 4, f: 0.2 }, defaultG: 120 },
  { match: /bread|toast/i, per100: { kcal: 265, p: 9, c: 49, f: 3.2 }, defaultG: 30 },
  { match: /milk|lassi/i, per100: { kcal: 60, p: 3.2, c: 5, f: 3.3 }, defaultG: 250 },
  { match: /yogurt|dahi/i, per100: { kcal: 60, p: 3.5, c: 4.7, f: 3.3 }, defaultG: 150 },
  { match: /banana/i, per100: { kcal: 89, p: 1.1, c: 23, f: 0.3 }, defaultG: 120 },
  { match: /apple/i, per100: { kcal: 52, p: 0.3, c: 14, f: 0.2 }, defaultG: 180 },
  { match: /burger|fries|pizza|nugget/i, per100: { kcal: 280, p: 12, c: 28, f: 14 }, defaultG: 180 },
  { match: /oil|butter|ghee/i, per100: { kcal: 884, p: 0, c: 0, f: 100 }, defaultG: 10 },
  { match: /coffee|tea|chai/i, per100: { kcal: 2, p: 0.1, c: 0, f: 0 }, defaultG: 200 },
];

function parseAmountGrams(chunk: string): number | null {
  const g = chunk.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/i);
  if (g) return Math.round(Number(g[1]));
  const kg = chunk.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kg) return Math.round(Number(kg[1]) * 1000);
  const cups = chunk.match(/(\d+(?:\.\d+)?)\s*cups?\b/i);
  if (cups) return Math.round(Number(cups[1]) * 180);
  const pcs = chunk.match(/(\d+(?:\.\d+)?)\s*(?:pcs?|pieces?|eggs?)\b/i);
  if (pcs) return null; // handled via multiplier below
  return null;
}

function pieceMultiplier(chunk: string): number {
  const m = chunk.match(/(\d+(?:\.\d+)?)\s*(?:pcs?|pieces?|x|×)?\b/i);
  if (m && /egg|roti|toast|banana|apple|burger/i.test(chunk)) {
    return Math.max(1, Number(m[1]));
  }
  const leading = chunk.match(/^(\d+(?:\.\d+)?)\s+/);
  if (leading && !/g|kg|ml|cup/i.test(chunk)) return Math.max(1, Number(leading[1]));
  return 1;
}

/** Offline-friendly fallback when Groq key is missing (dev / demo). */
function heuristicParse(text: string): ParsedMeal {
  const parts = text
    .split(/,| and | \+ |;|\n/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const items = (parts.length ? parts : [text]).map((chunk) => {
    const hit = HEURISTIC_FOODS.find((f) => f.match.test(chunk));
    const per = hit?.per100 ?? { kcal: 150, p: 8, c: 15, f: 6 };
    const grams = parseAmountGrams(chunk) ?? Math.round((hit?.defaultG ?? 100) * pieceMultiplier(chunk));
    const scale = grams / 100;
    return {
      name: chunk,
      grams,
      servingQty: 1,
      servingUnit: 'g',
      calories: Math.round(per.kcal * scale),
      proteinG: Math.round(per.p * scale * 10) / 10,
      carbsG: Math.round(per.c * scale * 10) / 10,
      fatG: Math.round(per.f * scale * 10) / 10,
      confidence: hit ? 0.55 : 0.3,
    };
  });

  return {
    items,
    notes: 'Local estimate — set GROQ_API_KEY on the API for smarter AI parsing.',
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

  const models = Array.from(
    new Set([env.GROQ_MODEL, ...GROQ_FALLBACK_MODELS].filter(Boolean)),
  );
  let lastErr = 'Groq coaching failed';

  for (const model of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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

    if (res.ok) {
      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return json.choices[0]?.message?.content ?? '';
    }

    lastErr = (await res.text()).slice(0, 200);
    if (!/model_not_found|decommissioned|does not exist/i.test(lastErr)) break;
  }

  throw new AppError(502, lastErr || 'Groq coaching failed', 'GROQ_ERROR');
}
