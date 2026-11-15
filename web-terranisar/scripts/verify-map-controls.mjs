import { chromium } from "playwright";

// Verifica que los controles del mapa (zoom +/− y reciente con N):
//  1. reciben el pointer event (hit-target: elementFromPoint sobre el botón,
//     antes del fix el canvas del globo lo interceptaba),
//  2. disparan su handler (force click; el chequeo de estabilidad de Playwright
//     no concluye porque Plasma micro-anima el panel en continuo),
//  3. el zoom cambia la vista (diff de capturas del canvas).
const base = process.env.BASE_URL ?? "https://j7g9tnvy4z82iew4sgp9t-web-terranisar.rork.live";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const canvas = () => page.locator("canvas").last();

const hitTest = async (label) => {
  const hit = await page.evaluate((aria) => {
    const btn = document.querySelector(`button[aria-label="${aria}"]`);
    if (!btn) return "MISSING";
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    // OK si el punto cae en el botón o en un descendiente (el evento burbujea)
    return hit && btn.contains(hit) ? "OK" : "INTERCEPTED";
  }, label);
  console.log(`hit-target "${label}": ${hit}`);
  if (hit !== "OK") process.exit(1);
};

for (const label of ["Acercar", "Alejar", "Centrar sobre Honduras"]) {
  await hitTest(label);
  await page.locator(`button[aria-label="${label}"]`).click({ force: true });
  await page.waitForTimeout(700);
}

// Fuentes en Explorar, también anclado abajo a la derecha
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page2.goto(`${base}/explorar`, { waitUntil: "networkidle" });
await page2.waitForTimeout(3000);
const hitF = await page2.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Fuentes de datos y citas"]');
  if (!btn) return "MISSING";
  const r = btn.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return hit && btn.contains(hit) ? "OK" : "INTERCEPTED";
});
console.log(`hit-target "Fuentes": ${hitF}`);
if (hitF !== "OK") process.exit(1);

// Zoom pronunciado para ver el cambio de escala (en la portada)
const shot = () => page.screenshot({ clip: { x: 0, y: 0, width: 720, height: 720 } });
const before = await shot();
for (let i = 0; i < 5; i++) {
  await page.locator('button[aria-label="Acercar"]').click({ force: true });
  await page.waitForTimeout(550);
}
const after = await shot();
console.log(`canvas cambia con zoom: ${before.equals(after) ? "NO" : "SÍ"}`);
if (before.equals(after)) process.exit(1);

await page.screenshot({ path: ".rork/tmp/verify-controls.png" });
await browser.close();

if (errors.length) {
  console.error(`errores de consola: ${errors.length}`);
  errors.slice(0, 5).forEach((e) => console.error(e));
  process.exit(1);
}
console.log("errores de consola: 0");
console.log("controles del mapa OK");
