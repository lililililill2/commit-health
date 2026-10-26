import { defineConfig } from 'prisma/config';
import { getTestDatabaseUrl } from './test/helpers/test-database.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: getTestDatabaseUrl() },
});
