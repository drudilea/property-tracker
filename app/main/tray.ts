import {
  Tray,
  Menu,
  BrowserWindow,
  app,
  nativeImage,
  clipboard,
  Notification,
} from 'electron';
import trayIconPath from './assets/tray-icon.png?asset';
import { scrapeListing } from './scraper-service';
import { saveToNotion } from './notion-service';
import { syncFavorites } from './favorites-service';

const IDEALISTA_LISTING_RE =
  /https?:\/\/(?:www\.)?idealista\.com\/inmueble\/\d+\/?/;

/** Show a system notification if supported. */
function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

/** Read the clipboard, scrape the listing URL found, and save it to Notion. */
async function captureClipboardListing(configPath: string): Promise<void> {
  const text = clipboard.readText();
  const match = text.match(IDEALISTA_LISTING_RE);
  if (!match) {
    notify(
      'Guardar enlace copiado',
      'No hay un enlace de Idealista en el portapapeles.',
    );
    return;
  }
  const url = match[0];
  notify('Capturando piso…', url);
  try {
    const scrapeResult = await scrapeListing(url);
    if (!scrapeResult.ok) {
      notify('No se pudo capturar', scrapeResult.error);
      return;
    }
    const saveResult = await saveToNotion(configPath, scrapeResult.apartment);
    if (!saveResult.ok) {
      notify('No se pudo guardar en Notion', saveResult.error);
      return;
    }
    const title = scrapeResult.apartment.title || url;
    if (saveResult.status === 'duplicate') {
      notify('Ya estaba en Notion', title);
    } else {
      notify('✓ Guardado en Notion', title);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notify('No se pudo capturar', message);
  }
}

/** Sync Idealista favorites to Notion. */
async function syncFavoritesAction(configPath: string): Promise<void> {
  notify('Sincronizando favoritos…', 'Esto puede tardar unos minutos.');
  try {
    const result = await syncFavorites(configPath);
    if (!result.ok) {
      notify('Error al sincronizar', result.error ?? 'Error desconocido.');
      return;
    }
    notify(
      '✓ Favoritos sincronizados',
      `${result.created} nuevos · ${result.duplicates} ya estaban · ${result.failed} con error`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notify('Error al sincronizar favoritos', message);
  }
}

/** Create the system tray. Keeps a reference so it is not garbage-collected. */
export function createTray(
  getWindow: () => BrowserWindow | null,
  configPath: string,
): Tray {
  // The menu bar is ~22pt tall; resize so the icon isn't oversized.
  const icon = nativeImage
    .createFromPath(trayIconPath)
    .resize({ width: 18, height: 18 });
  const tray = new Tray(icon);
  tray.setToolTip('Property Tracker');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        const win = getWindow();
        if (win) win.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Guardar enlace copiado en Notion',
      click: () => {
        captureClipboardListing(configPath).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          notify('Error inesperado', message);
        });
      },
    },
    {
      label: 'Sincronizar favoritos',
      click: () => {
        syncFavoritesAction(configPath).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          notify('Error inesperado', message);
        });
      },
    },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  return tray;
}
