import type { AppConfig } from '../main/config';
import type { Apartment } from '../../src/types';

export type ScrapeResult =
  | { ok: true; apartment: Apartment }
  | { ok: false; error: string };

export type NotionSaveResult =
  | { ok: true; status: 'created' | 'duplicate'; pageId: string; url: string }
  | { ok: false; error: string };

export interface FavoritesSyncResult {
  ok: boolean;
  error?: string;
  found: number;
  created: number;
  duplicates: number;
  failed: number;
}

export type CreateVisitResult =
  | { ok: true; url: string; title: string }
  | { ok: false; error: string };

/** IPC channels the renderer may invoke on the main process. */
export const IpcChannel = {
  GetConfig: 'config:get',
  SetConfig: 'config:set',
  GetStatus: 'app:getStatus',
  Scrape: 'scrape:url',
  NotionValidate: 'notion:validate',
  NotionSave: 'notion:save',
  FavoritesSync: 'favorites:sync',
  IdealistaLogin: 'idealista:login',
  CreateVisit: 'visit:create',
  OpenExternal: 'shell:openExternal',
  TelegramApply: 'telegram:apply',
  TelegramStatus: 'telegram:status',
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
  validateNotion(): Promise<{ ok: boolean; error?: string }>;
  saveToNotion(apartment: Apartment): Promise<NotionSaveResult>;
  syncFavorites(): Promise<FavoritesSyncResult>;
  loginIdealista(): Promise<{ ok: boolean; error?: string }>;
  createVisit(
    idealistaId: string,
    startISO: string,
  ): Promise<CreateVisitResult>;
  openExternal(url: string): Promise<void>;
  applyTelegram(): Promise<{ ok: boolean; error?: string }>;
  telegramRunning(): Promise<boolean>;
  onStatusChanged(listener: (status: AppStatus) => void): () => void;
}
