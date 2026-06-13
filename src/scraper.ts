import { chromium, type Page, type BrowserContext } from 'playwright';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import type { Apartment } from './types.js';

// Writable locations. Default to cwd (legacy CLI); the Electron app overrides
// these with app.getPath('userData') via configureScraperPaths().
let dataDir = join(process.cwd(), 'data');
let browserProfileDir = join(process.cwd(), '.browser-profile');

const imagesDir = () => join(dataDir, 'images');
const snapshotsDir = () => join(dataDir, 'snapshots');

/** Set writable paths at runtime (Electron passes userData-based dirs). */
export function configureScraperPaths(opts: {
  dataDir?: string;
  browserProfileDir?: string;
}): void {
  if (opts.dataDir) dataDir = opts.dataDir;
  if (opts.browserProfileDir) browserProfileDir = opts.browserProfileDir;
}
const IDEALISTA_HOME_URL = 'https://www.idealista.com/';
const FAVORITES_URL = 'https://www.idealista.com/usuario/favoritos/';

function extractIdealistaId(url: string): string {
  const match = url.match(/\/inmueble\/(\d+)/);
  if (!match) throw new Error(`Could not extract idealista ID from: ${url}`);
  return match[1];
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
}

function parseNumber(text: string): number | null {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function extractPhotos(page: Page): Promise<string[]> {
  const content = await page.content();

  // The fullScreenGalleryPics object uses unquoted keys (not valid JSON),
  // so we extract imageDataService URLs directly via regex.
  const galleryMatch = content.match(/fullScreenGalleryPics\s*:\s*\[.+?\]/s);
  if (!galleryMatch) return [];

  const urlRegex = /imageDataService:"(https?:\/\/[^"]+\.jpg)"/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(galleryMatch[0])) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

async function downloadImages(
  urls: string[],
  idealistaId: string,
): Promise<void> {
  const dir = join(imagesDir(), idealistaId);
  await mkdir(dir, { recursive: true });

  const downloads = urls.map(async (url, i) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = url.includes('.png') ? 'png' : 'jpg';
      await writeFile(join(dir, `${i + 1}.${ext}`), buffer);
    } catch {
      // Skip failed downloads silently
    }
  });

  await Promise.all(downloads);
}

async function saveSnapshot(page: Page, idealistaId: string): Promise<void> {
  await mkdir(snapshotsDir(), { recursive: true });
  const html = await page.content();
  const timestamp = new Date().toISOString().split('T')[0];
  await writeFile(
    join(snapshotsDir(), `${idealistaId}_${timestamp}.html`),
    html,
  );
}

function hasFeature(features: string[], ...keywords: string[]): boolean | null {
  const text = features.join(' ').toLowerCase();
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) return true;
  }
  return null;
}

function extractHeatingType(features: string[]): string | null {
  const text = features.join(' ').toLowerCase();
  if (text.includes('calefacción individual: gas')) return 'gas';
  if (text.includes('calefacción central: gas')) return 'gas central';
  if (text.includes('calefacción individual: eléctric')) return 'eléctrica';
  if (text.includes('calefacción central: eléctric'))
    return 'eléctrica central';
  if (text.includes('calefacción')) return 'sí (tipo desconocido)';
  if (text.includes('no dispone de calefacción')) return 'no tiene';
  return null;
}

function extractFloor(features: string[]): string | null {
  for (const f of features) {
    // Matches patterns like "1ª planta", "Bajo", "Entreplanta", "Planta 3ª"
    const lower = f.toLowerCase();
    if (
      lower.includes('planta') ||
      lower === 'bajo' ||
      lower === 'entreplanta' ||
      lower === 'sótano'
    ) {
      return f.trim();
    }
  }
  return null;
}

function launchContext(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(browserProfileDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    viewport: { width: 1440, height: 900 },
    locale: 'es-ES',
  });
}

/** Remove stale single-instance lock files left by a crashed Chrome run. */
async function clearProfileLocks(): Promise<void> {
  for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    await rm(join(browserProfileDir, name), { force: true }).catch(() => {});
  }
}

// One shared browser context, reused by login/scrape/favorites so the profile
// is never opened twice at once (avoids the ProcessSingleton lock conflict).
let sharedContext: BrowserContext | null = null;

async function getContext(): Promise<BrowserContext> {
  if (sharedContext) return sharedContext;
  await clearProfileLocks();
  const context = await launchContext();
  context.on('close', () => {
    sharedContext = null;
  });
  sharedContext = context;
  return context;
}

/** Close the shared browser. Call on app quit so no Chrome is orphaned. */
export async function closeBrowser(): Promise<void> {
  const context = sharedContext;
  sharedContext = null;
  if (context) await context.close().catch(() => {});
}

/** Run a function with a fresh page on the shared context, closing it after.
 * Lets a batch (e.g. favorites sync) reuse one tab across many listings. */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await getContext();
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
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
      'Run the browser initialization once in this same folder, sign in if needed, then close Chrome and retry.',
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
      'Run the browser initialization once in this same folder, accept cookies, then close Chrome and retry.',
    ].join(' ');
  }

  return null;
}

async function ensureListingPageReady(page: Page): Promise<void> {
  await acceptCookieBanner(page);
  await page
    .waitForLoadState('networkidle', { timeout: 10000 })
    .catch(() => {});
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

  if (hasTitle || hasPrice) {
    return;
  }

  const blockingReason = await getBlockingReason(page);
  if (blockingReason) {
    throw new Error(blockingReason);
  }

  const pageTitle = await page.title().catch(() => '');
  throw new Error(
    [
      `Could not detect the expected Idealista listing content (current page: ${page.url()}).`,
      pageTitle ? `Browser title: ${pageTitle}.` : null,
      'If this is a new portable folder or a different computer, initialize the browser profile in this same folder first.',
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/** Read the user's Idealista favorites and return the listing URLs (deduped). */
export async function readFavoriteUrls(existingPage?: Page): Promise<string[]> {
  const context = existingPage ? null : await getContext();
  const page = existingPage ?? (await context!.newPage());
  try {
    await page.goto(FAVORITES_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await acceptCookieBanner(page);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const hasFavorites = await page
      .locator('a[href*="/inmueble/"]')
      .count()
      .then((c) => c > 0, () => false);

    if (!hasFavorites) {
      const blockingReason = await getBlockingReason(page);
      if (blockingReason) throw new Error(blockingReason);
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
  } finally {
    if (!existingPage) await page.close().catch(() => {});
  }
}

/** Open the shared browser at Idealista so the user can log in. By default it
 * returns once the page is ready and leaves the window open (the session is
 * reused by scrape/favorites). Pass waitForClose for the legacy CLI flow. */
export async function initializeBrowserProfile(options?: {
  waitForClose?: boolean;
}): Promise<void> {
  const context = await getContext();
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(IDEALISTA_HOME_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await acceptCookieBanner(page);

  if (options?.waitForClose) {
    await context.waitForEvent('close', { timeout: 0 });
  }
}

export async function scrape(url: string, existingPage?: Page): Promise<Apartment> {
  const idealistaId = extractIdealistaId(url);

  // Reuse the shared persistent context (real Chrome) to avoid anti-bot
  // detection. When given an existing page (tab), reuse it instead of opening a
  // new one — favorites sync passes one page to navigate across many listings.
  const context = existingPage ? null : await getContext();
  const page = existingPage ?? (await context!.newPage());

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await ensureListingPageReady(page);

    // Save HTML snapshot for offline testing
    await saveSnapshot(page, idealistaId);

    // Title
    const titleEl = await page.$('span.main-info__title-main');
    const title = titleEl ? ((await titleEl.textContent())?.trim() ?? '') : '';

    // Price
    const priceEl = await page.$('span.info-data-price');
    const priceText = priceEl
      ? ((await priceEl.textContent())?.trim() ?? '')
      : '';
    const price = parsePrice(priceText);

    // Location
    const locationParts = await page
      .$$eval('li.header-map-list', (els) =>
        els.map((el) => el.textContent?.trim()).filter(Boolean),
      )
      .catch(() => [] as string[]);
    const minorEl = await page.$('span.main-info__title-minor');
    const location =
      locationParts.join(', ') ||
      (minorEl ? ((await minorEl.textContent())?.trim() ?? '') : '');

    // Description — preserve line breaks from the original HTML
    const description = await page
      .$eval('div.comment', (el) => {
        const html = el.innerHTML;
        return html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      })
      .catch(() => '');

    // Top-level features (rooms, sqm)
    const infoFeatures = await page.$$eval('div.info-features span', (els) =>
      els.map((el) => el.textContent?.trim() ?? ''),
    );
    const rooms = parseNumber(
      infoFeatures.find((f) => f.includes('hab')) ?? '',
    );
    const squareMeters = parseNumber(
      infoFeatures.find((f) => f.includes('m²')) ?? '',
    );

    // Detailed features list
    const allFeatures = await page.$$eval(
      '.details-property-feature-one li, .details-property_features li',
      (els) => els.map((el) => el.textContent?.trim() ?? ''),
    );

    // Contact info — use $() to avoid 30s timeouts on missing elements
    let contactPhone = '';
    let contactName = '';

    try {
      // Agency: name is in a.about-advertiser-name
      // Private: name is in span.particular
      const agencyEl = await page.$('a.about-advertiser-name');
      const particularEl = await page.$('span.particular');

      if (agencyEl) {
        contactName = (await agencyEl.textContent())?.trim() ?? '';
      } else if (particularEl) {
        contactName = (await particularEl.textContent())?.trim() ?? '';
      }

      // Clean up whitespace artifacts
      contactName = contactName.replace(/\s+/g, ' ').trim();
    } catch {
      // Contact name extraction failed
    }

    // Detect advertiser type
    const typeLabel = await page
      .$eval(
        '.professional-name .name',
        (el) => el.textContent?.trim().toLowerCase() ?? '',
      )
      .catch(() => '');
    const contactType: 'particular' | 'inmobiliaria' | null =
      typeLabel.includes('particular')
        ? 'particular'
        : typeLabel.includes('profesional')
          ? 'inmobiliaria'
          : null;

    try {
      const phoneBtn = await page.$('.see-phones-btn, ._phone_btn');
      if (phoneBtn) {
        await phoneBtn.click();
        await page.waitForTimeout(1500);
      }
      const phoneEl = await page.$("a[href^='tel:']");
      if (phoneEl) {
        const href = await phoneEl.getAttribute('href');
        contactPhone = href?.replace('tel:', '') ?? '';
      }
      if (!contactPhone) {
        const phoneTextEl = await page.$('.hidden-contact-phones_text');
        if (phoneTextEl) {
          contactPhone = (await phoneTextEl.textContent())?.trim() ?? '';
        }
      }
    } catch {
      // Phone extraction failed, continue without it
    }

    // Photos
    const photoUrls = await extractPhotos(page);

    // Download images for offline persistence
    if (photoUrls.length > 0) {
      console.log(`Downloading ${photoUrls.length} images...`);
      await downloadImages(photoUrls, idealistaId);
      console.log(`Images saved to ./data/images/${idealistaId}/`);
    }

    const apartment: Apartment = {
      idealistaId,
      url,
      title,
      price,
      location,
      description,
      rooms,
      squareMeters,
      floor: extractFloor([...infoFeatures, ...allFeatures]),
      contactName,
      contactPhone,
      contactType,
      photoUrls,
      elevator: hasFeature(allFeatures, 'ascensor'),
      airConditioning: hasFeature(allFeatures, 'aire acondicionado'),
      heating: extractHeatingType(allFeatures),
      naturalGas: hasFeature(allFeatures, 'gas natural'),
      pool: hasFeature(allFeatures, 'piscina'),
      parking: hasFeature(allFeatures, 'garaje', 'parking'),
      storageRoom: hasFeature(allFeatures, 'trastero'),
    };

    return apartment;
  } finally {
    if (!existingPage) await page.close().catch(() => {});
  }
}
