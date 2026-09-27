import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

// All account data and failures in this test are synthetic. No Unity requests run.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "upa-workspace-test-"));
const output = path.join(root, "marketing", "screenshots");
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.UPA_BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true, ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  const base = worker.url().replace(/background\.js$/, "");
  const publisherId = "synthetic-private-publisher", privateMarker = "PRIVATE-DO-NOT-EXPORT";
  const seed = await worker.evaluate(async ({ publisherId, privateMarker }) => {
    const rows = Array.from({ length: 18000 }, (_, index) => ({
      id: `${publisherId}|${String(index).padStart(6, "0")}`, publisherId,
      type: "revenue", date: "2026-01-01", period: "2026-01", capturedAt: "2026-09-01T00:00:00Z",
      description: privateMarker + "x".repeat(4096), credit: 12345.67, debit: 0, balance: 12345.67
    }));
    await handleDatabaseMessage({ type: "UPA_DB_PUT_MANY", publisherId, records: rows });
    await handleDatabaseMessage({ type: "UPA_DB_PUT_MANY", publisherId: "other-publisher", records: [{ id: "other-row", publisherId: "other-publisher" }] });
    await handleDatabaseMessage({ type: "UPA_DB_SET_META", publisherId, key: "apiSyncV1", value: {
      publisherId, phase: "daily", active: false, completed: 620, total: 1393,
      scopeIndex: 45, monthIndex: 92, cursor: "2022-01-01", packages: [], scopes: [], error: "Synthetic previous failure"
    } });
    return { bytes: JSON.stringify(rows).length, count: rows.length };
  }, { publisherId, privateMarker });
  assert.ok(seed.bytes > 64 * 1024 * 1024);

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route(/^https?:/, route => route.abort());
  async function open(mode = "normal") {
    await page.goto(`${base}manifest.json`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.addStyleTag({ url: `${base}styles.css` });
    await page.evaluate(async publisherId => {
      await chrome.storage.local.set({ [`unityPublisherAnalyticsPrefsV2:${publisherId}`]: { section: "dashboard", range: "all", theme: "light" } });
    }, publisherId);
    await page.evaluate(({ publisherId, privateMarker, mode, base }) => {
      window.testMode = mode;
      window.testRequests = [];
      window.testPages = [];
      const send = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = async message => {
        if (message.type === "UPA_CONSUME_OPEN") return { open: true };
        if (message.type === "UPA_DB_GET_RECORDS_PAGE") {
          if (window.testMode === "storage") throw new Error("Message exceeded maximum allowed size of 64MiB.");
          const result = await send(message);
          window.testPages.push({ count: result.result.rows.length, bytes: JSON.stringify(result).length });
          return result;
        }
        return send(message);
      };
      const get = chrome.storage.local.get.bind(chrome.storage.local);
      chrome.storage.local.get = async key => {
        if (window.testMode === "preferences" && Array.isArray(key)) throw new Error("Synthetic preference read failed.");
        if (window.testMode === "cache" && typeof key === "string") throw new Error("Synthetic display cache read failed.");
        return get(key);
      };
      const timeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => timeout(callback, window.testMode === "timeout" && delay === 45000 ? 1 : delay, ...args);
      const formatter = Intl.NumberFormat;
      if (mode === "render") Intl.NumberFormat = function () { throw new RangeError("Synthetic render failure"); };
      window.restoreFormatter = () => { Intl.NumberFormat = formatter; };
      window.addEventListener("message", event => {
        const message = event.data;
        if (message?.type !== "UPA_API_REQUEST") return;
        window.testRequests.push(message.path);
        if (window.testMode === "timeout") return;
        const status = window.testMode === "auth" ? 401 : 200;
        const data = window.testMode === "missing" ? { name: privateMarker }
          : window.testMode === "html" ? `<html>${privateMarker}</html>`
          : status === 401 ? { message: privateMarker }
          : { publisherId, publisherName: privateMarker, avatar: `${base}icons/publisher-analytics-128.png` };
        window.postMessage({ source: "unity-publisher-analytics-api", type: "UPA_API_RESPONSE", requestId: message.requestId, ok: status === 200, status, data }, location.origin);
      });
    }, { publisherId, privateMarker, mode, base });
    await page.addScriptTag({ url: `${base}content.js` });
  }
  async function report() {
    const settings = page.locator('button[data-action="open-settings"]:visible, button[data-section="settings"]:visible');
    if (!await settings.count()) await page.locator('[data-action="toggle-account"]').click();
    await settings.first().click();
    await page.locator(".upa-support-panel").waitFor();
    const data = JSON.parse(await page.locator(".upa-support-panel pre").textContent());
    const serialized = JSON.stringify(data);
    for (const secret of [publisherId, privateMarker, "12345.67", "other-publisher"]) assert.ok(!serialized.includes(secret), `Report leaked ${secret}`);
    return data;
  }

  await open();
  await page.locator(".upa-dashboard-view").waitFor({ timeout: 60000 });
  const loaded = await report();
  assert.equal(loaded.workspace.loadedRecords, seed.count);
  assert.equal(loaded.workspace.publisherConfirmed, true);
  assert.equal(loaded.sync.completed, 620);
  assert.equal(loaded.sync.active, false);
  const pages = await page.evaluate(() => window.testPages);
  assert.ok(pages.length > 1 && pages.every(item => item.count <= 500 && item.bytes < 1024 * 1024 + 1024));
  assert.deepEqual(await page.evaluate(() => window.testRequests), ["/publisher-v2-api/user"]);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('.upa-support-panel [data-action="download-support"]').click()
  ]);
  const downloaded = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(downloaded.workspace.loadedRecords, seed.count);
  assert.ok(!JSON.stringify(downloaded).includes(privateMarker));
  console.log(`Paged loading passed: ${seed.count} rows, ${(seed.bytes / 1024 / 1024).toFixed(1)} MiB, ${pages.length} messages.`);

  for (const [mode, stage, code] of [
    ["storage", "local-data", "message-too-large"], ["preferences", "preferences", "unexpected-error"],
    ["auth", "identity", "http"], ["missing", "identity", "missing-publisher"],
    ["html", "identity", "missing-publisher"], ["timeout", "identity", "timeout"],
    ["render", "render", "stack-limit"]
  ]) {
    await open(mode);
    await page.locator('[data-action="retry-publisher"]').waitFor({ timeout: 60000 });
    const failed = await report();
    assert.equal(failed.workspace.failure.stage, stage);
    // A RangeError alone does not prove stack exhaustion.
    assert.equal(failed.workspace.failure.code, mode === "render" ? "unexpected-error" : code);
    assert.equal(failed.workspace.publisherConfirmed, stage !== "identity");
    assert.equal(await page.locator('[data-action="clear"], [data-action="export"]').count(), 0);
    if (mode === "storage") {
      assert.equal(failed.sync.completed, 620, "Read the checkpoint even when record loading fails.");
      await page.locator('[data-theme="dark"]').click();
      await fs.mkdir(output, { recursive: true });
      await page.screenshot({ path: path.join(output, "workspace-recovery-dark.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(output, "workspace-recovery-mobile.png") });
      assert.equal(await page.locator(".upa-content").evaluate(element => element.scrollWidth <= element.clientWidth), true);
    }
    if (mode === "storage" || mode === "render") {
      await page.evaluate(() => { window.testMode = "normal"; window.restoreFormatter(); });
      await page.locator('[data-action="retry-publisher"]').click();
      await page.waitForFunction(() => document.querySelector('[data-action="clear"]') || document.querySelector(".upa-dashboard-view"));
      const recovered = await report();
      assert.equal(recovered.workspace.state, "ready");
      assert.equal(recovered.workspace.loadedRecords, seed.count);
      assert.equal(recovered.sync.completed, 620);
    }
    console.log(`Recovery and report passed: ${mode}.`);
  }

  // Optional presentation caching must not prevent identity verification.
  await open("cache");
  await page.waitForFunction(() => document.querySelector('[data-action="clear"]') || document.querySelector(".upa-dashboard-view"), { timeout: 60000 });
  assert.equal((await report()).workspace.state, "ready");

  const boundaries = await worker.evaluate(async () => {
    const read = (publisherId, after) => handleDatabaseMessage({ type: "UPA_DB_GET_RECORDS_PAGE", publisherId, after });
    const empty = await read("empty-publisher");
    const other = await read("other-publisher");
    const end = await read("other-publisher", "other-row");
    const missingCursor = await read("other-publisher", "nonexistent-key");
    let noIdentityRejected = false;
    try { await read(""); } catch { noIdentityRejected = true; }
    return { empty, other, end, missingCursor, noIdentityRejected };
  });
  assert.deepEqual(boundaries.empty, { rows: [], next: null });
  assert.deepEqual(boundaries.end, { rows: [], next: null });
  assert.equal(boundaries.other.rows.length, 1);
  assert.equal(boundaries.other.rows[0].publisherId, "other-publisher");
  assert.equal(boundaries.missingCursor.rows.length, 1);
  assert.ok(boundaries.noIdentityRejected);
  assert.deepEqual(pageErrors, []);
  console.log("Workspace recovery browser tests passed. No live Unity session was used.");
} finally {
  if (context) await context.close();
  if (path.dirname(profile) !== os.tmpdir() || !path.basename(profile).startsWith("upa-workspace-test-")) throw new Error("Unexpected test profile path.");
  await fs.rm(profile, { recursive: true, force: true });
}
