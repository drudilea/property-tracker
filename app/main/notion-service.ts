import { configureNotion, validateToken, saveApartment, buildNotionUrl } from '../../src/notion';
import type { Apartment } from '../../src/types';
import type { NotionSaveResult } from '../shared/ipc-contract';
import { loadConfig } from './config';

/** Push the current saved config into the Notion client. */
function applyConfig(configPath: string): { token: string; dbId: string } {
  const config = loadConfig(configPath);
  const token = config.notionToken ?? '';
  const dbId = config.notionDatabaseId ?? '';
  configureNotion(token, dbId);
  return { token, dbId };
}

/** Validate the token currently stored in config (via /users/me). */
export async function validateNotion(configPath: string): Promise<{ ok: boolean; error?: string }> {
  const { token } = applyConfig(configPath);
  if (!token) return { ok: false, error: 'Falta el token de Notion.' };
  return validateToken(token);
}

/** Save a scraped apartment to the configured Notion database. */
export async function saveToNotion(configPath: string, apartment: Apartment): Promise<NotionSaveResult> {
  const { token, dbId } = applyConfig(configPath);
  if (!token || !dbId) {
    return { ok: false, error: 'Notion no está configurado (falta token o database id).' };
  }
  try {
    const result = await saveApartment(apartment);
    return { ok: true, status: result.status, pageId: result.pageId, url: buildNotionUrl(result.pageId) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
