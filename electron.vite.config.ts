import { resolve } from 'path'
import { cpSync } from 'fs'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// drizzle's migrator reads migration files from disk at runtime, so they
// need to be copied alongside the bundled main process output.
function copyDbMigrations(): Plugin {
  return {
    name: 'copy-db-migrations',
    closeBundle() {
      cpSync(resolve('src/main/db/migrations'), resolve('out/main/db/migrations'), {
        recursive: true
      })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [copyDbMigrations()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          seed: resolve('src/main/seed.ts')
        }
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
