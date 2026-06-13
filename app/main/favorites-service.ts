import { readFavoriteUrls, scrape, withPage } from '../../src/scraper';
import { configureNotion, findByIdealistaId, saveApartment } from '../../src/notion';
import { loadConfig } from './config';
import { browserMutex } from './scraper-service';
import type { FavoritesSyncResult } from '../shared/ipc-contract';

function extractId(url: string): string {
  return url.match(/\/inmueble\/(\d+)/)?.[1] ?? '';
}

/** Read favorites, skip ones already in Notion, scrape + save the rest.
 * Reuses a single tab for the whole batch (read favorites, then navigate to
 * each new listing) instead of opening/closing a tab per listing. */
export async function syncFavorites(configPath: string): Promise<FavoritesSyncResult> {
  const config = loadConfig(configPath);
  const token = config.notionToken ?? '';
  const dbId = config.notionDatabaseId ?? '';
  if (!token || !dbId) {
    return { ok: false, error: 'Notion no está configurado.', found: 0, created: 0, duplicates: 0, failed: 0 };
  }
  configureNotion(token, dbId);

  try {
    return await browserMutex.run(() =>
      withPage(async (page) => {
        const urls = await readFavoriteUrls(page);
        let created = 0;
        let duplicates = 0;
        let failed = 0;

        for (const url of urls) {
          const id = extractId(url);
          try {
            const existing = id ? await findByIdealistaId(id) : null;
            if (existing) {
              duplicates++;
              continue;
            }
            const apartment = await scrape(url, page);
            await saveApartment(apartment);
            created++;
            console.log('[favorites] saved', id);
          } catch (err) {
            failed++;
            console.error('[favorites] failed', id, err);
          }
        }

        return { ok: true, found: urls.length, created, duplicates, failed };
      }),
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      found: 0,
      created: 0,
      duplicates: 0,
      failed: 0,
    };
  }
}
