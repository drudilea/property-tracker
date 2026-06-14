import * as cheerio from 'cheerio';
import type { Apartment } from '../shared/apartment';

export function extractIdealistaId(url: string): string {
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
  if (text.includes('calefacción central: eléctric')) return 'eléctrica central';
  if (text.includes('calefacción')) return 'sí (tipo desconocido)';
  if (text.includes('no dispone de calefacción')) return 'no tiene';
  return null;
}

function extractFloor(features: string[]): string | null {
  for (const f of features) {
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

function extractPhotos(html: string): string[] {
  // fullScreenGalleryPics uses unquoted keys (not valid JSON), so we pull the
  // imageDataService URLs directly via regex over the page HTML.
  const galleryMatch = html.match(/fullScreenGalleryPics\s*:\s*\[.+?\]/s);
  if (!galleryMatch) return [];

  const urlRegex = /imageDataService:"(https?:\/\/[^"]+\.jpg)"/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(galleryMatch[0])) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function cleanDescription(commentHtml: string): string {
  return commentHtml
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
}

/** Extract an Apartment from a listing page's HTML. Pure: no browser, no IO.
 * Expects the HTML captured AFTER the phone-reveal click so the tel: link is present. */
export function parseListing(html: string, url: string): Apartment {
  const $ = cheerio.load(html);
  const idealistaId = extractIdealistaId(url);

  const title = $('span.main-info__title-main').first().text().trim();

  const price = parsePrice($('span.info-data-price').first().text().trim());

  const locationParts = $('li.header-map-list')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const location =
    locationParts.join(', ') ||
    $('span.main-info__title-minor').first().text().trim();

  const description = cleanDescription($('div.comment').first().html() ?? '');

  const infoFeatures = $('div.info-features span')
    .map((_, el) => $(el).text().trim())
    .get();
  const rooms = parseNumber(infoFeatures.find((f) => f.includes('hab')) ?? '');
  const squareMeters = parseNumber(
    infoFeatures.find((f) => f.includes('m²')) ?? '',
  );

  const allFeatures = $(
    '.details-property-feature-one li, .details-property_features li',
  )
    .map((_, el) => $(el).text().trim())
    .get();

  const agency = $('a.about-advertiser-name').first();
  const particular = $('span.particular').first();
  let contactName = agency.length
    ? agency.text().trim()
    : particular.length
      ? particular.text().trim()
      : '';
  contactName = contactName.replace(/\s+/g, ' ').trim();

  const typeLabel = $('.professional-name .name')
    .first()
    .text()
    .trim()
    .toLowerCase();
  const contactType: 'particular' | 'inmobiliaria' | null =
    typeLabel.includes('particular')
      ? 'particular'
      : typeLabel.includes('profesional')
        ? 'inmobiliaria'
        : null;

  const tel = $("a[href^='tel:']").first().attr('href');
  const contactPhone = tel
    ? tel.replace('tel:', '')
    : $('.hidden-contact-phones_text').first().text().trim();

  const photoUrls = extractPhotos(html);

  return {
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
}
