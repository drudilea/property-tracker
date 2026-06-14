import { getSession } from './session';
import { errorMessage } from './result';

/** Open Chrome with the dedicated profile so the user can log in to Idealista.
 * Returns once the page is ready, leaving the window open for reuse. */
export async function loginIdealista(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getSession().openForLogin();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
