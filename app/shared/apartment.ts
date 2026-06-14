export interface Apartment {
  idealistaId: string;
  url: string;
  title: string;
  price: number | null;
  location: string;
  description: string;
  rooms: number | null;
  squareMeters: number | null;
  floor: string | null;
  contactName: string;
  contactPhone: string;
  contactType: 'particular' | 'inmobiliaria' | null;
  photoUrls: string[];
  // Apartment features
  elevator: boolean | null;
  airConditioning: boolean | null;
  heating: string | null;
  naturalGas: boolean | null;
  pool: boolean | null;
  parking: boolean | null;
  storageRoom: boolean | null;
}

export type ApartmentStatus =
  | 'nuevo'
  | 'contactado'
  | 'sin_respuesta'
  | 'visita_programada'
  | 'visitado'
  | 'descartado'
  | 'interesado';

export const VALID_STATUSES: ApartmentStatus[] = [
  'nuevo',
  'contactado',
  'sin_respuesta',
  'visita_programada',
  'visitado',
  'descartado',
  'interesado',
];

export function isValidStatus(s: string): s is ApartmentStatus {
  return VALID_STATUSES.includes(s as ApartmentStatus);
}
