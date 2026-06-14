import type { AppConfig } from '../main/config';
import type { Apartment } from './apartment';

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

export interface AppStatus {
  appVersion: string;
  configured: boolean;
}

/** Invoke methods the renderer calls on the main process. Single source for
 * their argument + return types — the preload bridge and RendererApi derive from it. */
export interface IpcInvokeApi {
  getConfig(): Promise<AppConfig>;
  setConfig(config: AppConfig): Promise<void>;
  getStatus(): Promise<AppStatus>;
  scrape(url: string): Promise<ScrapeResult>;
  validateNotion(): Promise<{ ok: boolean; error?: string }>;
  saveToNotion(apartment: Apartment): Promise<NotionSaveResult>;
  syncFavorites(): Promise<FavoritesSyncResult>;
  loginIdealista(): Promise<{ ok: boolean; error?: string }>;
  createVisit(idealistaId: string, startISO: string): Promise<CreateVisitResult>;
  openExternal(url: string): Promise<void>;
  applyTelegram(): Promise<{ ok: boolean; error?: string }>;
  telegramRunning(): Promise<boolean>;
}

/** The invoke channel string for each method. Typed against IpcInvokeApi so
 * every method has exactly one channel (missing/extra keys are a type error). */
export const IpcInvokeChannel: Record<keyof IpcInvokeApi, string> = {
  getConfig: 'config:get',
  setConfig: 'config:set',
  getStatus: 'app:getStatus',
  scrape: 'scrape:url',
  validateNotion: 'notion:validate',
  saveToNotion: 'notion:save',
  syncFavorites: 'favorites:sync',
  loginIdealista: 'idealista:login',
  createVisit: 'visit:create',
  openExternal: 'shell:openExternal',
  applyTelegram: 'telegram:apply',
  telegramRunning: 'telegram:status',
};

/** Event channels the main process pushes to the renderer. */
export const IpcEvent = {
  StatusChanged: 'app:statusChanged',
} as const;

/** The full typed API surface exposed to the renderer (invoke methods + events). */
export interface RendererApi extends IpcInvokeApi {
  onStatusChanged(listener: (status: AppStatus) => void): () => void;
}
