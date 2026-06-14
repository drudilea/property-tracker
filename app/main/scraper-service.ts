import { getSession } from './session';
import type { ScrapeResult } from '../shared/ipc-contract';
import { errorMessage } from './result';

export async function scrapeListing(url: string): Promise<ScrapeResult> {
  console.log('[scrape] start', url);
  try {
    const apartment = await getSession().run((ops) => ops.scrape(url));
    console.log('[scrape] done', apartment.idealistaId);
    return { ok: true, apartment };
  } catch (err) {
    console.error('[scrape] failed', err);
    return { ok: false, error: errorMessage(err) };
  }
}
