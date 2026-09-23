import { type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import { useWindowManager } from '@/windows/WindowManager'
import { WINDOW_DEFS, WINDOW_ORDER } from '@/windows/types'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  onClick: () => void
}

function SidebarItem({ icon: Icon, label, onClick }: SidebarItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function Sidebar(): React.JSX.Element {
  const { openWindow } = useWindowManager()

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card p-3">
      <div className="mb-2 px-2 text-lg font-semibold">Ventrack</div>
      {WINDOW_ORDER.map((kind) => {
        const def = WINDOW_DEFS[kind]
        return (
          <SidebarItem
            key={kind}
            icon={def.icon}
            label={def.title}
            onClick={() => openWindow(kind)}
          />
        )
      })}
    </nav>
  )
}

export default Sidebar
