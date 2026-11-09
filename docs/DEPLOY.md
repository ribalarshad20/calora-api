# Deploy Calora API (Railway)

1. Create a [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster. Allow network access from Railway (`0.0.0.0/0` for simplicity on a personal project, or Railway egress IPs).
2. Create a Railway project → Deploy from GitHub → `ribalarshad20/calora-api`.
3. Set variables from `.env.example` (at minimum `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, optional `GROQ_API_KEY`, `GEMINI_API_KEY`, `INVITE_CODE`).
4. Generate public HTTPS domain. Confirm `GET /health` and `GET /ready`.
5. Point Flutter builds at that URL via `--dart-define=API_BASE_URL=https://...`.

Render works the same with the included `Dockerfile`.
