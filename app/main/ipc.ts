import { app, ipcMain, shell } from 'electron';
import { IpcInvokeChannel } from '../shared/ipc-contract';
import { scrapeListing } from './scraper-service';
import type { AppStatus } from '../shared/ipc-contract';
import { loadConfig, saveConfig } from './config';
import type { AppConfig } from './config';
import { validateNotion, saveToNotion } from './notion-service';
import { syncFavorites } from './favorites-service';
import { loginIdealista } from './idealista-service';
import { createVisit } from './visit-service';
import { startTelegramBot, isTelegramRunning } from './telegram-service';
import type { Apartment } from '../shared/apartment';

/** Register all ipcMain handlers. `configPath` is resolved once at startup. */
export function registerIpcHandlers(configPath: string): void {
  ipcMain.handle(IpcInvokeChannel.getConfig, (): AppConfig => loadConfig(configPath));

  ipcMain.handle(IpcInvokeChannel.setConfig, (_e, config: AppConfig): void => {
    saveConfig(configPath, config);
  });

  ipcMain.handle(IpcInvokeChannel.getStatus, (): AppStatus => {
    const config = loadConfig(configPath);
    return {
      appVersion: app.getVersion(),
      configured: Boolean(config.notionToken && config.notionDatabaseId),
    };
  });

  ipcMain.handle(IpcInvokeChannel.scrape, (_e, url: string) => scrapeListing(url));

  ipcMain.handle(IpcInvokeChannel.validateNotion, () => validateNotion(configPath));
  ipcMain.handle(IpcInvokeChannel.saveToNotion, (_e, apartment: Apartment) =>
    saveToNotion(configPath, apartment),
  );

  ipcMain.handle(IpcInvokeChannel.syncFavorites, () => syncFavorites(configPath));

  ipcMain.handle(IpcInvokeChannel.loginIdealista, () => loginIdealista());

  ipcMain.handle(
    IpcInvokeChannel.createVisit,
    (_e, idealistaId: string, startISO: string) =>
      createVisit(configPath, idealistaId, startISO),
  );

  ipcMain.handle(IpcInvokeChannel.openExternal, (_e, url: string) =>
    shell.openExternal(url),
  );

  ipcMain.handle(IpcInvokeChannel.applyTelegram, () => startTelegramBot(configPath));
  ipcMain.handle(IpcInvokeChannel.telegramRunning, () => isTelegramRunning());
}
