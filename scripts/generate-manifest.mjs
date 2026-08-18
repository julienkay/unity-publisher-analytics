import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const canonicalManifestPath = path.join(projectRoot, "manifest.json");

export const FIREFOX_EXTENSION_ID = "{23aa06e2-6e0b-4ebb-98ea-2fb3fb5b3da0}";
export const FIREFOX_MIN_VERSION = "140.0";
export const FIREFOX_ANDROID_MIN_VERSION = "142.0";

export function createTargetManifest(canonicalManifest, target) {
  if (!canonicalManifest || typeof canonicalManifest !== "object" || Array.isArray(canonicalManifest)) {
    throw new TypeError("The canonical manifest must be an object.");
  }
  if (target !== "chrome" && target !== "firefox") {
    throw new Error(`Unknown extension target: ${target}`);
  }

  const manifest = structuredClone(canonicalManifest);
  delete manifest.browser_specific_settings;

  if (target === "chrome") {
    manifest.background = { service_worker: "background.js" };
    return manifest;
  }

  manifest.background = { scripts: ["background.js"] };
  manifest.browser_specific_settings = {
    gecko: {
      id: FIREFOX_EXTENSION_ID,
      strict_min_version: FIREFOX_MIN_VERSION,
      data_collection_permissions: { required: ["none"] }
    },
    gecko_android: { strict_min_version: FIREFOX_ANDROID_MIN_VERSION }
  };
  return manifest;
}

export function readCanonicalManifest() {
  return JSON.parse(fs.readFileSync(canonicalManifestPath, "utf8"));
}

function writeTargetManifest(target, outputPath) {
  if (!outputPath) throw new Error("Usage: node scripts/generate-manifest.mjs <chrome|firefox> <output-path>");
  const manifest = createTargetManifest(readCanonicalManifest(), target);
  const resolvedOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Generated ${target} manifest: ${resolvedOutputPath}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    writeTargetManifest(process.argv[2]?.toLowerCase(), process.argv[3]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
