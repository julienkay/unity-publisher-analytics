import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectRoot, "content-src");
const parts = [
  "state.js",
  "analytics-models.js",
  "publisher-workspace.js",
  "local-storage.js",
  "publisher-api.js",
  "sync.js",
  "charts.js",
  "workspace-ui.js",
  "workspace-actions.js"
];
const prefix = `(() => {\n  "use strict";\n  const extensionApi = globalThis.browser ?? globalThis.chrome;\n  if (window.__unityPublisherAnalyticsLoaded) return;\n  window.__unityPublisherAnalyticsLoaded = true;\n\n`;
const source = await Promise.all(parts.map(name => fs.readFile(path.join(sourceDirectory, name), "utf8")));
const output = `${prefix}${source.map(text => text.trimEnd()).join("\n\n")}\n})();\n`;
await fs.writeFile(path.join(projectRoot, "content.js"), output);
console.log(`Built content.js from ${parts.length} source files.`);
