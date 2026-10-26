import { getTestDatabaseUrl } from './helpers/test-database.js';

// Runs before importing AppModule, so dotenv cannot select the development connection.
const databaseUrl = getTestDatabaseUrl();
process.env.TEST_DATABASE_URL = databaseUrl;
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:8080/api/auth/google/callback';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.COOKIE_SAME_SITE = 'lax';
