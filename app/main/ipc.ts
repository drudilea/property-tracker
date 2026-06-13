import { app, ipcMain } from 'electron';
import { IpcChannel } from '../shared/ipc-contract';
import type { AppStatus } from '../shared/ipc-contract';
import { loadConfig, saveConfig } from './config';
import type { AppConfig } from './config';

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
}
