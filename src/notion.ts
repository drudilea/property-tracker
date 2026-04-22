import type { Apartment, ApartmentStatus } from "./types.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
const NOTION_VERSION = "2022-06-28";

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
};

async function notionFetch(path: string, body?: object): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Notion API error (${data.code}): ${data.message}`);
  }
  return data;
}

async function notionPatch(path: string, body: object): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Notion API error (${data.code}): ${data.message}`);
  }
  return data;
}

const DB_SCHEMA: Record<string, object> = {
  "Idealista ID": { rich_text: {} },
  URL: { url: {} },
  Precio: { number: { format: "euro" } },
  "Ubicación": { rich_text: {} },
  "Descripción": { rich_text: {} },
  Habitaciones: { number: {} },
  "Metros cuadrados": { number: {} },
  Planta: { rich_text: {} },
  "Contacto nombre": { rich_text: {} },
  "Contacto teléfono": { phone_number: {} },
  "Contacto tipo": {
    select: {
      options: [
        { name: "particular", color: "green" },
        { name: "inmobiliaria", color: "blue" },
      ],
    },
  },
  "Contacto notas": { rich_text: {} },
  "Requisitos de entrada": { rich_text: {} },
  Estado: {
    select: {
      options: [
        { name: "nuevo", color: "blue" },
        { name: "contactado", color: "yellow" },
        { name: "sin_respuesta", color: "orange" },
        { name: "visita_programada", color: "purple" },
        { name: "visitado", color: "green" },
        { name: "descartado", color: "red" },
        { name: "interesado", color: "green" },
      ],
    },
  },
  Ascensor: { checkbox: {} },
  "Aire acondicionado": { checkbox: {} },
  "Calefacción": { select: { options: [] } },
  "Gas natural": { checkbox: {} },
  Piscina: { checkbox: {} },
  Garaje: { checkbox: {} },
  Trastero: { checkbox: {} },
  "Score Ubicación": { number: {} },
  "Score Estado": { number: {} },
  "Score Luminosidad": { number: {} },
  "Score Ruido": { number: {} },
  "Score Calidad/Precio": { number: {} },
  "Score General": { number: {} },
  "Fecha agregado": { date: {} },
};

let schemaInitialized = false;

async function ensureDatabaseSchema(): Promise<void> {
  if (schemaInitialized) return;

  const db = await notionFetch(`/databases/${DATABASE_ID}`);
  const existingProps = new Set(Object.keys(db.properties ?? {}));
  const missingProps: Record<string, object> = {};

  for (const [name, config] of Object.entries(DB_SCHEMA)) {
    if (!existingProps.has(name)) {
      missingProps[name] = config;
    }
  }

  if (Object.keys(missingProps).length > 0) {
    console.log(
      `Creating ${Object.keys(missingProps).length} missing properties in Notion DB...`
    );
    await notionPatch(`/databases/${DATABASE_ID}`, {
      properties: missingProps,
    });
  }

  schemaInitialized = true;
}

export async function findByIdealistaId(
  idealistaId: string
): Promise<string | null> {
  const data = await notionFetch(`/databases/${DATABASE_ID}/query`, {
    filter: {
      property: "Idealista ID",
      rich_text: { equals: idealistaId },
    },
    page_size: 1,
  });

  return data.results.length > 0 ? data.results[0].id : null;
}

function buildProperties(apartment: Apartment) {
  return {
    Name: {
      title: [{ text: { content: apartment.title || "Sin título" } }],
    },
    URL: { url: apartment.url },
    "Idealista ID": {
      rich_text: [{ text: { content: apartment.idealistaId } }],
    },
    Precio: apartment.price != null ? { number: apartment.price } : undefined,
    "Ubicación": {
      rich_text: [{ text: { content: apartment.location } }],
    },
    "Descripción": {
      rich_text: [
        {
          text: {
            // Notion rich_text limit is 2000 characters
            content: apartment.description.slice(0, 2000),
          },
        },
      ],
    },
    Habitaciones:
      apartment.rooms != null ? { number: apartment.rooms } : undefined,
    "Metros cuadrados":
      apartment.squareMeters != null
        ? { number: apartment.squareMeters }
        : undefined,
    Planta: apartment.floor
      ? { rich_text: [{ text: { content: apartment.floor } }] }
      : undefined,
    "Contacto nombre": {
      rich_text: [{ text: { content: apartment.contactName } }],
    },
    "Contacto teléfono": {
      phone_number: apartment.contactPhone || null,
    },
    "Contacto tipo": apartment.contactType
      ? { select: { name: apartment.contactType } }
      : undefined,
    Estado: { select: { name: "nuevo" } },
    Ascensor: { checkbox: apartment.elevator ?? false },
    "Aire acondicionado": { checkbox: apartment.airConditioning ?? false },
    "Calefacción": apartment.heating
      ? { select: { name: apartment.heating } }
      : undefined,
    "Gas natural": { checkbox: apartment.naturalGas ?? false },
    Piscina: { checkbox: apartment.pool ?? false },
    Garaje: { checkbox: apartment.parking ?? false },
    Trastero: { checkbox: apartment.storageRoom ?? false },
    "Fecha agregado": {
      date: { start: new Date().toISOString().split("T")[0] },
    },
  };
}

function buildPhotoBlocks(photoUrls: string[]) {
  // Notion allows max 100 blocks per append request
  return photoUrls.slice(0, 50).map((url) => ({
    object: "block" as const,
    type: "image" as const,
    image: {
      type: "external" as const,
      external: { url },
    },
  }));
}

export async function createApartment(apartment: Apartment): Promise<string> {
  const children: any[] = [
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ text: { content: "Notas" } }],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ text: { content: "(Agregá tus notas aquí)" } }],
      },
    },
    {
      object: "block",
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ text: { content: "Historial de contacto" } }],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [] },
    },
    {
      object: "block",
      type: "divider",
      divider: {},
    },
  ];

  if (apartment.photoUrls.length > 0) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            text: {
              content: `Fotos del anuncio (${apartment.photoUrls.length})`,
            },
          },
        ],
      },
    });
    children.push(...buildPhotoBlocks(apartment.photoUrls));
  }

  // Remove undefined properties
  const properties = Object.fromEntries(
    Object.entries(buildProperties(apartment)).filter(([, v]) => v !== undefined)
  );

  const cover = apartment.photoUrls.length > 0
    ? { type: "external", external: { url: apartment.photoUrls[0] } }
    : undefined;

  const data = await notionFetch("/pages", {
    parent: { database_id: DATABASE_ID },
    properties,
    children,
    ...(cover && { cover }),
  });

  return data.id;
}

export type SaveResult =
  | { status: "created"; pageId: string }
  | { status: "duplicate"; pageId: string };

export async function saveApartment(apartment: Apartment): Promise<SaveResult> {
  await ensureDatabaseSchema();
  const existingId = await findByIdealistaId(apartment.idealistaId);

  if (existingId) {
    return { status: "duplicate", pageId: existingId };
  }

  const pageId = await createApartment(apartment);
  return { status: "created", pageId };
}

// --- Search & update functions (used by Telegram bot) ---

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

function extractProperty(page: any, name: string, type: string): any {
  const prop = page.properties?.[name];
  if (!prop) return null;
  switch (type) {
    case "title":
      return prop.title?.[0]?.plain_text ?? "";
    case "rich_text":
      return prop.rich_text?.[0]?.plain_text ?? "";
    case "number":
      return prop.number ?? null;
    case "url":
      return prop.url ?? "";
    case "phone_number":
      return prop.phone_number ?? "";
    case "select":
      return prop.select?.name ?? "";
    default:
      return null;
  }
}

function pageToSearchResult(page: any): NotionSearchResult {
  return {
    pageId: page.id,
    title: extractProperty(page, "Name", "title"),
    idealistaId: extractProperty(page, "Idealista ID", "rich_text"),
    price: extractProperty(page, "Precio", "number"),
    location: extractProperty(page, "Ubicación", "rich_text"),
    contactName: extractProperty(page, "Contacto nombre", "rich_text"),
    contactPhone: extractProperty(page, "Contacto teléfono", "phone_number"),
    status: extractProperty(page, "Estado", "select"),
    url: extractProperty(page, "URL", "url"),
  };
}

export async function searchApartments(
  query: string
): Promise<NotionSearchResult[]> {
  const data = await notionFetch(`/databases/${DATABASE_ID}/query`, {
    filter: {
      or: [
        { property: "Contacto teléfono", phone_number: { contains: query } },
        { property: "Contacto nombre", rich_text: { contains: query } },
        { property: "Idealista ID", rich_text: { equals: query } },
        { property: "Name", title: { contains: query } },
      ],
    },
    page_size: 10,
  });

  return data.results.map(pageToSearchResult);
}

export async function updateStatus(
  pageId: string,
  status: ApartmentStatus
): Promise<void> {
  await notionPatch(`/pages/${pageId}`, {
    properties: { Estado: { select: { name: status } } },
  });
}

export async function addContactNote(
  pageId: string,
  note: string
): Promise<void> {
  const page = await notionFetch(`/pages/${pageId}`);
  const existing = extractProperty(page, "Contacto notas", "rich_text") || "";
  const timestamp = new Date().toLocaleDateString("es-ES");
  const updated = existing
    ? `${existing}\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`;

  await notionPatch(`/pages/${pageId}`, {
    properties: {
      "Contacto notas": {
        rich_text: [{ text: { content: updated.slice(0, 2000) } }],
      },
    },
  });
}

export async function getApartmentDetails(
  pageId: string
): Promise<NotionSearchResult | null> {
  try {
    const page = await notionFetch(`/pages/${pageId}`);
    return pageToSearchResult(page);
  } catch {
    return null;
  }
}

export function buildNotionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

export async function findByQuery(
  query: string
): Promise<{ pageId: string; idealistaId: string; title: string } | null> {
  // Try exact match by idealista ID first
  const byId = await findByIdealistaId(query);
  if (byId) {
    const page = await notionFetch(`/pages/${byId}`);
    return {
      pageId: byId,
      idealistaId: query,
      title: extractProperty(page, "Name", "title"),
    };
  }

  // Fallback: search by title
  const data = await notionFetch(`/databases/${DATABASE_ID}/query`, {
    filter: {
      property: "Name",
      title: { contains: query },
    },
    page_size: 1,
  });

  if (data.results.length === 0) return null;

  const page = data.results[0];
  return {
    pageId: page.id,
    idealistaId: extractProperty(page, "Idealista ID", "rich_text"),
    title: extractProperty(page, "Name", "title"),
  };
}
