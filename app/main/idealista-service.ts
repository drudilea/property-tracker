import { initializeBrowserProfile } from '../../src/scraper';
import { browserMutex } from './scraper-service';

/** Open Chrome with the dedicated profile so the user can log in to Idealista.
 * Blocks (no timeout) until the user closes the Chrome window. */
export async function loginIdealista(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await browserMutex.run(() => initializeBrowserProfile());
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
