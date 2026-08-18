import assert from "node:assert/strict";
import { createTargetManifest, FIREFOX_ANDROID_MIN_VERSION, FIREFOX_EXTENSION_ID, FIREFOX_MIN_VERSION, readCanonicalManifest } from "./generate-manifest.mjs";

const canonical = readCanonicalManifest();
const chromeManifest = createTargetManifest(canonical, "chrome");
const firefoxManifest = createTargetManifest(canonical, "firefox");

assert.equal(canonical.manifest_version, 3, "The canonical manifest must remain Manifest V3.");
assert.deepEqual(canonical.host_permissions, ["https://publisher.unity.com/*"], "Host access must remain limited to the Publisher Portal.");
assert.deepEqual(canonical.permissions, ["storage"], "Only local storage permission should be requested.");
assert.ok(canonical.content_scripts.some(script => script.world === "MAIN" && script.js?.includes("api-client.js")), "The page API client must run in the MAIN world.");

assert.deepEqual(chromeManifest.background, { service_worker: "background.js" });
assert.equal(chromeManifest.browser_specific_settings, undefined, "Chrome must not contain Firefox metadata.");

assert.deepEqual(firefoxManifest.background, { scripts: ["background.js"] });
assert.equal(firefoxManifest.browser_specific_settings.gecko.id, FIREFOX_EXTENSION_ID);
assert.equal(firefoxManifest.browser_specific_settings.gecko.strict_min_version, FIREFOX_MIN_VERSION);
assert.deepEqual(firefoxManifest.browser_specific_settings.gecko.data_collection_permissions, { required: ["none"] });
assert.equal(firefoxManifest.browser_specific_settings.gecko_android.strict_min_version, FIREFOX_ANDROID_MIN_VERSION);

const sharedKeys = Object.keys(canonical).filter(key => key !== "background" && key !== "browser_specific_settings");
for (const key of sharedKeys) {
  assert.deepEqual(chromeManifest[key], canonical[key], `Chrome changed shared manifest field: ${key}`);
  assert.deepEqual(firefoxManifest[key], canonical[key], `Firefox changed shared manifest field: ${key}`);
}
assert.deepEqual(
  Object.keys(firefoxManifest).filter(key => !sharedKeys.includes(key)).sort(),
  ["background", "browser_specific_settings"],
  "Firefox contains an unexpected target-specific manifest field."
);

JSON.parse(JSON.stringify(chromeManifest));
JSON.parse(JSON.stringify(firefoxManifest));
console.log("Chrome and Firefox manifests are valid and differ only in allowlisted fields.");
