import { app, ipcMain } from 'electron';
import { IpcChannel } from '../shared/ipc-contract';
import { scrapeListing } from './scraper-service';
import type { AppStatus } from '../shared/ipc-contract';
import { loadConfig, saveConfig } from './config';
import type { AppConfig } from './config';
import { validateNotion, saveToNotion } from './notion-service';
import { syncFavorites } from './favorites-service';
import { loginIdealista } from './idealista-service';
import type { Apartment } from '../../src/types';

/** Register all ipcMain handlers. `configPath` is resolved once at startup. */
export function registerIpcHandlers(configPath: string): void {
  ipcMain.handle(IpcChannel.GetConfig, (): AppConfig => loadConfig(configPath));

  ipcMain.handle(IpcChannel.SetConfig, (_e, config: AppConfig): void => {
    saveConfig(configPath, config);
  });

  ipcMain.handle(IpcChannel.GetStatus, (): AppStatus => {
    const config = loadConfig(configPath);
    return {
      appVersion: app.getVersion(),
      configured: Boolean(config.notionToken && config.notionDatabaseId),
    };
  });

  ipcMain.handle(IpcChannel.Scrape, (_e, url: string) => scrapeListing(url));

  ipcMain.handle(IpcChannel.NotionValidate, () => validateNotion(configPath));
  ipcMain.handle(IpcChannel.NotionSave, (_e, apartment: Apartment) => saveToNotion(configPath, apartment));

  ipcMain.handle(IpcChannel.FavoritesSync, () => syncFavorites(configPath));

  ipcMain.handle(IpcChannel.IdealistaLogin, () => loginIdealista());
}
