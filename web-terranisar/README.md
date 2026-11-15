# TerraNISAR — Class J-001 (web)

Exploración de adquisiciones reales de la misión **NISAR (NASA · ISRO)** sobre Honduras,
consultadas en vivo desde el **ASF SearchAPI** (Alaska Satellite Facility DAAC). Interfaz
en español con estética orbital nocturna y superficies de vidrio líquido.

## Lenguaje y stack

| Área | Tecnología |
| --- | --- |
| Lenguaje | **TypeScript** (modo estricto) |
| UI | **React 19** |
| Build | **Vite 8** |
| Estilos | **Tailwind CSS 3** + CSS propio (`src/index.css`, clases `glass` / `glass-strong`) |
| 3D | **Three.js** (globo nocturno con OrbitControls) |
| Datos | **@tanstack/react-query** (caché y estados de carga de la API) |
| Navegación | **react-router-dom** |
| Validación | **zod** + **react-hook-form** |
| Gestor de paquetes | **bun** |

## Páginas (`src/pages/`)

| Archivo | Ruta | Descripción |
| --- | --- | --- |
| `Index.tsx` | `/` | Portada: globo 3D nocturno, buscador de lugares/coordenadas, selección de territorio y controles del mapa |
| `Explore.tsx` | `/explorar` | Mapa SAR real de Honduras con capas, línea de tiempo de adquisiciones y time-lapse |
| `Compare.tsx` | `/comparar` | Comparación A/B de dos adquisiciones con Δ de días y deslizador vertical |
| `Analyze.tsx` | `/analizar` | Análisis por departamento con serie temporal e histograma de cobertura |
| `NotFound.tsx` | `*` | Página 404 |

## Componentes

### Portada (`src/components/home/`)
- **`TopBar.tsx`** — marca, buscador (sitios de Honduras o coordenadas) y menú de capas.
- **`CountryCard.tsx`** — selector de territorio (Honduras activa; Guatemala, Nicaragua y El Salvador pendientes).
- **`MapControls.tsx`** — `ZoomControls` (+/−), `NorthIndicator` (recientra el globo), `MissionBadge` (estado de NISAR) y `CursorChip` (coordenadas bajo el cursor).
- **`LayersMenu.tsx`** — interruptores de límite, luces nocturnas y retícula.

### Globo (`src/components/globe/`)
- **`GlobeCanvas.tsx`** — globo Three.js: textura nocturna, atmósfera fresnel, estrellas, frontera de Honduras, cola de zoom y vuelos (`zoomBy` / `flyTo`); detecta ausencia de WebGL.
- **`GlobeFlat.tsx`** — respaldo 2D cuando WebGL no está disponible.

### Explorar (`src/components/explore/`)
- **`RealSarMap.tsx`** — mapa SAR georreferenciado con el granule seleccionado.
- **`LayersPanel.tsx`** — producto (GCOV/RSLC), vistas del quicklook, opacidad y departamentos.
- **`Timeline.tsx`** — línea de tiempo de adquisiciones con reproducción.

### Comparar (`src/components/compare/`)
- **`RealCompareView.tsx`** — visor A/B con deslizador y visor 1:1.
- **`StatsPanel.tsx`** — fichas de cada granule (pasada, hora, producto, HDF5) y Δ de días.

### Analizar (`src/components/analyze/`)
- **`AnalysisMap.tsx`** — mapa de departamentos con cobertura.
- **`SeriesPanel.tsx`** — serie temporal e histograma mensual por departamento.

### Compartidos
- **`QuicklookViewer.tsx`** — visor a pantalla completa de quicklooks (píxeles nativos 1:1).
- **`DataSourcesDialog.tsx`** — citas y enlaces de las fuentes de datos.
- **`NavLink.tsx`** — enlace de navegación activo.

### `src/components/ui/`
Librería de componentes shadcn/ui (Radix UI). Generada con la plantilla; las pantallas
actuales no la importan directamente, se conserva como base.

## Hooks (`src/hooks/`)

- **`useNisar.ts`** — consulta de granules NISAR al ASF SearchAPI con react-query.
- **`useHondurasGeodata.ts`** — carga de los GeoJSON de Honduras y sus departamentos.
- **`use-mobile.tsx`** — detección de viewport móvil.

## Librerías de dominio (`src/lib/`)

- **`asf/client.ts`** — cliente del ASF SearchAPI: construcción de consultas, tipos
  (`NisarGranule`) y utilidades de formato (fechas, Δ días).
- **`asf/browseImage.ts`** — resolución y precarga de imágenes quicklook.
- **`globe/geo.ts`** — conversión lat/lon ↔ 3D (`latLonToVector3`, `vector3ToLatLon`),
  decodificación de GeoJSON a anillos y sitios de Honduras.
- **`geo.ts`** / **`sar/types.ts`** — utilidades geográficas y tipos SAR.
- **`utils.ts`** — helper `cn` (clsx + tailwind-merge).

## Dependencias principales

| Paquete | Uso |
| --- | --- |
| `three` | Render 3D del globo y la atmósfera |
| `@cruxgarden/plasma-ui` | Superficies Liquid Glass (refracción en tiempo real del canvas del globo) |
| `@tanstack/react-query` | Estados de red y caché de la API de ASF |
| `react-router-dom` | Rutas de las páginas |
| `topojson-client` | Decodificación de geometrías topológicas |
| `date-fns` | Formateo de fechas de adquisición |
| `recharts` | Gráficas (histograma/serie) |
| `sonner` | Notificaciones toast |
| `zod`, `react-hook-form` | Validación de formularios |
| Radix UI (`@radix-ui/*`), shadcn/ui | Primitivas de interfaz en `components/ui/` |

El resto de dependencias (`embla-carousel-react`, `vaul`, `cmdk`, `input-otp`,
`react-day-picker`, `react-resizable-panels`, `next-themes`, `lucide-react`, etc.)
pertenecen a la plantilla shadcn/ui y no participan en las pantallas actuales.

## Desarrollo

```bash
bun install          # instalar dependencias
bun run dev          # servidor de desarrollo
bun run build        # compilación de producción (dist/)
bun run lint         # ESLint
```

Verificación del agente: `rork checks --app web-terranisar --json` (tipos + lint + build).
Los scripts de `scripts/` son pruebas Playwright del comparador y de los controles del mapa:
`node scripts/verify-compare-fix.mjs`, `node scripts/verify-map-controls.mjs`.

## Fuentes de datos

- Imágenes y metadatos: **ASF SearchAPI** (search.asf.alaska.edu), producto NISAR GCOV/RSLC.
- Geometrías: límite y departamentos de Honduras (GeoJSON en `public/geo/`).
- No se generan ni inventan imágenes: todo lo mostrado proviene de las fuentes citadas
  en el diálogo "Fuentes" de la propia app.
