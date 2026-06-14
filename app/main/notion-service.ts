import { validateToken, buildNotionUrl } from '../../src/notion';
import type { Apartment } from '../../src/types';
import type { NotionSaveResult } from '../shared/ipc-contract';
import { loadConfig } from './config';
import { notionClientFromConfig } from './notion-session';

/** Validate the token currently stored in config (via /users/me). */
export async function validateNotion(
  configPath: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = loadConfig(configPath).notionToken ?? '';
  if (!token) return { ok: false, error: 'Falta el token de Notion.' };
  return validateToken(token);
}

/** Save a scraped apartment to the configured Notion database. */
export async function saveToNotion(
  configPath: string,
  apartment: Apartment,
): Promise<NotionSaveResult> {
  const session = notionClientFromConfig(configPath);
  if (!session.ok) return { ok: false, error: session.error };
  try {
    const result = await session.client.save(apartment);
    return {
      ok: true,
      status: result.status,
      pageId: result.pageId,
      url: buildNotionUrl(result.pageId),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
