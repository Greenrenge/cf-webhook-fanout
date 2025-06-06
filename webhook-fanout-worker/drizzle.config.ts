import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    databaseId: 'ae65d5ff-30cf-4b63-8917-e0c942f7020f',
    token: process.env.CLOUDFLARE_API_TOKEN || '',
  },
});
