import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron';
import trayIconPath from './assets/tray-icon.png?asset';

/** Create the system tray. Keeps a reference so it is not garbage-collected. */
export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const icon = nativeImage.createFromPath(trayIconPath);
  const tray = new Tray(icon);
  tray.setToolTip('Idealista Tracker');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        const win = getWindow();
        if (win) win.show();
      },
    },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  return tray;
}
