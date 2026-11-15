import { useEffect, useState } from "react";

export interface DepartmentGeometry {
  name: string;
  /** Anillos de polígonos, cada punto como [lon, lat]. */
  polys: number[][][];
}

export interface HondurasGeodata {
  departments: DepartmentGeometry[];
  countryBorder: number[][];
}

/**
 * Límites administrativos de Honduras (una sola carga por sesión).
 * Fuente: geoBoundaries gbOpen HND ADM1 (simplificado), licencia ODbL.
 */
export function useHondurasGeodata(): HondurasGeodata {
  const [geodata, setGeodata] = useState<HondurasGeodata>({
    departments: [],
    countryBorder: [],
  });

  useEffect(() => {
    let alive = true;

    interface GeoJsonFeature {
      properties: { shapeName?: string };
      geometry: { type: string; coordinates: unknown };
    }

    fetch("/geo/hnd-departments.geojson")
      .then((r) => r.json())
      .then((g: { features: GeoJsonFeature[] }) => {
        if (!alive) return;
        setGeodata((prev) => ({
          ...prev,
          departments: g.features.map((f) => ({
            name: f.properties.shapeName ?? "—",
            polys: (
              f.geometry.type === "Polygon"
                ? f.geometry.coordinates
                : (f.geometry.coordinates as number[][][][]).flat()
            ) as number[][][],
          })),
        }));
      })
      .catch(() => undefined);

    fetch("/geo/hnd.json")
      .then((r) => r.json())
      .then((g: { features: GeoJsonFeature[] }) => {
        if (!alive) return;
        const geom = g.features[0].geometry;
        setGeodata((prev) => ({
          ...prev,
          countryBorder: ((geom.coordinates as number[][][])[0] ??
            []) as number[][],
        }));
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return geodata;
}
