import 'dotenv/config';
import { Bot } from 'grammy';
import { scrape } from './scraper.js';
import {
  saveApartment,
  searchApartments,
  updateStatus,
  addContactNote,
  findByQuery,
  getApartmentDetails,
  buildNotionUrl,
} from './notion.js';
import { isValidStatus, VALID_STATUSES } from './types.js';
import { buildCalendarUrl } from './calendar.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const GUEST_EMAIL = process.env.GUEST_EMAIL?.trim();

if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = new Bot(token);

// Mutex to prevent concurrent scrapes (Chrome profile lock)
let scraping = false;

// --- /start and /ayuda ---

const HELP_TEXT = `Mandame un link de idealista y lo guardo en Notion.

Comandos:
/buscar <telefono o nombre> - Buscar piso
/estado <id> <estado> - Cambiar estado
/nota <id> <texto> - Agregar nota de contacto
/visita <id> <DDMM> <HHMM> - Crear evento en Calendar
/ayuda - Ver esta ayuda

Estados validos: ${VALID_STATUSES.join(', ')}
Ejemplo visita: /visita 99904571 1504 1800`;

bot.command('start', (ctx) => ctx.reply(HELP_TEXT));
bot.command('ayuda', (ctx) => ctx.reply(HELP_TEXT));

// --- /buscar <query> ---

bot.command('buscar', async (ctx) => {
  const query = ctx.match?.trim();
  if (!query) {
    await ctx.reply('Uso: /buscar <telefono o nombre>');
    return;
  }

  try {
    const results = await searchApartments(query);
    if (results.length === 0) {
      await ctx.reply('No encontre resultados.');
      return;
    }

    const lines = results.map((r) => {
      const price = r.price ? `${r.price}€` : 'Sin precio';
      return [
        `${r.title} - ${price}`,
        `ID: ${r.idealistaId} | Estado: ${r.status || 'nuevo'}`,
        `Contacto: ${r.contactName} (${r.contactPhone})`,
        r.url,
      ].join('\n');
    });

    await ctx.reply(lines.join('\n\n'));
  } catch (err: any) {
    console.error('Search error:', err.message);
    await ctx.reply('Error al buscar. Revisa los logs.');
  }
});

// --- /estado <id> <status> ---

bot.command('estado', async (ctx) => {
  const args = ctx.match?.trim().split(/\s+/);
  if (!args || args.length < 2) {
    await ctx.reply(
      `Uso: /estado <idealistaId> <estado>\nEstados: ${VALID_STATUSES.join(', ')}`,
    );
    return;
  }

  const [identifier, status] = args;

  if (!isValidStatus(status)) {
    await ctx.reply(
      `Estado "${status}" no valido.\nEstados: ${VALID_STATUSES.join(', ')}`,
    );
    return;
  }

  try {
    const found = await findByQuery(identifier);
    if (!found) {
      await ctx.reply(`No encontre el piso "${identifier}".`);
      return;
    }

    await updateStatus(found.pageId, status);
    await ctx.reply(`Estado actualizado: ${status}\n${found.title}`);
  } catch (err: any) {
    console.error('Status update error:', err.message);
    await ctx.reply('Error al actualizar estado. Revisa los logs.');
  }
});

// --- /nota <id> <text> ---

bot.command('nota', async (ctx) => {
  const match = ctx.match?.trim();
  if (!match) {
    await ctx.reply('Uso: /nota <idealistaId> <texto>');
    return;
  }

  // First word is the identifier, rest is the note
  const spaceIdx = match.indexOf(' ');
  if (spaceIdx === -1) {
    await ctx.reply('Uso: /nota <idealistaId> <texto>');
    return;
  }

  const identifier = match.slice(0, spaceIdx);
  const noteText = match.slice(spaceIdx + 1).trim();

  try {
    const found = await findByQuery(identifier);
    if (!found) {
      await ctx.reply(`No encontre el piso "${identifier}".`);
      return;
    }

    await addContactNote(found.pageId, noteText);
    await ctx.reply(`Nota agregada al piso ${found.idealistaId}`);
  } catch (err: any) {
    console.error('Note error:', err.message);
    await ctx.reply('Error al agregar nota. Revisa los logs.');
  }
});

// --- /visita <id> <DDMM> <HHMM> ---

function parseDateArgs(ddmm: string, hhmm: string): Date | null {
  if (ddmm.length !== 4 || hhmm.length !== 4) return null;

  const day = parseInt(ddmm.slice(0, 2), 10);
  const month = parseInt(ddmm.slice(2, 4), 10);
  const hours = parseInt(hhmm.slice(0, 2), 10);
  const minutes = parseInt(hhmm.slice(2, 4), 10);

  if (isNaN(day) || isNaN(month) || isNaN(hours) || isNaN(minutes)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const year = new Date().getFullYear();
  return new Date(year, month - 1, day, hours, minutes);
}

bot.command('visita', async (ctx) => {
  const args = ctx.match?.trim().split(/\s+/);
  if (!args || args.length < 3) {
    await ctx.reply(
      'Uso: /visita <idealistaId> <DDMM> <HHMM>\nEjemplo: /visita 99904571 1504 1800',
    );
    return;
  }

  const [identifier, ddmm, hhmm] = args;

  const startDate = parseDateArgs(ddmm, hhmm);
  if (!startDate) {
    await ctx.reply(
      'Fecha invalida. Formato: DDMM HHMM\nEjemplo: 1504 1800 (15 abril, 18:00)',
    );
    return;
  }

  try {
    const found = await findByQuery(identifier);
    if (!found) {
      await ctx.reply(`No encontre el piso "${identifier}".`);
      return;
    }

    const details = await getApartmentDetails(found.pageId);
    if (!details) {
      await ctx.reply('Error al obtener datos del piso.');
      return;
    }

    // Extract street from location (first part before the barrio)
    const street = details.location.split(',')[0]?.trim() || details.location;

    const title = `Cita piso - ${street} - ${details.contactName || 'Sin contacto'}`;
    const notionUrl = buildNotionUrl(found.pageId);
    const description = `Info del piso: ${notionUrl}`;

    const calendarUrl = buildCalendarUrl({
      title,
      location: details.location,
      description,
      startDate,
      durationMinutes: 30,
      guestEmail: GUEST_EMAIL,
    });

    // Update status to visita_programada
    await updateStatus(found.pageId, 'visita_programada');

    const dateStr = startDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    await ctx.reply(
      [
        `Visita programada: ${dateStr}`,
        `${details.title}`,
        `Estado actualizado: visita_programada`,
        ``,
        `Clickea para agregar al Calendar:`,
        calendarUrl,
      ].join('\n'),
    );
  } catch (err: any) {
    console.error('Visit error:', err.message);
    await ctx.reply('Error al crear visita. Revisa los logs.');
  }
});

// --- URL handler (idealista link) ---

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const urlMatch = text.match(
    /https?:\/\/(?:www\.)?idealista\.com\/inmueble\/\d+\/?/,
  );

  if (!urlMatch) return;

  const url = urlMatch[0];

  if (scraping) {
    await ctx.reply(
      'Ya estoy scrapeando otro piso. Espera un momento y vuelve a intentar.',
    );
    return;
  }

  scraping = true;
  try {
    await ctx.reply('Scrapeando... ~15 segundos');

    const apartment = await scrape(url);
    const result = await saveApartment(apartment);

    if (result.status === 'duplicate') {
      await ctx.reply(`Este piso ya existe en Notion (${apartment.title})`);
      return;
    }

    const lines = [
      `Piso guardado en Notion`,
      ``,
      apartment.title,
      `${apartment.price ? apartment.price + '€/mes' : 'Sin precio'} | ${apartment.rooms ?? '?'}hab | ${apartment.squareMeters ?? '?'}m²`,
      apartment.floor ? `Planta: ${apartment.floor}` : null,
      `Contacto: ${apartment.contactName} ${apartment.contactPhone}`,
      `Fotos: ${apartment.photoUrls.length}`,
      ``,
      apartment.url,
    ].filter(Boolean);

    await ctx.reply(lines.join('\n'));
  } catch (err: any) {
    console.error('Scrape error:', err.message);
    await ctx.reply(`Error al scrapear: ${err.message}`);
  } finally {
    scraping = false;
  }
});

// --- Error handler ---

bot.catch((err) => {
  console.error('Bot error:', err.error);
  err.ctx?.reply('Error interno. Revisa los logs.').catch(() => {});
});

// --- Start ---

console.log('Bot starting...');
bot.start();
