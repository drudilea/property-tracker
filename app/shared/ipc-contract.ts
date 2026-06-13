import type { AppConfig } from '../main/config';
import type { Apartment } from '../../src/types';

export type ScrapeResult =
  | { ok: true; apartment: Apartment }
  | { ok: false; error: string };

/** IPC channels the renderer may invoke on the main process. */
export const IpcChannel = {
  GetConfig: 'config:get',
  SetConfig: 'config:set',
  GetStatus: 'app:getStatus',
  Scrape: 'scrape:url',
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
  scrape(url: string): Promise<ScrapeResult>;
  onStatusChanged(listener: (status: AppStatus) => void): () => void;
}
