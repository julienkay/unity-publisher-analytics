const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

async function validateIdentityAllowlist() {
  let listener;
  const fetches = [];
  const responses = [];
  const window = {
    addEventListener: (_type, callback) => { listener = callback; },
    postMessage: message => responses.push(message)
  };
  const context = {
    document: { cookie: "" },
    fetch: async (requestPath, options) => {
      fetches.push([requestPath, options.method]);
      return { ok: true, status: 200, text: async () => JSON.stringify({ publisherId: "42" }) };
    },
    location: { origin: "https://publisher.unity.com" },
    URL,
    window
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "api-client.js"), "utf8"), context);

  const request = (requestId, requestPath, method) => listener({
    source: window,
    origin: context.location.origin,
    data: { source: "unity-publisher-analytics", type: "UPA_API_REQUEST", requestId, path: requestPath, method }
  });
  await request("allowed", "/publisher-v2-api/user", "GET");
  await request("wrong-method", "/publisher-v2-api/user", "POST");
  await request("wrong-origin", "https://example.com/publisher-v2-api/user", "GET");

  assert.deepEqual(fetches, [["/publisher-v2-api/user", "GET"]]);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].requestId, "allowed");
}

function validateNamespacePropagation() {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  for (const required of [
    "publisherId, records: rows",
    "publisherId, key",
    "publisherId, active: true",
    "normalizeDaily(raw, scope, publisherId)",
    "publisherStorageKey(PREFS_KEY_PREFIX, identity.id)"
  ]) assert.ok(content.includes(required), `Missing content-script ownership invariant: ${required}`);
  for (const required of [
    "DB_VERSION = 2",
    'createIndex("publisherId"',
    "record?.publisherId !== publisherId",
    "ANALYTICS_META_KEYS"
  ]) assert.ok(background.includes(required), `Missing database ownership invariant: ${required}`);
  assert.ok(!background.includes('transaction("meta", "readwrite", store => deletePublisherRows'), "Analytics clearing must not delete all publisher metadata.");
}

Promise.resolve()
  .then(validateIdentityAllowlist)
  .then(validateNamespacePropagation)
  .then(() => console.log("Publisher isolation validation passed."))
  .catch(error => { console.error(error); process.exitCode = 1; });
