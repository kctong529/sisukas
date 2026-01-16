// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const useUrl = !!process.env.DATABASE_URL;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: useUrl
    ? {
        url: process.env.DATABASE_URL!,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'sisukas_user',
        password: process.env.DB_PASSWORD || 'dev_password',
        database: process.env.DB_NAME || 'sisukas',
        ssl: false,
      },
});