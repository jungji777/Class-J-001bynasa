/**
 * Cliente del ASF SearchAPI (NASA ASF DAAC) para adquisiciones NISAR reales.
 *
 * Endpoint público, sin autenticación para búsqueda y metadatos:
 *   https://api.daac.asf.alaska.edu/services/search/param
 * Documentación: https://docs.asf.alaska.edu/api/basics/
 *
 * CORS: la API responde `Access-Control-Allow-Origin` dinámico, y los PNG de
 * browse (quicklooks) en nisar.asf.earthdatacloud.nasa.gov permiten
 * `Access-Control-Allow-Origin: *`. No se necesitan credenciales Earthdata
 * para visualizar quicklooks; los productos HDF5/GeoTIFF completos sí
 * requieren cuenta (ver docs/DATA_SOURCES.md).
 */

export interface NisarPolBrowse {
  key: string;
  url: string;
  label: string;
}

export interface NisarBrowse {
  /** Imagen geocodificada (plate carrée, cubre el footprint). */
  latlon?: string;
  thumbnail?: string;
  /** Quicklook de geometría nativa (producto compuesto). */
  native?: string;
  /** Quicklooks oficiales por polarización (banda A/B · HHHH/HVHV). */
  pols: NisarPolBrowse[];
}

export interface NisarGranule {
  fileID: string;
  sceneName: string;
  processingLevel: string;
  /** Inicio de adquisición (ISO UTC). */
  startTime: string;
  /** Fin de adquisición (ISO UTC). */
  stopTime: string;
  flightDirection: "ASCENDING" | "DESCENDING";
  pathNumber: number;
  frameNumber: number;
  processingDate?: string;
  /** URL del producto HDF5 en ASF Earthdata Cloud. */
  url: string;
  browse: NisarBrowse;
  /** Polígono del footprint [[lon, lat], ...]. */
  footprint: number[][];
  bytesH5?: number;
}

interface AsfFeature {
  geometry: { type: string; coordinates: number[][][] };
  properties: {
    fileID: string;
    sceneName: string;
    processingLevel: string;
    startTime: string;
    stopTime: string;
    flightDirection: string;
    pathNumber: number;
    frameNumber: number;
    processingDate?: string;
    url: string;
    browse: string[];
    bytes?: Record<string, { bytes: number; format: string }>;
  };
}

export const ASF_SEARCH_ENDPOINT =
  "https://api.daac.asf.alaska.edu/services/search/param";

/** Punto de referencia: centro de Honduras. */
export const HONDURAS_POINT = { lon: -86.6, lat: 14.85 };

function parseBrowse(urls: string[]): NisarBrowse {
  const isThumb = (u: string) => u.includes("_thumbnail");
  const latlon = urls.find(
    (u) => u.includes("_LATLON.png") && !isThumb(u),
  );
  const thumbnail = urls.find((u) => u.includes("_LATLON_thumbnail"));
  const native = urls.find((u) => /_NATIVE(_A)?\.png$/.test(u));
  const polRe = /_NATIVE_([AB])_(HHHH|HVHV)\.png$/;
  const pols: NisarPolBrowse[] = urls
    .filter((u) => polRe.test(u))
    .map((u) => {
      const m = u.match(polRe)!;
      const pol =
        m[2] === "HHHH" ? "HH · co-polarizada" : "HV · cruz-polarizada";
      return {
        key: `pol-${m[1]}-${m[2]}`,
        url: u,
        label: `Banda ${m[1]} · ${pol}`,
      };
    });
  return { latlon, thumbnail, native, pols };
}

function toGranule(f: AsfFeature): NisarGranule {
  const p = f.properties;
  const h5 = Object.entries(p.bytes ?? {}).find(
    ([, v]) => v.format === "HDF5",
  );
  return {
    fileID: p.fileID,
    sceneName: p.sceneName,
    processingLevel: p.processingLevel,
    startTime: p.startTime,
    stopTime: p.stopTime,
    flightDirection:
      p.flightDirection === "ASCENDING" ? "ASCENDING" : "DESCENDING",
    pathNumber: p.pathNumber,
    frameNumber: p.frameNumber,
    processingDate: p.processingDate,
    url: p.url,
    browse: parseBrowse(p.browse ?? []),
    footprint: f.geometry.coordinates[0] ?? [],
    bytesH5: h5?.[1].bytes,
  };
}

export interface SearchOptions {
  /** Longitud/latitud de un punto de interés. */
  lon?: number;
  lat?: number;
  /** WKT de área (POLYGON((...))) que sustituye al punto. */
  areaWkt?: string;
  processingLevels?: string[];
  maxResults?: number;
  signal?: AbortSignal;
}

/** Busca adquisiciones NISAR que cubran un punto o área, ordenadas por fecha desc. */
export async function searchNisar({
  lon,
  lat,
  areaWkt,
  processingLevels = ["GCOV"],
  maxResults = 30,
  signal,
}: SearchOptions): Promise<NisarGranule[]> {
  const intersectsWith =
    areaWkt ?? `POINT(${lon ?? 0} ${lat ?? 0})`;
  const params = new URLSearchParams({
    dataset: "NISAR",
    processingLevel: processingLevels.join(","),
    intersectsWith,
    maxResults: String(maxResults),
    output: "geojson",
  });
  const res = await fetch(`${ASF_SEARCH_ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: "application/geo+json" },
  });
  if (!res.ok) {
    throw new Error(`ASF SearchAPI respondió ${res.status}`);
  }
  const json = (await res.json()) as { features: AsfFeature[] };
  return (json.features ?? [])
    .map(toGranule)
    .sort(
      (a, b) =>
        new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime(),
    );
}

/** Días de separación entre dos adquisiciones. */
export function daysBetween(a: NisarGranule, b: NisarGranule): number {
  return Math.round(
    Math.abs(
      (new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime()) /
        86_400_000,
    ),
  );
}

const dateFmt = new Intl.DateTimeFormat("es-HN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("es-HN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "12 nov 2026" */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** "11:07 UTC" */
export function formatTime(iso: string): string {
  return `${timeFmt.format(new Date(iso))} UTC`;
}

/** Bounding box del footprint. */
export function footprintBbox(footprint: number[][]): {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
} {
  const lons = footprint.map((p) => p[0]);
  const lats = footprint.map((p) => p[1]);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}
