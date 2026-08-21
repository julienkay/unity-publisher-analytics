import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const root = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const output = join(root, "marketing", "screenshots");
const themes = new Set(["light", "dark"]);
const args = process.argv.slice(2);
const selectedTheme = args.find(argument => themes.has(argument)) || "light";
const captureArgs = args.filter(argument => !themes.has(argument));
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
  ["07-settings", "settings"]
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
  if (selectedTheme === "dark") await page.locator("#upa-root.upa-theme-dark").waitFor({ state: "attached" });
  await page.waitForTimeout(300);
  const outputName = selectedTheme === "light" ? name : `${name}-${selectedTheme}`;
  const source = join(output, `.${outputName}-source.png`);
  const destination = join(output, `${outputName}.png`);
  await page.screenshot({ path: source });
  await sharp(source)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .resize(1280, 800, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ palette: false, compressionLevel: 9 })
    .toFile(destination);
  await rm(source, { force: true });
  console.log(`${outputName}.png`);
};
try {
  for (const item of captures.filter(([name]) => !requested || name === requested)) await capture(...item);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
