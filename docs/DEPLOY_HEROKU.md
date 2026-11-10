# Deploy on Heroku

```bash
heroku create calora-api   # or any available name
heroku config:set NODE_ENV=production
heroku config:set HOST=0.0.0.0
heroku config:set MONGODB_URI="your-atlas-uri"
heroku config:set JWT_ACCESS_SECRET="at-least-32-characters-long!!"
heroku config:set JWT_REFRESH_SECRET="at-least-32-characters-long!!"
# Required for smart “type what you ate” AI logging (pipeline Config Vars):
# GROQ_API_KEY=...
# GROQ_MODEL=openai/gpt-oss-20b
# Optional photo logging:
# GEMINI_API_KEY=...
# GEMINI_MODEL=gemini-2.0-flash
# INVITE_CODE=...
# CORS_ORIGINS=*

git push heroku main
heroku open /health
```

`PORT` is set by Heroku automatically. `Procfile` runs `npm start` after `heroku-postbuild` compiles TypeScript.
