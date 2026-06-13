import { scrape } from '../../src/scraper';
import type { ScrapeResult } from '../shared/ipc-contract';

/** Scrape one Idealista listing, returning a typed success/error result. */
export async function scrapeListing(url: string): Promise<ScrapeResult> {
  console.log('[scrape] start', url);
  try {
    const apartment = await scrape(url);
    console.log('[scrape] done', apartment.idealistaId);
    return { ok: true, apartment };
  } catch (err) {
    console.error('[scrape] failed', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
