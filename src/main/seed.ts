import { app } from 'electron'
import { join } from 'node:path'
import { seedUser } from './seedUser'

// Running as `electron out/main/seed.js` (a bare script path) doesn't read
// package.json's "name" the way `electron .` does, so app.getPath('userData')
// would otherwise resolve to a different directory ("Electron") than the
// real app ("ventrack") — pointing this script at a different database
// entirely. Must be set before anything touches a path.
app.setName('ventrack')

async function main(): Promise<void> {
  const [, , username, password] = process.argv
  if (!username || !password) {
    console.error('Usage: npm run db:seed-user -- <username> <password>')
    app.exit(1)
    return
  }

  await app.whenReady()
  await seedUser(join(__dirname, 'db/migrations'), username, password)
  app.exit(0)
}

main().catch((error) => {
  console.error(error)
  app.exit(1)
})
