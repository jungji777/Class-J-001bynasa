import { Plasma } from "@cruxgarden/plasma-ui";
import { LayersMenu, type LayersMenuProps } from "@/components/home/LayersMenu";

interface TopBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  layers: LayersMenuProps["layers"];
  onLayersChange: LayersMenuProps["onChange"];
}

export function TopBar({
  search,
  onSearchChange,
  onSearchSubmit,
  layers,
  onLayersChange,
}: TopBarProps) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-5 md:p-7">
      <Plasma
        fuse={false}
        lean={false}
        className="pointer-events-auto flex items-center px-4 py-3 rise-in"
      >
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight">
            Class <span className="text-primary">J-001</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            NASA · ISRO · SAR
          </p>
        </div>
      </Plasma>

      <Plasma
        as="form"
        fuse={false}
        lean={false}
        className="pointer-events-auto hidden flex-1 items-center px-4 py-3 rise-in sm:flex md:max-w-md md:mx-auto"
        style={{ animationDelay: "80ms" }}
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
      >
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar lugar o coordenadas (14.07, -87.19)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          aria-label="Buscar lugar o coordenadas"
        />
      </Plasma>

      <div
        className="pointer-events-auto rise-in"
        style={{ animationDelay: "160ms" }}
      >
        <LayersMenu layers={layers} onChange={onLayersChange} />
      </div>
    </header>
  );
}
