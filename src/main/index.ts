import { app, shell, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDb } from './db/client'
import { registerItemsIpcHandlers } from './ipc/items.ipc'
import { registerCategoriesIpcHandlers } from './ipc/categories.ipc'
import { registerMovementsIpcHandlers } from './ipc/movements.ipc'
import { registerUsersIpcHandlers } from './ipc/users.ipc'
import { registerSessionIpcHandlers } from './ipc/session.ipc'
import { seedUser } from './seedUser'

// Once packaged, there's no `electron out/main/seed.js <user> <pass>` path
// available anymore (a packaged app's entry point is fixed to this file) —
// this flag is how an admin account gets provisioned on a machine that only
// has the installed app. `argv.indexOf` (rather than fixed positions) works
// whether this runs as `electron . --seed-user ...` in dev or
// `Ventrack.exe --seed-user ...` once packaged, since the number of
// leading args differs between the two.
function parseSeedUserArgs(argv: string[]): { username: string; password: string } | null {
  const flagIndex = argv.indexOf('--seed-user')
  if (flagIndex === -1) return null
  const [username, password] = argv.slice(flagIndex + 1)
  return username && password ? { username, password } : null
}

// Replaces Electron's default menu (File/Edit/View/Window/Help, aimed at a
// generic Electron scaffold - Undo/Redo/DevTools/a link to electronjs.org)
// with only the items that actually apply to this app. Every item uses
// Electron's built-in role so the accelerator is wired up natively, not
// just decorative.
function buildApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { type: 'separator' },
        { label: 'Close application', role: 'quit', accelerator: 'CmdOrCtrl+Q' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: 'Zoom Out', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: 'Full Screen', role: 'togglefullscreen', accelerator: 'F11' },
        { type: 'separator' },
        { label: 'Reset to Default', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  const seedArgs = parseSeedUserArgs(process.argv)
  if (seedArgs) {
    try {
      await seedUser(join(__dirname, 'db/migrations'), seedArgs.username, seedArgs.password)
      app.exit(0)
    } catch (error) {
      console.error(error)
      app.exit(1)
    }
    return
  }

  buildApplicationMenu()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // `zoom: true` is required or this helper swallows Ctrl+-/Ctrl+Shift+=
  // itself (via preventDefault in a before-input-event handler) before our
  // own menu's Zoom In/Out accelerators ever see the key press.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window, { zoom: true })
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  const db = await getDb(join(__dirname, 'db/migrations')).catch((error) => {
    console.error('Failed to open database', error)
    app.quit()
    return null
  })
  if (!db) return

  registerItemsIpcHandlers(db)
  registerCategoriesIpcHandlers(db)
  registerMovementsIpcHandlers(db)
  registerUsersIpcHandlers(db)
  registerSessionIpcHandlers(db)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
