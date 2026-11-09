import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { connectDb } from './infra/db/connection.js';
import { buildApp } from './app.js';

async function main() {
  const env = loadEnv();
  await connectDb(env);
  const app = await buildApp(env);

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Calora API listening on ${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
