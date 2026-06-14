import { createNotionClient, type NotionClient } from '../../src/notion';
import { loadConfig } from './config';

let cached: { token: string; dbId: string; client: NotionClient } | null = null;

export type NotionClientResult =
  | { ok: true; client: NotionClient }
  | { ok: false; error: string };

/** Get a Notion client for the configured token + database, memoized so the
 * schema check runs once per token/db. Returns a typed error when Notion isn't
 * configured — the single place that "not configured" check lives. */
export function notionClientFromConfig(configPath: string): NotionClientResult {
  const config = loadConfig(configPath);
  const token = config.notionToken ?? '';
  const dbId = config.notionDatabaseId ?? '';
  if (!token || !dbId) {
    return {
      ok: false,
      error: 'Notion no está configurado (falta token o database id).',
    };
  }
  if (!cached || cached.token !== token || cached.dbId !== dbId) {
    cached = { token, dbId, client: createNotionClient(token, dbId) };
  }
  return { ok: true, client: cached.client };
}
