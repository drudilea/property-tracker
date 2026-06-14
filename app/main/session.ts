import { BrowserSession } from './browser-session';

let session: BrowserSession | null = null;

/** Build the one app-wide BrowserSession. Call once at app startup. */
export function configureSession(opts: {
  profileDir: string;
  dataDir: string;
}): BrowserSession {
  session = new BrowserSession(opts);
  return session;
}

/** The app-wide session. Throws if accessed before configureSession(). */
export function getSession(): BrowserSession {
  if (!session) throw new Error('BrowserSession not configured yet.');
  return session;
}

/** Close the session if it was configured; no-op otherwise (safe to call on quit). */
export function closeSessionIfConfigured(): Promise<void> {
  return session ? session.close() : Promise.resolve();
}
