import { join } from 'node:path'
import { defineConfig } from 'drizzle-kit'

// Mirrors Electron's app.getPath('userData') on Windows: %APPDATA%\<name from package.json>
const pgDataDir = join(process.env.APPDATA ?? '', 'inventory', 'pgdata')

export default defineConfig({
  schema: './src/main/db/schema.ts',
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: { url: pgDataDir }
})
