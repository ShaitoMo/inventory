import { useState, type FormEvent } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type SessionUser = NonNullable<
  Extract<Awaited<ReturnType<typeof window.api.session.current>>, { ok: true }>['data']
>

interface LoginFormProps {
  onSuccess: (user: SessionUser) => void
}

function LoginForm({ onSuccess }: LoginFormProps): React.JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await window.api.session.login(username, password)
      if (result.ok) {
        onSuccess(result.data)
      } else {
        setError(result.error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoFocus
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}

export default LoginForm
