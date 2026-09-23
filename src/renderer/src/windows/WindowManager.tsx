import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
// The package.json "browser" field points at a bundled IIFE that only sets
// `window.WinBox` and has no module exports, which Vite picks by default and
// resolves to an empty object. Import the real ES module source directly.
import WinBox from 'winbox/src/js/winbox.js'
import { WINDOW_DEFS, type WindowKind } from './types'

const DEFAULT_WIDTH = 760
const DEFAULT_HEIGHT = 520

interface OpenWindowEntry {
  kind: WindowKind
  container: HTMLDivElement
}

interface WindowManagerContextValue {
  openWindow: (kind: WindowKind) => void
  rootRef: React.RefObject<HTMLDivElement | null>
  openWindows: OpenWindowEntry[]
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null)

function useWindowManagerContext(): WindowManagerContextValue {
  const context = useContext(WindowManagerContext)
  if (!context) {
    throw new Error('This component must be used within a WindowManagerProvider')
  }
  return context
}

export function useWindowManager(): Pick<WindowManagerContextValue, 'openWindow'> {
  const { openWindow } = useWindowManagerContext()
  return { openWindow }
}

export function WindowManagerProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const instances = useRef<Partial<Record<WindowKind, WinBox>>>({})
  const focusedKind = useRef<WindowKind | null>(null)
  const [openWindows, setOpenWindows] = useState<OpenWindowEntry[]>([])
  // WinBox positions windows as `position: fixed` in *viewport*-absolute
  // pixels, and its own bounds-checking always measures the full
  // `document.documentElement`, completely ignoring the `root` option for
  // sizing purposes (confirmed in its source - `root` only controls DOM
  // placement). So confining windows to the content area (never covering the
  // sidebar/top bar) has to be done via WinBox's `top`/`left`/`right`/`bottom`
  // viewport-inset options, using the content area's real screen offset.
  const insetsRef = useRef({ top: 0, left: 0 })
  const contentSizeRef = useRef({ width: 0, height: 0 })

  function measureContentArea(): void {
    if (!rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    insetsRef.current = { top: rect.top, left: rect.left }
    contentSizeRef.current = { width: rect.width, height: rect.height }
  }

  function openWindow(kind: WindowKind): void {
    const existing = instances.current[kind]
    if (existing) {
      existing.show()
      existing.minimize(false)
      existing.focus()
      return
    }

    const container = document.createElement('div')
    container.style.height = '100%'

    const def = WINDOW_DEFS[kind]
    const { top, left } = insetsRef.current
    const { width: contentWidth, height: contentHeight } = contentSizeRef.current
    // DEFAULT_WIDTH/HEIGHT are a ceiling, not a fixed size - the app window
    // may not be maximized, so a new window must never open bigger than the
    // content area actually has room for right now.
    const width = contentWidth > 0 ? Math.min(DEFAULT_WIDTH, contentWidth) : DEFAULT_WIDTH
    const height = contentHeight > 0 ? Math.min(DEFAULT_HEIGHT, contentHeight) : DEFAULT_HEIGHT
    // WinBox's own "center"/"right"/"bottom" position keywords compute a
    // pure span (`base - center`) and never add the `left`/`top` inset back
    // in, so they land short of where the inset-aware viewport actually
    // starts. Compute exact pixels ourselves instead of relying on them.
    const x = left + Math.max(0, (contentWidth - width) / 2)
    const y = top + Math.max(0, (contentHeight - height) / 2)

    const winbox = new WinBox({
      title: def.title,
      root: rootRef.current ?? undefined,
      mount: container,
      class: 'inventory-window',
      top,
      left,
      right: 0,
      bottom: 0,
      x,
      y,
      width,
      height,
      onfocus() {
        focusedKind.current = kind
      },
      onblur() {
        if (focusedKind.current === kind) focusedKind.current = null
      },
      onclose: () => {
        delete instances.current[kind]
        if (focusedKind.current === kind) focusedKind.current = null
        setOpenWindows((current) => current.filter((entry) => entry.kind !== kind))
      }
    })

    instances.current[kind] = winbox
    setOpenWindows((current) => [...current, { kind, container }])
  }

  useEffect(() => {
    measureContentArea()
  }, [])

  // WinBox never rescales already-open windows when the host window resizes
  // (it only re-clamps minimized-window positions). Scale every open window
  // proportionally to how much the content area itself just grew/shrank, so
  // a window keeps the same relative size/position instead of overflowing a
  // shrunk window or looking tiny in a grown one.
  useEffect(() => {
    let rafId: number | null = null

    function applyResize(): void {
      rafId = null
      if (!rootRef.current) return
      const previous = contentSizeRef.current
      const rect = rootRef.current.getBoundingClientRect()
      if (previous.width === 0 || previous.height === 0) {
        measureContentArea()
        return
      }

      const scaleX = rect.width / previous.width
      const scaleY = rect.height / previous.height
      const { top, left } = insetsRef.current

      for (const winbox of Object.values(instances.current)) {
        if (!winbox) continue

        // Both minimize() and maximize() size the window via a "skip
        // update" resize/move (see WinBox's update_min_stack and
        // maximize()), which sets the on-screen size without touching
        // `winbox.width`/`height`/`x`/`y` - those still hold the pre-
        // minimize/maximize values so restore() can reapply them later.
        // Scaling from those stale values here would visually pop a
        // minimized window back open, so leave minimized windows alone
        // (WinBox's own resize listener already re-docks them) and just
        // re-fill maximized ones to the new content area.
        if (winbox.min) continue

        if (winbox.max) {
          winbox.resize(rect.width, rect.height, true).move(left, top, true)
          continue
        }

        const newWidth = winbox.width * scaleX
        const newHeight = winbox.height * scaleY
        const newX = left + (winbox.x - left) * scaleX
        const newY = top + (winbox.y - top) * scaleY
        winbox.resize(newWidth, newHeight).move(newX, newY)
      }

      measureContentArea()
    }

    function handleResize(): void {
      if (rafId !== null) return
      rafId = requestAnimationFrame(applyResize)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent): void {
      if (!event.ctrlKey || !event.altKey) return
      const kind = focusedKind.current
      if (!kind) return
      const winbox = instances.current[kind]
      if (!winbox) return
      const { top, left } = insetsRef.current
      const { width: contentWidth } = contentSizeRef.current

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        winbox.maximize(false)
        winbox.resize('50%', '100%').move(left, top)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        winbox.maximize(false)
        // Don't use the 'right' move keyword - see the note on `openWindow`
        // above about it not accounting for the `left` inset.
        winbox.resize('50%', '100%')
        winbox.move(left + contentWidth - winbox.width, top)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  return (
    <WindowManagerContext.Provider value={{ openWindow, rootRef, openWindows }}>
      {children}
    </WindowManagerContext.Provider>
  )
}

interface WindowViewportProps {
  content: Record<WindowKind, ComponentType>
  children?: ReactNode
}

export function WindowViewport({ content, children }: WindowViewportProps): React.JSX.Element {
  const { rootRef, openWindows } = useWindowManagerContext()

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden">
      {children}
      {openWindows.map(({ kind, container }) =>
        createPortal(createElement(content[kind]), container)
      )}
    </div>
  )
}
