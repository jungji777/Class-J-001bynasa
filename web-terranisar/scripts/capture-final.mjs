import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "https://2humd45wp22u132c5l7sp-web-terranisar.rork.live";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: ".rork/tmp/final-home.png" });

// Comparar: explorar -> seleccionar primer granule
await page.goto(`${base}/explorar`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const items = page.locator("button", { hasText: "Comparar" });
if (await items.count()) {
  await items.first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: ".rork/tmp/final-comparar.png" });
} else {
  console.log("sin botón Comparar visible");
}

await browser.close();
console.log("capturas listas");
