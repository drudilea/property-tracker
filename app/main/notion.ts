import type { Apartment, ApartmentStatus } from '../shared/apartment';
import type { ApartmentRef } from '../shared/ipc-contract';
import { errorMessage } from './result';

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1';

export type SaveResult =
  | { status: 'created'; pageId: string }
  | { status: 'duplicate'; pageId: string };

export interface NotionSearchResult {
  pageId: string;
  title: string;
  idealistaId: string;
  price: number | null;
  location: string;
  contactName: string;
  contactPhone: string;
  status: string;
  url: string;
}

/** A Notion client bound to one token + database. */
export type NotionClient = ReturnType<typeof createNotionClient>;

const DB_SCHEMA: Record<string, object> = {
  'Idealista ID': { rich_text: {} },
  URL: { url: {} },
  Precio: { number: { format: 'euro' } },
  Ubicación: { rich_text: {} },
  Descripción: { rich_text: {} },
  Habitaciones: { number: {} },
  'Metros cuadrados': { number: {} },
  Planta: { rich_text: {} },
  'Contacto nombre': { rich_text: {} },
  'Contacto teléfono': { phone_number: {} },
  'Contacto tipo': {
    select: {
      options: [
        { name: 'particular', color: 'green' },
        { name: 'inmobiliaria', color: 'blue' },
      ],
    },
  },
  'Contacto notas': { rich_text: {} },
  'Requisitos de entrada': { rich_text: {} },
  Estado: {
    select: {
      options: [
        { name: 'nuevo', color: 'blue' },
        { name: 'contactado', color: 'yellow' },
        { name: 'sin_respuesta', color: 'orange' },
        { name: 'visita_programada', color: 'purple' },
        { name: 'visitado', color: 'green' },
        { name: 'descartado', color: 'red' },
        { name: 'interesado', color: 'green' },
      ],
    },
  },
  Ascensor: { checkbox: {} },
  'Aire acondicionado': { checkbox: {} },
  Calefacción: { select: { options: [] } },
  'Gas natural': { checkbox: {} },
  Piscina: { checkbox: {} },
  Garaje: { checkbox: {} },
  Trastero: { checkbox: {} },
  'Score Ubicación': { number: {} },
  'Score Estado': { number: {} },
  'Score Luminosidad': { number: {} },
  'Score Ruido': { number: {} },
  'Score Calidad/Precio': { number: {} },
  'Score General': { number: {} },
  'Fecha agregado': { date: {} },
};

function buildPhotoBlocks(photoUrls: string[]) {
  // Notion allows max 100 blocks per append request
  return photoUrls.slice(0, 50).map((url) => ({
    object: 'block' as const,
    type: 'image' as const,
    image: {
      type: 'external' as const,
      external: { url },
    },
  }));
}

function extractProperty(page: any, name: string, type: string): any {
  const prop = page.properties?.[name];
  if (!prop) return null;
  switch (type) {
    case 'title':
      return prop.title?.[0]?.plain_text ?? '';
    case 'rich_text':
      return prop.rich_text?.[0]?.plain_text ?? '';
    case 'number':
      return prop.number ?? null;
    case 'url':
      return prop.url ?? '';
    case 'phone_number':
      return prop.phone_number ?? '';
    case 'select':
      return prop.select?.name ?? '';
    default:
      return null;
  }
}

/** Build the public Notion URL for a page id (pure). */
export function buildNotionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, '')}`;
}

/** Validate a token via /users/me. Doesn't need a database. */
export async function validateToken(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${NOTION_API}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as { message?: string });
      return { ok: false, error: data.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: errorMessage(err),
    };
  }
}

/**
 * Create a Notion client bound to a token + database. Each client owns its own
 * detected title-property name and schema-init cache — no shared global state.
 *
 * Note: Notion's UI localizes the title column's name at database-creation time
 * ("Nombre" in Spanish, "Name" in English), so it is detected per database
 * rather than assumed.
 */
export function createNotionClient(token: string, databaseId: string) {
  let titlePropertyName = 'Name';
  let schemaInitialized = false;

  const headers = (): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  });

  async function notionFetch(path: string, body?: object): Promise<any> {
    const res = await fetch(`${NOTION_API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Notion API error (${data.code}): ${data.message}`);
    }
    return data;
  }

  async function notionPatch(path: string, body: object): Promise<any> {
    const res = await fetch(`${NOTION_API}${path}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Notion API error (${data.code}): ${data.message}`);
    }
    return data;
  }

  /** Detect the title property and add any missing columns. Runs once. */
  async function ensureSchema(): Promise<void> {
    if (schemaInitialized) return;

    const db = await notionFetch(`/databases/${databaseId}`);
    const existingProps: Record<string, any> = db.properties ?? {};

    const titleEntry = Object.entries(existingProps).find(
      ([, prop]) => prop.type === 'title',
    );
    if (titleEntry) {
      titlePropertyName = titleEntry[0];
    }

    const existingPropNames = new Set(Object.keys(existingProps));
    const missingProps: Record<string, object> = {};
    for (const [name, config] of Object.entries(DB_SCHEMA)) {
      if (!existingPropNames.has(name)) {
        missingProps[name] = config;
      }
    }

    if (Object.keys(missingProps).length > 0) {
      console.log(
        `Creating ${Object.keys(missingProps).length} missing properties in Notion DB...`,
      );
      await notionPatch(`/databases/${databaseId}`, { properties: missingProps });
    }

    schemaInitialized = true;
  }

  function buildProperties(apartment: Apartment) {
    return {
      [titlePropertyName]: {
        title: [{ text: { content: apartment.title || 'Sin título' } }],
      },
      URL: { url: apartment.url },
      'Idealista ID': {
        rich_text: [{ text: { content: apartment.idealistaId } }],
      },
      Precio: apartment.price != null ? { number: apartment.price } : undefined,
      Ubicación: {
        rich_text: [{ text: { content: apartment.location } }],
      },
      Descripción: {
        rich_text: [{ text: { content: apartment.description.slice(0, 2000) } }],
      },
      Habitaciones:
        apartment.rooms != null ? { number: apartment.rooms } : undefined,
      'Metros cuadrados':
        apartment.squareMeters != null
          ? { number: apartment.squareMeters }
          : undefined,
      Planta: apartment.floor
        ? { rich_text: [{ text: { content: apartment.floor } }] }
        : undefined,
      'Contacto nombre': {
        rich_text: [{ text: { content: apartment.contactName } }],
      },
      'Contacto teléfono': { phone_number: apartment.contactPhone || null },
      'Contacto tipo': apartment.contactType
        ? { select: { name: apartment.contactType } }
        : undefined,
      Estado: { select: { name: 'nuevo' } },
      Ascensor: { checkbox: apartment.elevator ?? false },
      'Aire acondicionado': { checkbox: apartment.airConditioning ?? false },
      Calefacción: apartment.heating
        ? { select: { name: apartment.heating } }
        : undefined,
      'Gas natural': { checkbox: apartment.naturalGas ?? false },
      Piscina: { checkbox: apartment.pool ?? false },
      Garaje: { checkbox: apartment.parking ?? false },
      Trastero: { checkbox: apartment.storageRoom ?? false },
      'Fecha agregado': {
        date: { start: new Date().toISOString().split('T')[0] },
      },
    };
  }

  function pageToSearchResult(page: any): NotionSearchResult {
    return {
      pageId: page.id,
      title: extractProperty(page, titlePropertyName, 'title'),
      idealistaId: extractProperty(page, 'Idealista ID', 'rich_text'),
      price: extractProperty(page, 'Precio', 'number'),
      location: extractProperty(page, 'Ubicación', 'rich_text'),
      contactName: extractProperty(page, 'Contacto nombre', 'rich_text'),
      contactPhone: extractProperty(page, 'Contacto teléfono', 'phone_number'),
      status: extractProperty(page, 'Estado', 'select'),
      url: extractProperty(page, 'URL', 'url'),
    };
  }

  async function findByIdealistaId(idealistaId: string): Promise<string | null> {
    await ensureSchema();
    const data = await notionFetch(`/databases/${databaseId}/query`, {
      filter: { property: 'Idealista ID', rich_text: { equals: idealistaId } },
      page_size: 1,
    });
    return data.results.length > 0 ? data.results[0].id : null;
  }

  async function createApartment(apartment: Apartment): Promise<string> {
    const children: any[] = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: 'Notas' } }] },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: '(Agregá tus notas aquí)' } }],
        },
      },
      { object: 'block', type: 'divider', divider: {} },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: 'Historial de contacto' } }] },
      },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [] } },
      { object: 'block', type: 'divider', divider: {} },
    ];

    if (apartment.photoUrls.length > 0) {
      children.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [
            { text: { content: `Fotos del anuncio (${apartment.photoUrls.length})` } },
          ],
        },
      });
      children.push(...buildPhotoBlocks(apartment.photoUrls));
    }

    const properties = Object.fromEntries(
      Object.entries(buildProperties(apartment)).filter(
        ([, v]) => v !== undefined,
      ),
    );

    const cover =
      apartment.photoUrls.length > 0
        ? { type: 'external', external: { url: apartment.photoUrls[0] } }
        : undefined;

    const data = await notionFetch('/pages', {
      parent: { database_id: databaseId },
      properties,
      children,
      ...(cover && { cover }),
    });

    return data.id;
  }

  return {
    /** Save an apartment, skipping if its Idealista id already exists. */
    async save(apartment: Apartment): Promise<SaveResult> {
      await ensureSchema();
      const existingId = await findByIdealistaId(apartment.idealistaId);
      if (existingId) {
        return { status: 'duplicate', pageId: existingId };
      }
      const pageId = await createApartment(apartment);
      return { status: 'created', pageId };
    },

    findByIdealistaId,

    /** Find a page by Idealista id, falling back to a title search. */
    async findByQuery(
      query: string,
    ): Promise<{ pageId: string; idealistaId: string; title: string } | null> {
      await ensureSchema();
      const byId = await findByIdealistaId(query);
      if (byId) {
        const page = await notionFetch(`/pages/${byId}`);
        return {
          pageId: byId,
          idealistaId: query,
          title: extractProperty(page, titlePropertyName, 'title'),
        };
      }

      const data = await notionFetch(`/databases/${databaseId}/query`, {
        filter: { property: titlePropertyName, title: { contains: query } },
        page_size: 1,
      });
      if (data.results.length === 0) return null;

      const page = data.results[0];
      return {
        pageId: page.id,
        idealistaId: extractProperty(page, 'Idealista ID', 'rich_text'),
        title: extractProperty(page, titlePropertyName, 'title'),
      };
    },

    /** Read a page's fields, or null if it can't be read. */
    async getDetails(pageId: string): Promise<NotionSearchResult | null> {
      await ensureSchema();
      try {
        const page = await notionFetch(`/pages/${pageId}`);
        return pageToSearchResult(page);
      } catch {
        return null;
      }
    },

    async updateStatus(pageId: string, status: ApartmentStatus): Promise<void> {
      await notionPatch(`/pages/${pageId}`, {
        properties: { Estado: { select: { name: status } } },
      });
    },

    /** Return a flat list of all apartments in the database. Pages through the
     * entire result set (has_more / next_cursor) and skips entries with no
     * Idealista ID. Callers must ensure the schema is initialised first. */
    async listApartments(): Promise<ApartmentRef[]> {
      await ensureSchema();
      const apartments: ApartmentRef[] = [];
      let cursor: string | undefined;

      do {
        const body: Record<string, unknown> = { page_size: 100 };
        if (cursor) body.start_cursor = cursor;

        const data = await notionFetch(`/databases/${databaseId}/query`, body);

        for (const page of data.results ?? []) {
          const idealistaId = extractProperty(page, 'Idealista ID', 'rich_text');
          if (!idealistaId) continue;
          const title =
            extractProperty(page, titlePropertyName, 'title') || 'Sin título';
          apartments.push({ idealistaId, title });
        }

        cursor = data.has_more ? data.next_cursor : undefined;
      } while (cursor);

      return apartments;
    },
  };
}
