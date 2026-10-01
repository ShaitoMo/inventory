import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Windows' well-known SID for the built-in "Users" group - using the SID
// instead of the literal name avoids breaking on non-English Windows
// installs (e.g. "Utilisateurs" on French Windows), where the group name
// is localized but the SID never changes.
const WINDOWS_USERS_GROUP_SID = '*S-1-5-32-545'

// Whichever account's process creates a shared, per-machine directory first
// becomes its owner, and Windows' default ACL inheritance would otherwise
// leave every other account on the machine unable to write to it. An
// object's owner can always adjust its own ACL regardless of admin rights,
// so granting Modify to the built-in Users group here - once per startup,
// not on every write - keeps the directory writable by anyone on the
// machine afterwards. Shared by the logger and the database data directory,
// the two places this app keeps per-machine (not per-user) state.
// Best-effort: a failure here is swallowed, not thrown - callers should
// treat it as non-fatal the same way they treat other logging/IO failures.
export async function grantWriteAccessForAllUsers(dir: string): Promise<void> {
  if (process.platform !== 'win32') return
  try {
    await execFileAsync('icacls', [dir, '/grant', `${WINDOWS_USERS_GROUP_SID}:(OI)(CI)M`, '/T'])
  } catch (error) {
    console.error('Failed to widen directory permissions', error)
  }
}
