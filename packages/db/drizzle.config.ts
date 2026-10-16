import { DatabaseEnv, loadEnv } from '@subtick/config'
import { defineConfig } from 'drizzle-kit'

const env = loadEnv(DatabaseEnv)

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: env.DATABASE_URL },
  casing: 'snake_case',
})
