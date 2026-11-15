import { useState } from "react";
import { Plasma } from "@cruxgarden/plasma-ui";
import type { GlobeLayers } from "@/components/globe/GlobeCanvas";

export interface LayersMenuProps {
  layers: GlobeLayers;
  onChange: (layers: GlobeLayers) => void;
}

const LAYER_ROWS: { key: keyof GlobeLayers; label: string }[] = [
  { key: "border", label: "Límite de Honduras" },
  { key: "lights", label: "Luces nocturnas" },
  { key: "graticule", label: "Retícula geográfica" },
];

export function LayersMenu({ layers, onChange }: LayersMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Plasma
        as="button"
        type="button"
        fuse={false}
        lean={false}
        opacity={0.3}
        frost={0.22}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Capas del globo"
        className="flex items-center gap-2 px-4 py-3 text-sm font-medium"
      >
        Capas
        <span
          className={`text-[10px] text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </Plasma>

      {open && (
        <Plasma
          fuse={false}
          lean={false}
          elevation={0.5}
          className="rise-in absolute right-0 top-full mt-2 w-64 p-2"
        >
          <div className="flex items-center justify-between px-3 pb-2 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Capas del globo
            </p>
            <button
              type="button"
              onClick={() => onChange({ border: true, lights: true, graticule: false })}
              className="text-[11px] text-muted-foreground transition-colors hover:text-primary"
            >
              Restablecer
            </button>
          </div>
          {LAYER_ROWS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ ...layers, [key]: !layers[key] })}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
              role="switch"
              aria-checked={layers[key]}
            >
              <span className="text-sm font-medium">{label}</span>
              <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  layers[key] ? "bg-primary/80" : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    layers[key] ? "left-[18px]" : "left-[2px]"
                  }`}
                />
              </span>
            </button>
          ))}
        </Plasma>
      )}
    </div>
  );
}
