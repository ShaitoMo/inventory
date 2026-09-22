import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import InfoHint from '@/components/InfoHint'
import type { IpcData } from '@/lib/ipc-types'

type User = IpcData<typeof window.api.users.list>[number]

const INFO_TEXT =
  'Manage who can sign in to this app. A new account needs a unique username and a password. ' +
  'Deleting a user here only removes their login - it does not touch movement history they created.'

function UsersWindow(): React.JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const usernameOptions = useMemo(
    () => users.map((user) => ({ value: user.username, label: user.username })),
    [users]
  )

  async function refresh(): Promise<void> {
    setLoading(true)
    const result = await window.api.users.list()
    if (result.ok) {
      setUsers(
        [...result.data].sort((a, b) =>
          a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
        )
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  function resetForm(): void {
    setEditingId(null)
    setUsername('')
    setPassword('')
  }

  function startEdit(user: User): void {
    setEditingId(user.id)
    setUsername(user.username)
    setPassword('')
  }

  function handleFormSubmit(event: FormEvent): void {
    event.preventDefault()
    if (editingId) {
      setConfirmOpen(true)
      return
    }
    void performSave()
  }

  async function performSave(): Promise<void> {
    setConfirmOpen(false)
    setError(null)
    setSubmitting(true)
    try {
      if (editingId) {
        const updateResult = await window.api.users.update(editingId, { username })
        if (!updateResult.ok) {
          setError(updateResult.error.message)
          return
        }
        if (password) {
          const passwordResult = await window.api.users.changePassword(editingId, password)
          if (!passwordResult.ok) {
            setError(passwordResult.error.message)
            return
          }
        }
        resetForm()
        await refresh()
      } else {
        const result = await window.api.users.create({ username, password })
        if (result.ok) {
          resetForm()
          await refresh()
        } else {
          setError(result.error.message)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number): Promise<void> {
    const result = await window.api.users.delete(id)
    if (result.ok) {
      if (editingId === id) resetForm()
      await refresh()
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">
      <form onSubmit={handleFormSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="user-username">Username</Label>
          <Combobox
            id="user-username"
            freeText
            options={usernameOptions}
            value={username}
            onChange={setUsername}
            placeholder="Username"
            required
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="user-password">Password</Label>
          <Input
            id="user-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={editingId ? 'leave blank to keep current' : 'Password'}
            required={!editingId}
            className="w-56"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {editingId ? 'Save changes' : 'Add user'}
        </Button>
        {editingId && (
          <Button type="button" variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => refresh()}
            aria-label="Refresh users"
          >
            <RefreshCw className="size-4" />
          </Button>
          <InfoHint text={INFO_TEXT} />
        </div>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex-1 overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.id === editingId ? 'bg-muted/50' : undefined}
                >
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(user)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive-ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes to &quot;{username}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This updates the account&apos;s username{password ? ' and sets a new password' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void performSave()}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default UsersWindow
