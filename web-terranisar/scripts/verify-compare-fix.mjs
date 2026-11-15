/* Verificación del fix del comparador: elegir la fecha más antigua en "Antes"
   debe persistir (sin reinicializarse) y permitir comparar con la más reciente. */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "https://2humd45wp22u132c5l7sp-web-terranisar.rork.live";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(`${page.url()}: ${m.text()}`);
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR ${e.message}`));

await page.goto(`${BASE}/comparar`, { waitUntil: "networkidle", timeout: 60000 });

// Espera a que los dos selects tengan opciones reales (datos del ASF cargados)
await page.waitForFunction(
  () => {
    const selects = [...document.querySelectorAll("select")];
    return (
      selects.length === 2 &&
      selects.every((s) => [...s.options].filter((o) => o.value !== "").length >= 3)
    );
  },
  { timeout: 60000 },
);

const readSelects = () =>
  page.$$eval("select", (els) =>
    els.map((s) => ({
      value: s.value,
      label: s.selectedOptions[0]?.textContent?.trim() ?? "",
    })),
  );

const [antes0, despues0] = await readSelects();
console.log(`inicial  · antes="${antes0.label}" despues="${despues0.label}"`);

// Elegir la opción MÁS ANTIGUA disponible en el select "Antes"
const oldest = await page.$$eval("select", (els) => {
  const s = els[0];
  const opts = [...s.options].filter((o) => o.value !== "");
  // Las fechas vienen como "31 oct 2026 · p34 f105": comparar por valor de fecha
  // reconstruida no es trivial; tomar la ÚLTIMA de la lista (la API ordena
  // descendente) y devolver su value y label.
  const last = opts[opts.length - 1];
  return { value: last.value, label: last.textContent.trim() };
});

await page.selectOption("select >> nth=0", oldest.value);
await page.waitForTimeout(1200); // dar tiempo a que React re-renderice

const [antes1, despues1] = await readSelects();
console.log(`después  · antes="${antes1.label}" despues="${despues1.label}"`);

const persisted =
  antes1.value === oldest.value &&
  antes1.label === oldest.label &&
  despues1.value !== oldest.value;

// Ahora elegir la MÁS RECIENTE en "Después" y comprobar que "Antes" sigue fijo
const newest = await page.$eval("select >> nth=1", (s) => {
  const opts = [...s.options].filter((o) => o.value !== "");
  return opts[0].value;
});
await page.selectOption("select >> nth=1", newest);
await page.waitForTimeout(1200);

const [antes2, despues2] = await readSelects();
console.log(`final    · antes="${antes2.label}" despues="${despues2.label}"`);

const stillFixed = antes2.value === oldest.value && despues2.value === newest;
const deltaShown = await page
  .locator("aside span", { hasText: /d[ií]as/ })
  .count()
  .then((n) => n > 0);

await page.screenshot({ path: ".rork/tmp/verify-compare-fix.png" });

console.log(`---`);
console.log(`elegir más antigua en "Antes" persiste: ${persisted ? "OK" : "FALLA"}`);
console.log(`persiste tras cambiar "Después":        ${stillFixed ? "OK" : "FALLA"}`);
console.log(`Δ días visible:                          ${deltaShown ? "OK" : "FALLA"}`);
console.log(`errores de consola:                      ${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join("\n"));

await browser.close();
if (!persisted || !stillFixed || !deltaShown || consoleErrors.length) process.exit(1);
