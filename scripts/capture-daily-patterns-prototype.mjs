import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const output = join(root, "marketing", "prototypes");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "scripts/daily-patterns-prototype-preview.html";
    const path = normalize(join(root, relative));
    if (!path.startsWith(root)) throw new Error("Invalid path");
    response.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(path));
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
await mkdir(output, { recursive: true });

const executablePath = process.env.UPA_BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
try {
  await page.goto(`http://127.0.0.1:${port}/scripts/daily-patterns-prototype-preview.html`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector("#upa-root")?.textContent.includes("Atlas Forge Studio"), null, { timeout: 120000 });
  await page.evaluate(() => window.__openAnalytics());
  await page.locator(".upa-view-calendar").waitFor({ state: "visible", timeout: 120000 });
  await page.locator("#upa-calendar-chart svg").waitFor({ state: "visible", timeout: 120000 });
  const assetCount = await page.locator('.upa-view-calendar .upa-section-tools>span').textContent();
  const dailySlices = await page.locator('.upa-view-calendar .upa-insight-facts>span').nth(1).locator("strong").textContent();
  if (assetCount?.trim() !== "30 assets") throw new Error(`Expected 30 assets, received "${assetCount}".`);
  if (Number(dailySlices?.replace(/\D/g, "")) < 1600) throw new Error(`Expected more than 1,600 daily slices, received "${dailySlices}".`);
  await page.locator('button[data-calendar-style="calendar"]').click();
  await page.getByRole("heading", { name: "Daily activity calendar" }).waitFor({ state: "visible", timeout: 120000 });
  await page.locator('button[data-calendar-style="assets"]').click();
  await page.getByRole("heading", { name: "Daily activity by asset" }).waitFor({ state: "visible", timeout: 120000 });
  await page.locator("#upa-calendar-chart svg").waitFor({ state: "visible", timeout: 120000 });
  await page.waitForTimeout(1200);
  const destination = join(output, "daily-patterns-asset-heatmap.png");
  await page.screenshot({ path: destination });
  console.log(destination);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
