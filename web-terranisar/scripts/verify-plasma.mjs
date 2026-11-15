/* Verificación rápida post-Plasma: portada + 3 vistas, consola limpia. */
import { chromium } from "playwright";

const BASE = "https://1lntkb7en6515jwijtg4l-web-terranisar.rork.live";
const routes = [
  { path: "/", name: "home" },
  { path: "/explorar", name: "explorar" },
  { path: "/comparar", name: "comparar" },
  { path: "/analizar", name: "analizar" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`${page.url()}: ${msg.text()}`);
});
page.on("pageerror", (err) => consoleErrors.push(`${page.url()}: PAGEERROR ${err.message}`));

for (const r of routes) {
  await page.goto(BASE + r.path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")];
    return {
      canvases: canvases.length,
      plasmaDom: !!document.querySelector("[data-plasma], .plasma-surface") || canvases.length > 1,
      text: document.body.innerText.slice(0, 200),
    };
  });
  await page.screenshot({ path: `.rork/tmp/plasma-${r.name}.png` });
  console.log(`[${r.name}] canvases=${info.canvases} plasmaDom=${info.plasmaDom}`);
}

// Interacción en portada: drag sobre el globo + zoom
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);
await page.mouse.move(720, 500);
await page.mouse.down();
await page.mouse.move(560, 420, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1200);
const coordsVisible = await page.evaluate(() => {
  const chip = document.querySelector(".font-mono-data");
  return !!chip;
});
await page.screenshot({ path: ".rork/tmp/plasma-home-after-drag.png" });
console.log(`[drag] chip coords presente=${coordsVisible}`);
console.log("console errors:", consoleErrors.length ? consoleErrors : "ninguno");
await browser.close();
