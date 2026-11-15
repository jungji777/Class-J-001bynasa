import { useQuery } from "@tanstack/react-query";
import { HONDURAS_POINT, searchNisar } from "@/lib/asf/client";

export const NISAR_QUERY_KEY = ["asf", "nisar"] as const;

/** Adquisiciones NISAR reales que intersectan un área WKT (p. ej. un
 *  departamento o un polígono dibujado). Devuelve hasta `maxResults`.
 *  `wkt === null` desactiva la consulta. */
export function useNisarByPolygon(
  wkt: string | null,
  processingLevels: string[],
  maxResults = 200,
) {
  return useQuery({
    queryKey: [...NISAR_QUERY_KEY, "polygon", wkt, processingLevels, maxResults],
    queryFn: ({ signal }) =>
      searchNisar({
        areaWkt: wkt ?? undefined,
        processingLevels,
        maxResults,
        signal,
      }),
    enabled: !!wkt,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

/** Adquisiciones NISAR reales sobre Honduras desde el ASF SearchAPI. */
export function useNisarGranules(processingLevels: string[]) {
  return useQuery({
    queryKey: [...NISAR_QUERY_KEY, HONDURAS_POINT, processingLevels],
    queryFn: ({ signal }) =>
      searchNisar({
        lon: HONDURAS_POINT.lon,
        lat: HONDURAS_POINT.lat,
        processingLevels,
        maxResults: 30,
        signal,
      }),
    staleTime: 10 * 60 * 1000, // 10 min: datos de misión, no cambian rápido
    retry: 1,
  });
}
