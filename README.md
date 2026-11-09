# Calora API

Production Fastify + MongoDB backend for the Calora Android calorie tracker.

## Stack

- Fastify 5 + TypeScript
- MongoDB Atlas (Mongoose)
- JWT access + rotating refresh sessions (Argon2id)
- Groq (meal text + coaching) + Gemini (meal photos)
- Open Food Facts barcode/search proxy
- OpenAPI at `/docs`

## Quick start

```bash
cp .env.example .env
# fill MONGODB_URI + JWT secrets (min 32 chars)
npm install
npm run dev
```

Health: `GET /health` · Ready: `GET /ready` · Docs: `/docs`

## Deploy (Railway / Render)

1. Create a MongoDB Atlas free cluster and whitelist the host.
2. Set env vars from `.env.example`.
3. Deploy this repo — `railway.toml` / Dockerfile included.
4. Point the Flutter app `API_BASE_URL` at the public HTTPS URL.

**Note:** Do not deploy Fastify on Vercel serverless. Use Railway/Render for a long-lived Node process.

## Main routes

| Prefix | Purpose |
|--------|---------|
| `/v1/auth` | register, login, refresh, logout |
| `/v1/profile` | onboarding targets (BMR/TDEE/macros) |
| `/v1/diary` | day summary + entries |
| `/v1/foods` | OFF search/barcode + custom foods |
| `/v1/activity` | steps sync + workouts |
| `/v1/water` `/v1/weight` | hydration & weight |
| `/v1/ai` | parse-meal, parse-meal-photo, coach |
| `/v1/insights` | range charts, streak, adherence |
