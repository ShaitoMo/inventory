import type { WindowKind } from './types'
import Dashboard from './Dashboard'
import ItemsWindow from './ItemsWindow'
import CategoriesWindow from './CategoriesWindow'
import MovementsWindow from './MovementsWindow'
import UsersWindow from './UsersWindow'
import SettingsWindow from './SettingsWindow'

export const WINDOW_CONTENT: Record<WindowKind, React.ComponentType> = {
  dashboard: Dashboard,
  items: ItemsWindow,
  categories: CategoriesWindow,
  movements: MovementsWindow,
  users: UsersWindow,
  settings: SettingsWindow
}
