import { scrape } from '../../src/scraper';
import type { ScrapeResult } from '../shared/ipc-contract';
import { createMutex } from './mutex';

/** Shared across paste-link and favorites sync — only one scrape touches the
 * browser profile at a time (avoids the persistent-context lock hang). */
export const browserMutex = createMutex();

export async function scrapeListing(url: string): Promise<ScrapeResult> {
  console.log('[scrape] start', url);
  try {
    const apartment = await browserMutex.run(() => scrape(url));
    console.log('[scrape] done', apartment.idealistaId);
    return { ok: true, apartment };
  } catch (err) {
    console.error('[scrape] failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
