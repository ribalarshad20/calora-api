# Deploy on Heroku

```bash
heroku create calora-api   # or any available name
heroku config:set NODE_ENV=production
heroku config:set HOST=0.0.0.0
heroku config:set MONGODB_URI="your-atlas-uri"
heroku config:set JWT_ACCESS_SECRET="at-least-32-characters-long!!"
heroku config:set JWT_REFRESH_SECRET="at-least-32-characters-long!!"
# optional:
# heroku config:set GROQ_API_KEY=...
# heroku config:set GEMINI_API_KEY=...
# heroku config:set INVITE_CODE=...
# heroku config:set CORS_ORIGINS=*

git push heroku main
heroku open /health
```

`PORT` is set by Heroku automatically. `Procfile` runs `npm start` after `heroku-postbuild` compiles TypeScript.
