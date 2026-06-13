import type { AppConfig } from '../main/config';

/** IPC channels the renderer may invoke on the main process. */
export const IpcChannel = {
  GetConfig: 'config:get',
  SetConfig: 'config:set',
  GetStatus: 'app:getStatus',
} as const;

/** Event channels the main process pushes to the renderer. */
export const IpcEvent = {
  StatusChanged: 'app:statusChanged',
} as const;

export interface AppStatus {
  appVersion: string;
  configured: boolean;
}

/** The typed API surface exposed to the renderer through the preload bridge. */
export interface RendererApi {
  getConfig(): Promise<AppConfig>;
  setConfig(config: AppConfig): Promise<void>;
  getStatus(): Promise<AppStatus>;
  onStatusChanged(listener: (status: AppStatus) => void): () => void;
}
