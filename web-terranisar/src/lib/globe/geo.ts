import * as THREE from "three";

/** Convert lat/lon (degrees) to a position on a sphere, matching the
 * equirectangular UV mapping of THREE.SphereGeometry (three-globe convention). */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Inverse of latLonToVector3: a point on the sphere back to lat/lon. */
export function vector3ToLatLon(v: THREE.Vector3): {
  lat: number;
  lon: number;
} {
  const r = v.length();
  const phi = Math.acos(THREE.MathUtils.clamp(v.y / r, -1, 1));
  const theta = Math.atan2(v.z, -v.x);
  let lon = (theta * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat: 90 - (phi * 180) / Math.PI, lon };
}

export function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "O";
  return `${Math.abs(lat).toFixed(4)}° ${ns}  ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

export interface CountryRing {
  points: THREE.Vector3[];
}

/** Parse a GeoJSON Polygon/MultiPolygon feature into 3D line loops. */
export function geojsonToRings(
  geojson: {
    type: string;
    coordinates: number[][][] | number[][][][];
  },
  radius: number,
): CountryRing[] {
  const rings: CountryRing[] = [];
  const pushRing = (ring: number[][]) => {
    const points = ring.map(([lon, lat]) =>
      latLonToVector3(lat, lon, radius).clone(),
    );
    rings.push({ points });
  };
  if (geojson.type === "Polygon") {
    (geojson.coordinates as number[][][]).forEach(pushRing);
  } else if (geojson.type === "MultiPolygon") {
    (geojson.coordinates as number[][][][]).forEach((poly) =>
      poly.forEach(pushRing),
    );
  }
  return rings;
}

export interface HonduranSite {
  name: string;
  lat: number;
  lon: number;
  note: string;
}

/** Points of interest for phase 1 — real Honduran monitoring regions. */
export const HONDURAN_SITES: HonduranSite[] = [
  {
    name: "Valle de Sula",
    lat: 15.08,
    lon: -87.98,
    note: "Inundaciones · Cortés",
  },
  {
    name: "Valle del Aguán",
    lat: 15.62,
    lon: -85.85,
    note: "Deforestación · Colón",
  },
  {
    name: "Reserva Biósfera Río Plátano",
    lat: 15.53,
    lon: -84.6,
    note: "Cobertura forestal · Olancho",
  },
  { name: "Tegucigalpa", lat: 14.07, lon: -87.19, note: "Subsidencia urbana" },
];
