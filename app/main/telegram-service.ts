import { Bot, type Context } from 'grammy';
import { loadConfig, saveConfig } from './config';
import { scrapeListing } from './scraper-service';
import { saveToNotion } from './notion-service';
import { createVisit } from './visit-service';

let bot: Bot | null = null;

export function isTelegramRunning(): boolean {
  return bot !== null;
}

export async function stopTelegramBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
  }
}

/** Convert "DDMM" + "HHMM" (the bot's compact format) to a Date-parseable ISO. */
function compactToISO(ddmm: string, hhmm: string): string | null {
  if (ddmm.length !== 4 || hhmm.length !== 4) return null;
  const iso = `${new Date().getFullYear()}-${ddmm.slice(2, 4)}-${ddmm.slice(0, 2)}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Start (or restart) the bot from the configured token. */
export async function startTelegramBot(
  configPath: string,
): Promise<{ ok: boolean; error?: string }> {
  await stopTelegramBot();
  const token = loadConfig(configPath).telegramBotToken;
  if (!token) return { ok: false, error: 'Falta el token de Telegram.' };

  const b = new Bot(token);

  // Trust-on-first-use allow-list: the first sender becomes the owner.
  const isOwner = (ctx: Context): boolean => {
    const senderId = ctx.from?.id;
    if (!senderId) return false;
    const cfg = loadConfig(configPath);
    if (cfg.telegramAllowedUserId == null) {
      saveConfig(configPath, { ...cfg, telegramAllowedUserId: senderId });
      return true;
    }
    return cfg.telegramAllowedUserId === senderId;
  };

  b.command('start', (ctx) => {
    if (!isOwner(ctx)) return ctx.reply('No autorizado.');
    return ctx.reply(
      'Mandame un link de Idealista y lo guardo en Notion.\n/visita <id> <DDMM> <HHMM> para agendar una visita.',
    );
  });

  b.command('visita', async (ctx) => {
    if (!isOwner(ctx)) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    if (args.length < 3) return ctx.reply('Uso: /visita <id> <DDMM> <HHMM>');
    const iso = compactToISO(args[1], args[2]);
    if (!iso)
      return ctx.reply('Fecha inválida. Formato: DDMM HHMM (ej. 1506 1800).');
    const r = await createVisit(configPath, args[0], iso);
    return ctx.reply(
      r.ok ? `Visita programada: ${r.title}\n${r.url}` : `Error: ${r.error}`,
    );
  });

  b.on('message:text', async (ctx) => {
    if (!isOwner(ctx)) return;
    const match = ctx.message.text.match(
      /https?:\/\/(?:www\.)?idealista\.com\/inmueble\/\d+\/?/,
    );
    if (!match) return;
    await ctx.reply('Scrapeando… (~15s)');
    const result = await scrapeListing(match[0]);
    if (!result.ok) return ctx.reply(`Error: ${result.error}`);
    const save = await saveToNotion(configPath, result.apartment);
    if (!save.ok)
      return ctx.reply(`Scrapeado, pero no se guardó: ${save.error}`);
    return ctx.reply(
      save.status === 'duplicate'
        ? `Ya existía en Notion: ${save.url}`
        : `Guardado en Notion: ${save.url}`,
    );
  });

  b.catch((err) => console.error('[telegram] error', err.error));

  // Long polling; do NOT await (it resolves only when the bot stops).
  void b.start({ onStart: () => console.log('[telegram] bot started') });
  bot = b;
  return { ok: true };
}
