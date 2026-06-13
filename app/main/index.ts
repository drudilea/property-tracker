import { app, BrowserWindow } from 'electron';
import type { Tray } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc';
import { createTray } from './tray';
import { installContextMenu } from './context-menu';
import { closeBrowser, configureScraperPaths } from '../../src/scraper';
import appIconPath from './assets/icon.png?asset';

const CONFIG_PATH = join(app.getPath('userData'), 'config.json');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 560,
    show: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow = win;
  installContextMenu(win);
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  return win;
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  configureScraperPaths({
    dataDir: join(userData, 'data'),
    browserProfileDir: join(userData, '.browser-profile'),
  });

  // In dev the dock shows the default Electron icon; set ours. (Packaged builds
  // get the icon from electron-builder.)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(appIconPath);
  }
  registerIpcHandlers(CONFIG_PATH);
  createWindow();
  tray = createTray(() => mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  void closeBrowser();
});
