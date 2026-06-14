import { buildNotionUrl } from './notion';
import { buildCalendarUrl } from './calendar';
import { notionClientFromConfig } from './notion-session';
import type { CreateVisitResult } from '../shared/ipc-contract';
import { errorMessage } from './result';

/** Build a Google Calendar visit URL for a listing and mark it scheduled.
 * The renderer shows the URL as a link; opening is left to the user. */
export async function createVisit(
  configPath: string,
  idealistaId: string,
  startISO: string,
): Promise<CreateVisitResult> {
  const session = notionClientFromConfig(configPath);
  if (!session.ok) return { ok: false, error: session.error };
  const notion = session.client;

  const startDate = new Date(startISO);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, error: 'Fecha/hora inválida.' };
  }

  try {
    const found = await notion.findByQuery(idealistaId);
    if (!found) {
      return {
        ok: false,
        error: `No encontré el piso "${idealistaId}" en Notion.`,
      };
    }
    const details = await notion.getDetails(found.pageId);
    if (!details) {
      return { ok: false, error: 'No pude leer los datos del piso.' };
    }

    const street = details.location.split(',')[0]?.trim() || details.location;
    const title = `Cita piso - ${street} - ${details.contactName || 'Sin contacto'}`;
    const url = buildCalendarUrl({
      title,
      location: details.location,
      description: `Info del piso: ${buildNotionUrl(found.pageId)}`,
      startDate,
      durationMinutes: 30,
    });

    await notion.updateStatus(found.pageId, 'visita_programada');
    return { ok: true, url, title };
  } catch (err) {
    return {
      ok: false,
      error: errorMessage(err),
    };
  }
}
