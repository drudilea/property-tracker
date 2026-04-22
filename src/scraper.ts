import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { Apartment } from "./types.js";

const DATA_DIR = join(process.cwd(), "data");
const IMAGES_DIR = join(DATA_DIR, "images");
const SNAPSHOTS_DIR = join(DATA_DIR, "snapshots");
const BROWSER_PROFILE_DIR = join(process.cwd(), ".browser-profile");

function extractIdealistaId(url: string): string {
  const match = url.match(/\/inmueble\/(\d+)/);
  if (!match) throw new Error(`Could not extract idealista ID from: ${url}`);
  return match[1];
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d]/g, "");
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
  const galleryMatch = content.match(
    /fullScreenGalleryPics\s*:\s*\[.+?\]/s
  );
  if (!galleryMatch) return [];

  const urlRegex = /imageDataService:"(https?:\/\/[^"]+\.jpg)"/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(galleryMatch[0])) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

async function downloadImages(urls: string[], idealistaId: string): Promise<void> {
  const dir = join(IMAGES_DIR, idealistaId);
  await mkdir(dir, { recursive: true });

  const downloads = urls.map(async (url, i) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = url.includes(".png") ? "png" : "jpg";
      await writeFile(join(dir, `${i + 1}.${ext}`), buffer);
    } catch {
      // Skip failed downloads silently
    }
  });

  await Promise.all(downloads);
}

async function saveSnapshot(page: Page, idealistaId: string): Promise<void> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  const html = await page.content();
  const timestamp = new Date().toISOString().split("T")[0];
  await writeFile(
    join(SNAPSHOTS_DIR, `${idealistaId}_${timestamp}.html`),
    html
  );
}

function hasFeature(features: string[], ...keywords: string[]): boolean | null {
  const text = features.join(" ").toLowerCase();
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) return true;
  }
  return null;
}

function extractHeatingType(features: string[]): string | null {
  const text = features.join(" ").toLowerCase();
  if (text.includes("calefacción individual: gas")) return "gas";
  if (text.includes("calefacción central: gas")) return "gas central";
  if (text.includes("calefacción individual: eléctric")) return "eléctrica";
  if (text.includes("calefacción central: eléctric")) return "eléctrica central";
  if (text.includes("calefacción")) return "sí (tipo desconocido)";
  if (text.includes("no dispone de calefacción")) return "no tiene";
  return null;
}

function extractFloor(features: string[]): string | null {
  for (const f of features) {
    // Matches patterns like "1ª planta", "Bajo", "Entreplanta", "Planta 3ª"
    const lower = f.toLowerCase();
    if (
      lower.includes("planta") ||
      lower === "bajo" ||
      lower === "entreplanta" ||
      lower === "sótano"
    ) {
      return f.trim();
    }
  }
  return null;
}

export async function scrape(url: string): Promise<Apartment> {
  const idealistaId = extractIdealistaId(url);

  // Use persistent context with real Chrome to avoid anti-bot detection.
  // First run may require manual login to idealista.
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
    viewport: { width: 1440, height: 900 },
    locale: "es-ES",
  });

  const page = context.pages()[0] ?? await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for dynamic content to render
    await page.waitForTimeout(2000);

    // Check for CAPTCHA/block
    const blocked = await page.$("iframe[src*='datadome']");
    if (blocked) {
      throw new Error(
        "Idealista blocked access (DataDome CAPTCHA). Try again later or use a different IP."
      );
    }

    // Save HTML snapshot for offline testing
    await saveSnapshot(page, idealistaId);

    // Title
    const titleEl = await page.$("span.main-info__title-main");
    const title = titleEl ? (await titleEl.textContent())?.trim() ?? "" : "";

    // Price
    const priceEl = await page.$("span.info-data-price");
    const priceText = priceEl ? (await priceEl.textContent())?.trim() ?? "" : "";
    const price = parsePrice(priceText);

    // Location
    const locationParts = await page.$$eval(
      "li.header-map-list",
      (els) => els.map((el) => el.textContent?.trim()).filter(Boolean)
    ).catch(() => [] as string[]);
    const minorEl = await page.$("span.main-info__title-minor");
    const location = locationParts.join(", ") ||
      (minorEl ? (await minorEl.textContent())?.trim() ?? "" : "");

    // Description — preserve line breaks from the original HTML
    const description = await page.$eval("div.comment", (el) => {
      const html = el.innerHTML;
      return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }).catch(() => "");

    // Top-level features (rooms, sqm)
    const infoFeatures = await page.$$eval(
      "div.info-features span",
      (els) => els.map((el) => el.textContent?.trim() ?? "")
    );
    const rooms = parseNumber(
      infoFeatures.find((f) => f.includes("hab")) ?? ""
    );
    const squareMeters = parseNumber(
      infoFeatures.find((f) => f.includes("m²")) ?? ""
    );

    // Detailed features list
    const allFeatures = await page.$$eval(
      ".details-property-feature-one li, .details-property_features li",
      (els) => els.map((el) => el.textContent?.trim() ?? "")
    );

    // Contact info — use $() to avoid 30s timeouts on missing elements
    let contactPhone = "";
    let contactName = "";

    try {
      // Agency: name is in a.about-advertiser-name
      // Private: name is in span.particular
      const agencyEl = await page.$("a.about-advertiser-name");
      const particularEl = await page.$("span.particular");

      if (agencyEl) {
        contactName = (await agencyEl.textContent())?.trim() ?? "";
      } else if (particularEl) {
        contactName = (await particularEl.textContent())?.trim() ?? "";
      }

      // Clean up whitespace artifacts
      contactName = contactName.replace(/\s+/g, " ").trim();
    } catch {
      // Contact name extraction failed
    }

    // Detect advertiser type
    const typeLabel = await page.$eval(
      ".professional-name .name",
      (el) => el.textContent?.trim().toLowerCase() ?? ""
    ).catch(() => "");
    const contactType: "particular" | "inmobiliaria" | null =
      typeLabel.includes("particular") ? "particular" :
      typeLabel.includes("profesional") ? "inmobiliaria" :
      null;

    try {
      const phoneBtn = await page.$(".see-phones-btn, ._phone_btn");
      if (phoneBtn) {
        await phoneBtn.click();
        await page.waitForTimeout(1500);
      }
      const phoneEl = await page.$("a[href^='tel:']");
      if (phoneEl) {
        const href = await phoneEl.getAttribute("href");
        contactPhone = href?.replace("tel:", "") ?? "";
      }
      if (!contactPhone) {
        const phoneTextEl = await page.$(".hidden-contact-phones_text");
        if (phoneTextEl) {
          contactPhone = (await phoneTextEl.textContent())?.trim() ?? "";
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
      elevator: hasFeature(allFeatures, "ascensor"),
      airConditioning: hasFeature(allFeatures, "aire acondicionado"),
      heating: extractHeatingType(allFeatures),
      naturalGas: hasFeature(allFeatures, "gas natural"),
      pool: hasFeature(allFeatures, "piscina"),
      parking: hasFeature(allFeatures, "garaje", "parking"),
      storageRoom: hasFeature(allFeatures, "trastero"),
    };

    return apartment;
  } finally {
    await context.close();
  }
}
