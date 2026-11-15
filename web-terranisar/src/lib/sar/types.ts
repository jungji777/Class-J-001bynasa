/**
 * Tipos del dominio SAR. Pensados para mapear 1:1 con los productos
 * reales de NISAR (via ASF DAAC) cuando la misión publique adquisiciones:
 * `Acquisition` ↔ un granule L1/L2 con metadatos de órbita.
 */

export type SarProduct = "hh" | "hv" | "soil";

export interface SarProductMeta {
  id: SarProduct;
  label: string;
  hint: string;
  /** Rango típico de retrodispersión en dB para este producto. */
  dbRange: [number, number];
}

export const SAR_PRODUCTS: SarProductMeta[] = [
  {
    id: "hh",
    label: "Retrodispersión HH",
    hint: "Co-polarizada · banda L · suelo y agua",
    dbRange: [-24, -2],
  },
  {
    id: "hv",
    label: "Retrodispersión HV",
    hint: "Cruz-polarizada · volumen de vegetación",
    dbRange: [-30, -10],
  },
  {
    id: "soil",
    label: "Humedad del suelo",
    hint: "Producto L2 · índice 0–1 reescalado a dB",
    dbRange: [-18, -6],
  },
];

export interface Acquisition {
  id: string;
  /** ISO date. */
  date: string;
  /** Etiqueta corta en español, p. ej. "12 nov". */
  shortLabel: string;
  orbit: "Ascendente" | "Descendente";
  track: number;
}

/** Adquisiciones de ejemplo alineadas con el ciclo de 12 días de NISAR.
 * Se sustituirán por la lista real consultada a ASF al integrar datos. */
export const ACQUISITIONS: Acquisition[] = [
  { id: "a1", date: "2026-08-14", shortLabel: "14 ago", orbit: "Descendente", track: 42 },
  { id: "a2", date: "2026-09-10", shortLabel: "10 sep", orbit: "Ascendente", track: 57 },
  { id: "a3", date: "2026-10-06", shortLabel: "06 oct", orbit: "Descendente", track: 42 },
  { id: "a4", date: "2026-11-12", shortLabel: "12 nov", orbit: "Descendente", track: 42 },
];

/** Extensión geográfica del mapa de exploración (Honduras). */
export const HONDURAS_BBOX = {
  minLon: -89.45,
  maxLon: -83.1,
  minLat: 12.9,
  maxLat: 16.55,
};
