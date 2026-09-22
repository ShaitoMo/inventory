import { LogOut, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/theme/ThemeProvider'

interface TopBarProps {
  username: string
  onLogout: () => void
}

function TopBar({ username, onLogout }: TopBarProps): React.JSX.Element {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <span className="text-sm font-medium text-muted-foreground">Inventory Management</span>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <span className="text-sm">{username}</span>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </header>
  )
}

export default TopBar
