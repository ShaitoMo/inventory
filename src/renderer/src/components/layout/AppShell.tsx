import { WindowManagerProvider, WindowViewport } from '@/windows/WindowManager'
import { WINDOW_CONTENT } from '@/windows/registry'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppShellProps {
  username: string
  onLogout: () => void
}

function AppShell({ username, onLogout }: AppShellProps): React.JSX.Element {
  return (
    <WindowManagerProvider>
      <div className="flex h-full w-full">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <TopBar username={username} onLogout={onLogout} />
          <WindowViewport content={WINDOW_CONTENT}>
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                Select a section from the sidebar to open it.
              </p>
              <p className="text-xs text-muted-foreground">
                Tip: with a window focused, Ctrl+Alt+Left/Right snaps it to half the screen.
              </p>
            </div>
          </WindowViewport>
        </div>
      </div>
    </WindowManagerProvider>
  )
}

export default AppShell
