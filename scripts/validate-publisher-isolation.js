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

function validateIdentityLifecycle() {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  const fullSync = content.slice(content.indexOf("  async function prepareFullSync"), content.indexOf("  async function startFullSync"));
  const startFullSync = content.slice(content.indexOf("  async function startFullSync"), content.indexOf("  async function incrementalSync"));
  const incrementalSync = content.slice(content.indexOf("  async function incrementalSync"), content.indexOf("  function availableDateBounds"));

  assert.ok(!content.includes("identityRefreshInFlight"), "Publisher identity must not use a polling lock.");
  assert.ok(!content.includes("setInterval(async () =>"), "Publisher identity must not use a periodic API poll.");
  assert.ok(!content.includes("verifyPublisherWorkspace"), "Sync batches must not request publisher identity before each write.");
  assert.ok(!fullSync.includes("fetchPublisherIdentity("), "Full-sync batches must use the activated workspace identity.");
  assert.ok(!incrementalSync.includes("fetchPublisherIdentity("), "Incremental-sync batches must use the activated workspace identity.");
  assert.ok((fullSync.match(/if \(!ownsWorkspace\(publisherId, generation\)\) return;/g) || []).length >= 4, "Full sync must stop stale work at local async boundaries.");
  assert.ok((incrementalSync.match(/if \(!ownsWorkspace\(publisherId, generation\)\) return;/g) || []).length >= 4, "Incremental sync must stop stale work at local async boundaries.");
  assert.ok(startFullSync.includes("await fetchPublisherIdentity(true)"), "A new full sync must verify publisher identity before it clears local data.");
  assert.ok(startFullSync.includes("identity.id !== publisherIdentity.id") && startFullSync.includes("await activatePublisher(identity, { resume: false })"), "A confirmed publisher change must activate the matching workspace.");
  assert.ok(startFullSync.indexOf("await fetchPublisherIdentity(true)") < startFullSync.indexOf("syncJob ="), "Publisher verification must finish before a new full-sync job starts.");
  assert.ok(startFullSync.indexOf("await fetchPublisherIdentity(true)") < startFullSync.indexOf("await clearPublisherData"), "Publisher verification must finish before full sync clears local data.");
  assert.ok(startFullSync.includes("We did not change your saved analytics"), "A failed full-sync identity check must preserve the active workspace.");
}

function validateCrossBrowserApiFacade() {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  for (const [fileName, source] of [["content.js", content], ["background.js", background]]) {
    assert.ok(source.includes("globalThis.browser ?? globalThis.chrome"), `${fileName} must select the native promise-based extension API.`);
    assert.ok(!/\bchrome\./.test(source), `${fileName} must not call the callback-oriented Chrome namespace directly.`);
  }
}

function validatePackageGroupPersistence() {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  for (const required of [
    'GROUPS_KEY_PREFIX = "unityPublisherAnalyticsPackageGroupsV1"',
    "publisherStorageKey(GROUPS_KEY_PREFIX, identity.id)",
    "sanitizedPackageGroups",
    "sanitizedPerformanceScopes",
    "selectedPerformanceScopes",
    "overlappingPerformanceAssets",
    'data-performance-scope="group"',
    'data-performance-scope="asset"',
    'data-action="manage-groups"',
    'section === "groups" ? groupsPanel(performanceOptions)',
    'String(item.id || "")',
    'String(item.packageId || "")'
  ]) assert.ok(content.includes(required), `Missing package-group invariant: ${required}`);
  assert.ok(!content.includes("upa-performance-group-actions"), "Group management must not be split into separate Performance controls.");
  assert.ok(!content.includes('id="upa-performance-group"'), "Performance must use one combined group and asset menu.");
  assert.ok(!content.includes("data-performance-package"), "Individual assets must not open a second Performance selector.");
  assert.ok(!background.includes("unityPublisherAnalyticsPackageGroups"), "Analytics database clearing must not own package-group storage.");
}

async function validateClearRecovery() {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  const clearFunction = content.match(/  async function clearAnalyticsData\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.ok(clearFunction.includes("workspaceGeneration += 1"), "Analytics clearing must invalidate active sync work.");
  assert.ok(clearFunction.includes("if (syncJob) syncJob.active = false"), "Analytics clearing must stop the active full-sync job.");
  assert.ok(clearFunction.includes("records = []"), "Analytics clearing must empty only the visible analytics records after storage succeeds.");
  assert.ok(clearFunction.includes("syncJob = null"), "Analytics clearing must remove the visible sync checkpoint after storage succeeds.");
  assert.ok(clearFunction.indexOf("workspaceGeneration += 1") < clearFunction.indexOf("await clearPublisherData"), "Analytics clearing must invalidate in-flight work before the database delete starts.");
  assert.ok(clearFunction.indexOf("await clearPublisherData") < clearFunction.indexOf("records = []"), "Analytics clearing must keep visible records until the database delete succeeds.");
  assert.ok(content.includes('const section = hasData || preferredSection === "settings" ? preferredSection : "dashboard"'), "An empty workspace must preserve Settings while routing unavailable analytics sections to Home.");
  assert.ok(content.includes('section === "settings" ? `<div class="upa-primary-nav upa-empty-primary-nav"') && content.includes('<span>Home</span>'), "An empty workspace must show Home next to Getting Started only while Settings is open.");
  assert.ok(content.includes('const settingsSyncAction = records.length || syncAlreadyStarted ? ""') && content.includes('data-action="settings-sync">Sync full history</button>'), "Settings must offer full-history sync only when the workspace has no analytics records and no active or resumable sync.");
  assert.ok(content.includes('if (action === "settings-sync")') && content.includes('prefs.section = "dashboard"'), "Settings sync must navigate Home before sync progress begins.");
  assert.ok(!content.includes('settings-back-dashboard'), "Settings must use workspace navigation instead of an inline back action.");
  assert.ok(!clearFunction.includes("storage.local"), "Analytics clearing must not change publisher preferences or package groups.");

  const successfulJob = { active: true };
  const successful = {
    publisherIdentity: { id: "publisher-a" },
    workspaceGeneration: 4,
    syncJob: successfulJob,
    isRefreshing: true,
    records: [{ id: "publisher-a|daily|1" }],
    clearPublisherData: async publisherId => { successful.clearedPublisherId = publisherId; },
    ownsWorkspace: (publisherId, generation) => successful.publisherIdentity.id === publisherId && successful.workspaceGeneration === generation,
    render: () => { successful.renderCount = (successful.renderCount || 0) + 1; },
    toast: (message, type) => { successful.notice = { message, type }; },
    console: { warn: () => {} }
  };
  vm.runInNewContext(`${clearFunction}\nthis.clearAnalyticsData = clearAnalyticsData;`, successful);
  await successful.clearAnalyticsData();
  assert.equal(successful.clearedPublisherId, "publisher-a");
  assert.equal(successful.workspaceGeneration, 5);
  assert.equal(successfulJob.active, false);
  assert.equal(successful.isRefreshing, false);
  assert.equal(successful.records.length, 0);
  assert.equal(successful.syncJob, null);
  assert.equal(successful.renderCount, 1);
  assert.match(successful.notice.message, /was cleared/);

  const failedJob = { active: true };
  const failed = {
    publisherIdentity: { id: "publisher-a" },
    workspaceGeneration: 8,
    syncJob: failedJob,
    isRefreshing: true,
    records: [{ id: "publisher-a|daily|1" }],
    clearPublisherData: async () => { throw new Error("Database unavailable"); },
    ownsWorkspace: (publisherId, generation) => failed.publisherIdentity.id === publisherId && failed.workspaceGeneration === generation,
    render: () => { failed.renderCount = (failed.renderCount || 0) + 1; },
    toast: (message, type) => { failed.notice = { message, type }; },
    console: { warn: () => {} }
  };
  vm.runInNewContext(`${clearFunction}\nthis.clearAnalyticsData = clearAnalyticsData;`, failed);
  await failed.clearAnalyticsData();
  assert.equal(failed.workspaceGeneration, 9);
  assert.equal(failedJob.active, false);
  assert.equal(failed.isRefreshing, false);
  assert.equal(failed.records.length, 1);
  assert.equal(failed.syncJob, failedJob);
  assert.equal(failed.renderCount, 1);
  assert.equal(failed.notice.type, "error");
}

Promise.resolve()
  .then(validateIdentityAllowlist)
  .then(validateNamespacePropagation)
  .then(validateIdentityLifecycle)
  .then(validateCrossBrowserApiFacade)
  .then(validatePackageGroupPersistence)
  .then(validateClearRecovery)
  .then(() => console.log("Publisher isolation, package-group, and clear-recovery validation passed."))
  .catch(error => { console.error(error); process.exitCode = 1; });
