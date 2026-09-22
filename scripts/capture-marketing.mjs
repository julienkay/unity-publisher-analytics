import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const root = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const output = join(root, "marketing", "screenshots");
const themes = new Set(["light", "dark"]);
const formats = new Set(["png", "webp"]);
const args = process.argv.slice(2);
const selectedTheme = args.find(argument => themes.has(argument)) || "light";
const selectedFormat = args.find(argument => formats.has(argument)) || "png";
const captureArgs = args.filter(argument => !themes.has(argument) && !formats.has(argument));
if (captureArgs.length > 1) throw new Error(`Expected at most one capture name, received: ${captureArgs.join(" ")}`);
const requested = captureArgs[0];
const captures = [
  ["00-first-sync", "dashboard", "revenue", "sync=1"],
  ["01-dashboard", "dashboard"],
  ["02-revenue", "analytics", "revenue"],
  ["03-package-lifetime", "analytics", "lifetime"],
  ["04-daily-calendar", "analytics", "calendar"],
  ["05-revenue-composition", "analytics", "sankey"],
  ["06-packages", "analytics", "packages"],
  ["07-settings", "settings"],
  ["08-package-detail", "dashboard", "revenue", "openPackage=icons"]
];
if (requested && !captures.some(([name]) => name === requested)) {
  throw new Error(`Unknown capture name "${requested}". Expected one of: ${captures.map(([name]) => name).join(", ")}`);
}
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "scripts/marketing-preview.html";
    const path = normalize(join(root, relative));
    if (!path.startsWith(root)) throw new Error("Invalid path");
    const body = await readFile(path);
    response.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, colorScheme: selectedTheme, reducedMotion: "reduce" });
const capture = async (name, section, view = "revenue", extra = "") => {
  const query = new URLSearchParams({ section, view, theme: selectedTheme });
  for (const [key, value] of new URLSearchParams(extra)) query.set(key, value);
  await page.goto(`http://127.0.0.1:${port}/scripts/marketing-preview.html?${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#upa-root")?.textContent.includes("Northstar Studio"));
  if (!extra.includes("sync=1")) await page.evaluate(() => window.__openAnalytics());
  await page.locator(".upa-panel").waitFor({ state: "visible" });
  const packageId = new URLSearchParams(extra).get("openPackage");
  let allPackageClaims = 0;
  if (packageId) {
    const packageButton = page.locator(`.upa-dashboard-packages button[data-package-id="${packageId}"]`);
    const packageName = await packageButton.locator(".upa-package-name").textContent();
    await packageButton.click();
    await page.locator(".upa-view-package").waitFor({ state: "visible" });
    if (await page.locator(".upa-header-copy h1").textContent() !== packageName) throw new Error("The main header must identify the selected package.");
    if (await page.locator(".upa-view-package .upa-page-back, .upa-package-detail-heading").count()) throw new Error("The package page must not repeat its main heading or back link.");
    const expected = await page.evaluate(id => {
      const rows = window.__UPA_MARKETING_FIXTURE__.records.filter(row => row.type === "daily" && row.scope === "package" && row.packageId === id);
      return ["paidQty", "freeQty", "salesQty", "pageViews", "downloads", "sales"].map(field => rows.reduce((sum, row) => sum + row[field], 0));
    }, packageId);
    allPackageClaims = expected[1];
    const displayed = await page.locator(".upa-package-detail-metrics dl dd").allTextContents();
    for (const [shownIndex, expectedIndex] of [[0, 0], [1, 1], [2, 3], [4, 4]]) {
      if (Number(displayed[shownIndex]?.replace(/[^\d.-]/g, "")) !== expected[expectedIndex]) throw new Error("Package metrics do not match its daily records.");
    }
    const metricLabels = await page.locator(".upa-package-detail-metrics dl dt").allTextContents();
    if (metricLabels.some(label => label.includes("Sales & Claims"))) throw new Error("The package metrics must not show a combined Sales & Claims total.");
    if (!metricLabels.some(label => label.includes("Claims"))) throw new Error("The package metrics must show nonzero free claims.");
    if (await page.locator(".upa-revenue-heatmap-key").count()) throw new Error("The revenue heatmap must not show a color legend.");
    const conversionHelp = page.locator('.upa-package-detail-metrics .upa-kpi-help[aria-label="About package conversion"]');
    if (await conversionHelp.locator(".upa-kpi-tooltip").textContent() !== "Paid sales and free claims divided by pageviews.") throw new Error("Conversion must mention free claims when the selected range has them.");
    await conversionHelp.hover();
    if (!await conversionHelp.locator(".upa-kpi-tooltip").isVisible()) throw new Error("The conversion explanation must appear in an info tooltip.");
    await page.mouse.move(0, 0);
    await conversionHelp.focus();
    if (!await conversionHelp.locator(".upa-kpi-tooltip").isVisible()) throw new Error("The conversion info tooltip must be keyboard-accessible.");
    await conversionHelp.evaluate(element => element.blur());
    const heatmapCells = await page.locator(".upa-revenue-heatmap tbody td[aria-label]:not(.upa-heatmap-unavailable)").allTextContents();
    if (heatmapCells.reduce((sum, text) => sum + Number(text.replace(/[^\d.-]/g, "")), 0) !== expected[5]) throw new Error("Revenue heatmap does not match the package's daily revenue.");
    if (!await page.locator(".upa-revenue-heatmap .upa-heatmap-unavailable").count()) throw new Error("The revenue heatmap must distinguish months without selected-range data.");
    await page.locator("#upa-package-revenue-chart svg").waitFor({ state: "visible" });
    await page.locator("#upa-package-units-chart svg").waitFor({ state: "visible" });
    await page.setViewportSize({ width: 600, height: 900 });
    const metricBox = await page.locator(".upa-package-detail-metrics").boundingBox();
    const chartBox = await page.locator(".upa-package-detail-charts").boundingBox();
    if (!metricBox || !chartBox || metricBox.y >= chartBox.y) throw new Error("Package metrics do not stack above the charts on narrow screens.");
    const heatmapScrolls = await page.locator(".upa-revenue-heatmap-scroll").evaluate(element => element.scrollWidth > element.clientWidth);
    if (!heatmapScrolls) throw new Error("The revenue heatmap must scroll instead of compressing its month columns on narrow screens.");
    await page.setViewportSize({ width: 1600, height: 1000 });
  }
  if (selectedTheme === "dark") await page.locator("#upa-root.upa-theme-dark").waitFor({ state: "attached" });
  await page.waitForTimeout(300);
  const outputName = selectedTheme === "light" ? name : `${name}-${selectedTheme}`;
  const source = join(output, `.${outputName}-source.png`);
  const destination = join(output, `${outputName}.${selectedFormat}`);
  await page.screenshot({ path: source });
  const image = sharp(source)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .resize(1280, 800, { fit: "fill", kernel: sharp.kernel.lanczos3 });
  if (selectedFormat === "webp") {
    await image.webp({ quality: 95, effort: 6, smartSubsample: true }).toFile(destination);
  } else {
    await image.png({ palette: false, compressionLevel: 9 }).toFile(destination);
  }
  await rm(source, { force: true });
  if (name === "06-packages") {
    await page.locator('button[data-action="range-toggle"]').click();
    await page.locator('button[data-range-option="7d"]').click();
    const selectedRange = await page.locator(".upa-range-trigger b").textContent();
    const packageRows = page.locator(".upa-view-packages button.upa-package-row[data-package-id]");
    if (await packageRows.count() < 2) throw new Error("The Packages list must expose its entries as links to package details.");
    for (const position of ["first", "last"]) {
      const row = position === "first" ? packageRows.first() : packageRows.last();
      const packageName = await row.locator("strong").textContent();
      if (!await row.getAttribute("data-package-id")) throw new Error("A Packages entry has no package ID.");
      if (position === "first") { await row.focus(); await row.press("Enter"); }
      else await row.click();
      await page.locator(".upa-view-package").waitFor({ state: "visible" });
      if (await page.locator(".upa-header-copy h1").textContent() !== packageName) throw new Error("A Packages entry opened the wrong package.");
      if (await page.locator(".upa-range-trigger b").textContent() !== selectedRange) throw new Error("Opening a package changed the selected time range.");
      await page.locator('.upa-primary-nav button[data-section="analytics"]').click();
      await page.locator(".upa-view-packages").waitFor({ state: "visible" });
    }
  }
  if (packageId) {
    await page.locator('button[data-action="range-toggle"]').click();
    await page.locator('button[data-range-option="7d"]').click();
    const recentClaims = Number((await page.locator(".upa-package-detail-metrics dl dd").nth(1).textContent()).replace(/[^\d.-]/g, ""));
    if (!(recentClaims < allPackageClaims)) throw new Error("The package metrics did not respond to the selected range.");
    await page.locator('.upa-primary-nav button[data-section="dashboard"]').click();
    await page.locator(".upa-view-dashboard").waitFor({ state: "visible" });
    await page.locator('.upa-dashboard-packages button[data-package-id="aurora"]').click();
    await page.locator(".upa-view-package").waitFor({ state: "visible" });
    const paidOnlyLabels = await page.locator(".upa-package-detail-metrics dl dt").allTextContents();
    if (paidOnlyLabels.some(label => label.includes("Claims"))) throw new Error("The package metrics must hide zero free claims.");
    if (await page.locator('.upa-package-detail-metrics .upa-kpi-help[aria-label="About package conversion"] .upa-kpi-tooltip').textContent() !== "Sales divided by pageviews.") throw new Error("Conversion must omit free claims when the selected range has none.");
    if (await page.locator("#upa-package-units-chart").count()) throw new Error("The acquisition chart must be hidden when claims are zero.");
    await page.setViewportSize({ width: 600, height: 900 });
    await page.locator('.upa-mobile-nav button[data-section="dashboard"]').click();
    await page.locator(".upa-view-dashboard").waitFor({ state: "visible" });
    await page.setViewportSize({ width: 1600, height: 1000 });
  }
  console.log(`${outputName}.${selectedFormat}`);
};
try {
  for (const item of captures.filter(([name]) => !requested || name === requested)) await capture(...item);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
