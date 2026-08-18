import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const edgePath = process.env.UPA_BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profilePrefix = path.join(os.tmpdir(), "upa-chrome-smoke-");
const profileDirectory = await fs.mkdtemp(profilePrefix);
let context;

try {
  await fs.access(edgePath);
  context = await chromium.launchPersistentContext(profileDirectory, {
    executablePath: edgePath,
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${projectRoot}`, `--load-extension=${projectRoot}`]
  });

  const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  if (!serviceWorker.url().startsWith("chrome-extension://")) throw new Error(`Unexpected background URL: ${serviceWorker.url()}`);
  const storageWorks = await serviceWorker.evaluate(async () => {
    await chrome.storage.session.set({ upaSmokeTest: true });
    const stored = await chrome.storage.session.get("upaSmokeTest");
    await chrome.storage.session.remove("upaSmokeTest");
    return stored.upaSmokeTest === true && typeof indexedDB?.open === "function";
  });
  if (!storageWorks) throw new Error("The extension background storage APIs did not respond as expected.");
  console.log("Chrome extension smoke test passed.");
} finally {
  if (context) await context.close();
  const resolvedProfile = path.resolve(profileDirectory);
  if (!resolvedProfile.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolvedProfile).startsWith("upa-chrome-smoke-")) {
    throw new Error(`Refusing to remove unexpected smoke-test profile: ${resolvedProfile}`);
  }
  await fs.rm(resolvedProfile, { recursive: true, force: true });
}
