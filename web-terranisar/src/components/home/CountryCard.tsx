import { Plasma } from "@cruxgarden/plasma-ui";

interface CountryCardProps {
  onExplore: () => void;
}

const COUNTRIES = ["Guatemala", "Nicaragua", "El Salvador"];

export function CountryCard({ onExplore }: CountryCardProps) {
  return (
    <Plasma
      as="section"
      fuse={false}
      lean={false}
      elevation={0.4}
      className="rise-in pointer-events-auto w-[300px] p-4"
      aria-label="Selección de país"
    >
      <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Territorio
      </h2>

      <p className="text-lg font-bold tracking-tight">Honduras</p>

      <p className="mb-4 px-0.5 text-[12px] text-muted-foreground">
        Última adquisición: <span className="font-mono-data">12 nov 2026</span>
      </p>

      <button
        type="button"
        onClick={onExplore}
        className="mb-4 flex w-full items-center justify-between rounded-xl bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary"
      >
        Explorar territorio
        <span aria-hidden>→</span>
      </button>

      <ul className="space-y-0.5 border-t border-white/10 pt-2">
        {COUNTRIES.map((name) => (
          <li
            key={name}
            className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground"
          >
            {name}
          </li>
        ))}
      </ul>
    </Plasma>
  );
}
