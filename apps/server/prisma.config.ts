import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation and validation work without a database. Migration commands require this variable.
  datasource: { url: process.env.DATABASE_URL },
});
