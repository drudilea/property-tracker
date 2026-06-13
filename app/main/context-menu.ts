import { Menu, clipboard } from 'electron';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

/** Install a right-click menu (cut/copy/paste/select-all, and copy-link) so
 * the renderer behaves like a normal app window. */
export function installContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_e, params) => {
    const items: MenuItemConstructorOptions[] = [];

    if (params.linkURL) {
      items.push(
        { label: 'Copiar enlace', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }

    items.push(
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll' },
    );

    Menu.buildFromTemplate(items).popup({ window: win });
  });
}
