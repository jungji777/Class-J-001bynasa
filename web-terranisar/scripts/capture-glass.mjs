import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "https://j7g9tnvy4z82iew4sgp9t-web-terranisar.rork.live";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const [route, name] of [
  ["/", "home"],
  ["/explorar", "explorar"],
  ["/comparar", "comparar"],
  ["/analizar", "analizar"],
]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `.rork/tmp/glass-${name}.png` });
}

await browser.close();
console.log("capturas listas");
