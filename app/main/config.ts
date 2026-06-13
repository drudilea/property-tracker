import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Local app configuration; replaces the old .env. Stored in userData. */
export interface AppConfig {
  notionToken: string | null;
  notionDatabaseId: string | null;
  browserProfileDir: string | null;
  pollIntervalMinutes: number;
  launchOnStartup: boolean;
  telegramBotToken: string | null;
  telegramAllowedUserId: number | null;
}

export const DEFAULT_CONFIG: AppConfig = {
  notionToken: null,
  notionDatabaseId: null,
  browserProfileDir: null,
  pollIntervalMinutes: 15,
  launchOnStartup: false,
  telegramBotToken: null,
  telegramAllowedUserId: null,
};

/** Load config from disk, merging a partial/missing/corrupt file over defaults. */
export function loadConfig(filePath: string): AppConfig {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Persist config to disk, creating the parent directory if needed. */
export function saveConfig(filePath: string, config: AppConfig): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
}
