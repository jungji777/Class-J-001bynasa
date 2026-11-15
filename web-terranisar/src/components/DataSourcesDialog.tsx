interface DataSourcesDialogProps {
  open: boolean;
  onClose: () => void;
}

const SOURCES = [
  {
    title: "Imágenes SAR — Misión NISAR (NASA · ISRO)",
    detail:
      "Quicklooks de productos L1/L2 NISAR adquiridos por el radar de banda L. Misión conjunta de NASA (JPL) e ISRO, lanzada el 30 de julio de 2025.",
    link: "https://nisar.jpl.nasa.gov/",
    linkLabel: "nisar.jpl.nasa.gov",
  },
  {
    title: "Metadatos y búsqueda — ASF SearchAPI (ASF DAAC, NASA)",
    detail:
      "Búsqueda en vivo mediante api.daac.asf.alaska.edu/services/search/param con dataset=NISAR, processingLevel e intersectsWith.",
    link: "https://docs.asf.alaska.edu/api/basics/",
    linkLabel: "docs.asf.alaska.edu/api",
  },
  {
    title: "Quicklooks — ASF Earthdata Cloud",
    detail:
      "Los PNG de vista previa se sirven públicamente desde nisar.asf.earthdatacloud.nasa.gov. Los productos completos (HDF5/GeoTIFF) requieren cuenta gratuita de NASA Earthdata.",
    link: "https://search.asf.alaska.edu/",
    linkLabel: "search.asf.alaska.edu (Vertex)",
  },
  {
    title: "Límites departamentales — geoBoundaries",
    detail:
      "geoBoundaries gbOpen HND ADM1 (simplificado), 18 departamentos. Licencia ODbL.",
    link: "https://www.geoboundaries.org/",
    linkLabel: "geoboundaries.org",
  },
  {
    title: "Contorno del país — world.geo.json",
    detail:
      "Polígono de Honduras del conjunto público johan/world.geo.json, derivado de Natural Earth (dominio público).",
    link: "https://github.com/johan/world.geo.json",
    linkLabel: "github.com/johan/world.geo.json",
  },
  {
    title: "Textura nocturna del globo — NASA Black Marble",
    detail:
      "Textura earth-night de NASA Visible Earth (suomi_ppp night lights), distribuida en el paquete three-globe.",
    link: "https://svs.gsfc.nasa.gov/",
    linkLabel: "NASA Scientific Visualization Studio",
  },
];

export function DataSourcesDialog({ open, onClose }: DataSourcesDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Fuentes de datos y citas"
      onClick={onClose}
    >
      <div
        className="glass-strong rise-in max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-lg font-bold tracking-tight">
            Fuentes de datos y citas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <ol className="space-y-3">
          {SOURCES.map((s, i) => (
            <li key={i} className="rounded-xl bg-white/5 p-4">
              <p className="text-[13px] font-semibold">{s.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {s.detail}
              </p>
              <a
                href={s.link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
              >
                {s.linkLabel} <span aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
