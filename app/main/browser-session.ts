import { chromium, type Page, type BrowserContext } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createMutex } from './mutex';
import { parseListing, extractIdealistaId } from './parse-listing';
import type { Apartment } from '../shared/apartment';

const IDEALISTA_HOME_URL = 'https://www.idealista.com/';
const FAVORITES_URL = 'https://www.idealista.com/usuario/favoritos/';

export interface BrowserSessionOptions {
  /** Persistent Chrome profile dir (one Chrome at a time may open it). */
  profileDir: string;
  /** Writable base dir for snapshots + downloaded images. */
  dataDir: string;
}

/** Page-bound operations handed to `run()`. The single tab is reused across a
 * batch (e.g. favorites sync navigates it to each listing in turn). */
export interface ListingOps {
  scrape(url: string): Promise<Apartment>;
  readFavoriteUrls(): Promise<string[]>;
}

/** Owns the one shared persistent Chrome context, the access mutex, and the
 * profile-lock cleanup. The ONLY way to touch the browser is `run()` /
 * `openForLogin()` — both serialize through the mutex, so there is no
 * un-guarded entry point that could reopen the profile and hang. */
export class BrowserSession {
  private context: BrowserContext | null = null;
  private readonly mutex = createMutex();

  constructor(private readonly opts: BrowserSessionOptions) {}

  /** Acquire the lock, open one tab, run `fn` with page-bound ops, close the tab. */
  run<T>(fn: (ops: ListingOps) => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      const context = await this.getContext();
      const page = await context.newPage();
      try {
        return await fn(this.makeOps(page));
      } finally {
        await page.close().catch(() => {});
      }
    });
  }

  /** Open Chrome at the Idealista home so the user can log in, then return and
   * leave the window open (the session is reused by `run`). Serialized. */
  openForLogin(): Promise<void> {
    return this.mutex.run(async () => {
      const context = await this.getContext();
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(IDEALISTA_HOME_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await acceptCookieBanner(page);
    });
  }

  /** Close the shared browser. Call on app quit so no Chrome is orphaned. */
  async close(): Promise<void> {
    const context = this.context;
    this.context = null;
    if (context) await context.close().catch(() => {});
  }

  private makeOps(page: Page): ListingOps {
    const { dataDir } = this.opts;
    return {
      scrape: (url) => scrapeOnPage(page, url, dataDir),
      readFavoriteUrls: () => readFavoriteUrlsOnPage(page),
    };
  }

  private async getContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    await this.clearProfileLocks();
    const context = await chromium.launchPersistentContext(this.opts.profileDir, {
      headless: false,
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      viewport: { width: 1440, height: 900 },
      locale: 'es-ES',
    });
    context.on('close', () => {
      this.context = null;
    });
    this.context = context;
    return context;
  }

  /** Remove stale single-instance lock files left by a crashed Chrome run. */
  private async clearProfileLocks(): Promise<void> {
    for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      await rm(join(this.opts.profileDir, name), { force: true }).catch(() => {});
    }
  }
}

// --- page-bound helpers (private to this module) ---

async function scrapeOnPage(
  page: Page,
  url: string,
  dataDir: string,
): Promise<Apartment> {
  const idealistaId = extractIdealistaId(url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await ensureListingPageReady(page);

  // Reveal the phone BEFORE the snapshot so the saved HTML is a complete
  // fixture (the tel: link is injected by the click) that parseListing can
  // fully reproduce offline.
  await revealPhone(page);
  await saveSnapshot(page, idealistaId, dataDir);

  const apartment = parseListing(await page.content(), url);

  if (apartment.photoUrls.length > 0) {
    console.log(`Downloading ${apartment.photoUrls.length} images...`);
    await downloadImages(apartment.photoUrls, idealistaId, dataDir);
    console.log(`Images saved to ${join(dataDir, 'images', idealistaId)}`);
  }
  return apartment;
}

async function readFavoriteUrlsOnPage(page: Page): Promise<string[]> {
  await page.goto(FAVORITES_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await acceptCookieBanner(page);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  const hasFavorites = await page
    .locator('a[href*="/inmueble/"]')
    .count()
    .then(
      (c) => c > 0,
      () => false,
    );
  if (!hasFavorites) {
    const reason = await getBlockingReason(page);
    if (reason) throw new Error(reason);
    return [];
  }

  const hrefs = await page.$$eval('a[href*="/inmueble/"]', (els) =>
    els.map((el) => (el as HTMLAnchorElement).href),
  );
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const href of hrefs) {
    const match = href.match(/\/inmueble\/(\d+)/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      urls.push(`https://www.idealista.com/inmueble/${match[1]}/`);
    }
  }
  return urls;
}

async function revealPhone(page: Page): Promise<void> {
  try {
    const phoneBtn = await page.$('.see-phones-btn, ._phone_btn');
    if (phoneBtn) {
      await phoneBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch {
    // Phone reveal failed; parseListing will leave contactPhone empty.
  }
}

async function acceptCookieBanner(page: Page): Promise<void> {
  const selectors = [
    '#didomi-notice-agree-button',
    "button:has-text('Aceptar')",
    "button:has-text('Acepto')",
    "button:has-text('Accept')",
    "button:has-text('Entendido')",
    "button:has-text('Estoy de acuerdo')",
  ];
  for (const selector of selectors) {
    const clicked = await page
      .locator(selector)
      .first()
      .click({ timeout: 1500 })
      .then(
        () => true,
        () => false,
      );
    if (clicked) {
      console.log('Cookie banner accepted.');
      await page.waitForTimeout(1000);
      return;
    }
  }
}

async function getBlockingReason(page: Page): Promise<string | null> {
  const currentUrl = page.url();
  const blockedFrameVisible = await page
    .locator("iframe[src*='datadome'], iframe[title*='DataDome']")
    .first()
    .isVisible()
    .catch(() => false);
  if (blockedFrameVisible) {
    return 'Idealista blocked access (DataDome CAPTCHA). Try again later or use a different IP.';
  }

  const bodyText = (
    (await page
      .locator('body')
      .innerText()
      .catch(() => '')) ?? ''
  )
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (
    bodyText.includes('verifica que eres humano') ||
    bodyText.includes('confirma que eres humano') ||
    bodyText.includes('actividad inusual') ||
    currentUrl.includes('challenge') ||
    currentUrl.includes('datadome')
  ) {
    return 'Idealista blocked access (challenge/CAPTCHA). Try again later or use a different IP.';
  }

  const loginFormVisible = await page
    .locator("form[action*='login'], input[type='password']")
    .first()
    .isVisible()
    .catch(() => false);
  if (currentUrl.includes('/login') || loginFormVisible) {
    return [
      'Idealista requires login for this browser profile.',
      'Open the Idealista login from the app, sign in, then retry.',
    ].join(' ');
  }

  const cookieBannerVisible = await page
    .locator('#didomi-notice, .didomi-popup-container, .didomi-consent-popup')
    .first()
    .isVisible()
    .catch(() => false);
  if (cookieBannerVisible) {
    return [
      'Idealista is showing the cookie consent screen for this browser profile.',
      'Open the Idealista login from the app, accept cookies, then retry.',
    ].join(' ');
  }
  return null;
}

async function ensureListingPageReady(page: Page): Promise<void> {
  await acceptCookieBanner(page);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const hasTitle = await page
    .locator('span.main-info__title-main')
    .count()
    .then(
      (count) => count > 0,
      () => false,
    );
  const hasPrice = await page
    .locator('span.info-data-price')
    .count()
    .then(
      (count) => count > 0,
      () => false,
    );
  if (hasTitle || hasPrice) return;

  const blockingReason = await getBlockingReason(page);
  if (blockingReason) throw new Error(blockingReason);

  const pageTitle = await page.title().catch(() => '');
  throw new Error(
    [
      `Could not detect the expected Idealista listing content (current page: ${page.url()}).`,
      pageTitle ? `Browser title: ${pageTitle}.` : null,
      'If this is a new computer, open the Idealista login from the app first.',
    ]
      .filter(Boolean)
      .join(' '),
  );
}

async function saveSnapshot(
  page: Page,
  idealistaId: string,
  dataDir: string,
): Promise<void> {
  const dir = join(dataDir, 'snapshots');
  await mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().split('T')[0];
  await writeFile(join(dir, `${idealistaId}_${timestamp}.html`), await page.content());
}

async function downloadImages(
  urls: string[],
  idealistaId: string,
  dataDir: string,
): Promise<void> {
  const dir = join(dataDir, 'images', idealistaId);
  await mkdir(dir, { recursive: true });
  const downloads = urls.map(async (url, i) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = url.includes('.png') ? 'png' : 'jpg';
      await writeFile(join(dir, `${i + 1}.${ext}`), buffer);
    } catch {
      // Skip failed downloads silently.
    }
  });
  await Promise.all(downloads);
}
