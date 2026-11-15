# Fuentes de datos y citas — Class J-001

Plataforma de exploración y análisis de cambios terrestres mediante
observaciones satelitales SAR de la misión NISAR. Todos los datos mostrados
son reales y se citan granule a granule. **No hay datos simulados en la
aplicación**: si una fuente no está disponible, la app muestra un estado de
error o vacío en lugar de sustituir el dato.

## 1. Imágenes y metadatos SAR — Misión NISAR

- **Misión:** NISAR (NASA-ISRO Synthetic Aperture Radar), misión conjunta de
  NASA (Jet Propulsion Laboratory) y la Organización India de Investigación
  Espacial (ISRO). Lanzamiento: 30 de julio de 2025. Radar de banda L (24 cm)
  y banda S.
- **Qué se muestra:** quicklooks (imágenes de vista previa PNG) de productos
  L1 (`RSLC`) y L2 (`GCOV`), junto a los metadatos de cada granule: fecha y
  hora de adquisición (UTC), dirección de vuelo, pista (`pathNumber`), marco
  (`frameNumber`), fecha de procesamiento, tamaño del producto HDF5 y
  footprint geográfico.
- **Cita del granule:** cada imagen mostrada lleva el `fileID` completo del
  granule visible en la interfaz, p. ej.
  `NISAR_L2_PR_GCOV_035_004_A_010_0005_NADV_A_20261105T110705_20261105T110724_P05036_N_P_J_001`.
- **Enlace permanente:** cada granule enlaza a su ficha en ASF Vertex:
  `https://search.asf.alaska.edu/#/?dataset=NISAR&granule_list=<fileID>`.

## 2. Búsqueda en vivo — ASF SearchAPI (ASF DAAC, NASA)

- **Endpoint:** `https://api.daac.asf.alaska.edu/services/search/param`
- **Consulta usada por la app:** `dataset=NISAR`, `processingLevel=GCOV|RSLC`,
  `intersectsWith=POINT(-86.6 14.85)` (centro de Honduras), `output=geojson`.
- **Autenticación:** no se requiere credencial para búsqueda, metadatos ni
  quicklooks. La app consulta la API en vivo desde el navegador cada vez que
  se abre la vista de exploración o comparación (caché de 10 minutos).
- **Documentación oficial:** https://docs.asf.alaska.edu/api/basics/ y
  https://docs.asf.alaska.edu/api/keywords/

## 3. Distribución de imágenes — ASF Earthdata Cloud

- Los PNG de vista previa (browse) se sirven públicamente desde
  `nisar.asf.earthdatacloud.nasa.gov` (redirección firmada, CORS abierto).
  Son el producto visual oficial de la misión: el visor 1:1 de la app los
  muestra sin recompresión, a resolución nativa — no existe ninguna API
  oficial de NASA/ASF que distribuya imágenes rasterizadas de mayor
  resolución que estos PNG.
- Los productos científicos completos (HDF5, ~7 GB por granule de GCOV,
  malla de 10–20 m/píxel) requieren una cuenta gratuita de NASA Earthdata
  (https://www.earthdata.nasa.gov/). La app integra el flujo oficial:
  1. Iniciar sesión en Earthdata Login (https://urs.earthdata.nasa.gov/)
     desde el mismo navegador.
  2. Descargar el HDF5 original desde la URL oficial del granule
     (`nisar.asf.earthdatacloud.nasa.gov/…/*.h5`), que el navegador sirve
     con la sesión EDL — el mismo mecanismo de cookiejar que usa el SDK
     oficial `asf_search`.
- También se enlaza a la ficha del granule en ASF Vertex
  (`https://search.asf.alaska.edu/#/?dataset=NISAR&granule_list=<fileID>`).

## 4. Límites administrativos — geoBoundaries

- **Archivo:** `public/geo/hnd-departments.geojson`
- **Fuente:** geoBoundaries `gbOpen` HND ADM1 (simplificado),
  https://www.geoboundaries.org/ — 18 departamentos de Honduras.
- **Licencia:** Open Data Commons Open Database License (ODbL).
  https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/LICENSE

## 5. Contorno del país — world.geo.json / Natural Earth

- **Archivo:** `public/geo/hnd.json`
- **Fuente:** https://github.com/johan/world.geo.json (polígono de Honduras),
  derivado de Natural Earth (dominio público).

## 6. Textura nocturna del globo — NASA Black Marble

- **Archivo:** `public/textures/earth-night.jpg`
- **Fuente:** NASA Visible Earth / Scientific Visualization Studio, distribuida
  como material de ejemplo del paquete `three-globe` (licencia MIT del
  paquete; la imagen original es cortesía de NASA).
  https://github.com/vasturiano/three-globe

## 7. Bibliotecas

- React, Three.js, TanStack Query, topojson-client y el resto de dependencias
  de `package.json` (licencias MIT/BSD/Apache-2.0 según el caso).

## Nota metodológica

El comparador presenta la **diferencia visual entre quicklooks**, que son
imágenes de vista previa con mejora de contraste; no constituye un análisis
radiométrico de cambio. Para análisis científico (umbral de retrodispersión,
relación de coherencia InSAR), descargar los productos HDF5 originales desde
el visor (flujo Earthdata Login descrito arriba) o desde ASF Vertex, y
procesarlos fuera de la app (GDAL, ISCE, ASF HyP3).
