import { readFavoriteUrls, scrape, withPage } from '../../src/scraper';
import { browserMutex } from './scraper-service';
import { notionClientFromConfig } from './notion-session';
import type { FavoritesSyncResult } from '../shared/ipc-contract';

function extractId(url: string): string {
  return url.match(/\/inmueble\/(\d+)/)?.[1] ?? '';
}

const emptyError = (error: string): FavoritesSyncResult => ({
  ok: false,
  error,
  found: 0,
  created: 0,
  duplicates: 0,
  failed: 0,
});

/** Read favorites, skip ones already in Notion, scrape + save the rest.
 * Reuses a single tab for the whole batch (read favorites, then navigate to
 * each new listing) instead of opening/closing a tab per listing. */
export async function syncFavorites(
  configPath: string,
): Promise<FavoritesSyncResult> {
  const session = notionClientFromConfig(configPath);
  if (!session.ok) return emptyError(session.error);
  const notion = session.client;

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
            const existing = id ? await notion.findByIdealistaId(id) : null;
            if (existing) {
              duplicates++;
              continue;
            }
            const apartment = await scrape(url, page);
            await notion.save(apartment);
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
    return emptyError(err instanceof Error ? err.message : String(err));
  }
}
