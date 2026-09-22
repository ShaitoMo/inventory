import { useEffect, useState } from 'react'
import LoginForm from './components/LoginForm'
import AppShell from './components/layout/AppShell'

type SessionUser = NonNullable<
  Extract<Awaited<ReturnType<typeof window.api.session.current>>, { ok: true }>['data']
>

function App(): React.JSX.Element {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    window.api.session.current().then((result) => {
      if (result.ok) setUser(result.data)
      setChecking(false)
    })
  }, [])

  async function handleLogout(): Promise<void> {
    await window.api.session.logout()
    setUser(null)
  }

  if (checking) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoginForm onSuccess={setUser} />
      </div>
    )
  }

  return <AppShell username={user.username} onLogout={handleLogout} />
}

export default App
