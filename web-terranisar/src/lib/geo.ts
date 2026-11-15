/**
 * Utilidades geográficas ligeras para el análisis por polígono.
 * Todo opera en grados (lon, lat) — suficiente para simplificar contornos,
 * construir WKT para el ASF SearchAPI y proyectar en canvas.
 */

export interface BBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/** Umbral para considerar un anillo cerrado (fracción de grado). */
function isClosed(ring: number[][]): boolean {
  const a = ring[0];
  const b = ring[ring.length - 1];
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

/** Área con signo de un anillo (grados², shoelace). */
export function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(sum / 2);
}

function perpDist(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) {
    return Math.hypot(p[0] - a[0], p[1] - a[1]);
  }
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function dp(
  ring: number[][],
  first: number,
  last: number,
  tol: number,
  keep: boolean[],
): void {
  let maxDist = -1;
  let idx = -1;
  for (let i = first + 1; i < last; i++) {
    const d = perpDist(ring[i], ring[first], ring[last]);
    if (d > maxDist) {
      maxDist = d;
      idx = i;
    }
  }
  if (maxDist > tol && idx > 0) {
    keep[idx] = true;
    dp(ring, first, idx, tol, keep);
    dp(ring, idx, last, tol, keep);
  }
}

/** Simplifica un anillo con Douglas-Peucker (tolerancia en grados). */
export function simplifyRing(ring: number[][], tolerance = 0.01): number[][] {
  if (ring.length <= 4) return ring.map((p) => [p[0], p[1]]);
  const closed = isClosed(ring);
  const body = closed ? ring.slice(0, -1) : ring;
  const keep = new Array<boolean>(body.length).fill(false);
  keep[0] = true;
  keep[body.length - 1] = true;
  dp(body, 0, body.length - 1, tolerance, keep);
  const out = body.filter((_, i) => keep[i]);
  if (closed && out.length >= 2) out.push(out[0]);
  return out;
}

/** Simplifica un anillo a como mucho `maxPoints`, elevando la tolerancia. */
export function simplifyRingTo(ring: number[][], maxPoints: number): number[][] {
  let tol = 0.005;
  let out = simplifyRing(ring, tol);
  while (out.length > maxPoints && tol < 0.25) {
    tol *= 1.8;
    out = simplifyRing(ring, tol);
  }
  return out;
}

/** El anillo de mayor área de un polígono (posiblemente multiparte). */
export function mainRing(rings: number[][][]): number[][] {
  return rings.reduce(
    (best, r) => (ringArea(r) > ringArea(best) ? r : best),
    rings[0],
  );
}

/** Cierra el anillo y lo serializa como WKT POLYGON para el ASF SearchAPI. */
export function ringToWkt(ring: number[][]): string {
  const pts = ring.map((p) => [p[0], p[1]] as number[]);
  if (!isClosed(pts)) pts.push(pts[0]);
  const body = pts
    .map(([lon, lat]) => `${lon.toFixed(3)} ${lat.toFixed(3)}`)
    .join(", ");
  return `POLYGON((${body}))`;
}

/** Bounding box de un anillo. */
export function ringBbox(ring: number[][]): BBox {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

/**
 * Proyector plate carrée ajustado a un canvas, con la misma corrección
 * de aspecto (cos 15°) que el mapa de exploración.
 */
export function makeProjector(w: number, h: number, bbox: BBox) {
  const bboxAspect =
    (bbox.maxLon - bbox.minLon) /
    ((bbox.maxLat - bbox.minLat) * Math.cos((15 * Math.PI) / 180));
  let mapW = w;
  let mapH = w / bboxAspect;
  if (mapH > h) {
    mapH = h;
    mapW = h * bboxAspect;
  }
  const offX = (w - mapW) / 2;
  const offY = (h - mapH) / 2;
  const project = (lon: number, lat: number): [number, number] => [
    offX + ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * mapW,
    offY + ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * mapH,
  ];
  const unproject = (x: number, y: number): [number, number] => [
    bbox.minLon + ((x - offX) / mapW) * (bbox.maxLon - bbox.minLon),
    bbox.maxLat - ((y - offY) / mapH) * (bbox.maxLat - bbox.minLat),
  ];
  return { project, unproject };
}
