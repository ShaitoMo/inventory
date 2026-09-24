import {
  ArrowLeftRight,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  Users,
  type LucideIcon
} from 'lucide-react'

export type WindowKind = 'dashboard' | 'items' | 'categories' | 'movements' | 'users' | 'settings'

export const WINDOW_DEFS: Record<WindowKind, { title: string; icon: LucideIcon }> = {
  dashboard: { title: 'Dashboard', icon: LayoutDashboard },
  items: { title: 'Items', icon: Package },
  categories: { title: 'Categories', icon: Tags },
  movements: { title: 'Movements', icon: ArrowLeftRight },
  users: { title: 'Users', icon: Users },
  settings: { title: 'Settings', icon: Settings }
}

export const WINDOW_ORDER: WindowKind[] = [
  'dashboard',
  'items',
  'categories',
  'movements',
  'users',
  'settings'
]
