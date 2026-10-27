import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // CLI migrations prefer Neon's direct connection; local .env keeps using DATABASE_URL.
  // Generation and validation still work without either variable.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL },
});
