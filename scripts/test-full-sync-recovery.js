const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const windowDays = Number(content.match(/const DAILY_API_WINDOW_DAYS = (\d+)/)?.[1]);

function extractBetween(start, end) {
  const startIndex = content.indexOf(start), endIndex = content.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `Missing production source between ${start} and ${end}`);
  return content.slice(startIndex, endIndex);
}

function extractFunction(name) {
  const source = content.match(new RegExp(`  function ${name}\\([^\\n]+\\) \\{[\\s\\S]*?\\n  \\}`))?.[0];
  assert.ok(source, `Missing production function: ${name}`);
  return source;
}

const addDaysSource = extractFunction("addDays");
const runFullSyncSource = extractBetween("  async function runFullSync", "  async function continueFullSync");
const continueFullSyncSource = extractBetween("  async function continueFullSync", "  async function startFullSync");
const plain = value => JSON.parse(JSON.stringify(value));

function historyMonths(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2019, index, 1));
    return date.toISOString().slice(0, 7);
  });
}

test("the interrupted-sync interface uses the resumable continue action", () => {
  assert.ok(content.includes("const syncFailed = Boolean(syncJob?.error)"));
  assert.ok(content.includes('syncIncomplete ? \'<button data-action="continue-sync">Continue</button>\''));
  assert.ok(content.includes('if (action === "continue-sync") await continueFullSync()'));
  assert.ok(content.includes('["preparing", "months", "daily"].includes(syncJob?.phase) || isRefreshing'));
});

function dailyJob() {
  const scopes = [
    { id: null, name: "All assets" },
    ...Array.from({ length: 150 }, (_, index) => ({ id: String(index + 1), name: `Asset ${index + 1}` }))
  ];
  return {
    publisherId: "publisher-a",
    active: true,
    phase: "daily",
    startedAt: "2026-09-18T08:00:00.000Z",
    packages: scopes.slice(1),
    start: "2019-01-01",
    endExclusive: "2026-09-17",
    months: historyMonths(92),
    monthIndex: 92,
    scopes,
    scopeIndex: 54,
    cursor: "2021-12-31",
    completed: 620,
    total: 1393,
    label: "Syncing daily performance"
  };
}

function monthlyJob() {
  const months = historyMonths(90);
  return {
    publisherId: "publisher-a",
    active: true,
    phase: "months",
    startedAt: "2026-09-18T08:00:00.000Z",
    packages: [],
    start: "2019-01-01",
    endExclusive: "2022-01-01",
    months,
    monthIndex: 46,
    scopes: [],
    scopeIndex: 0,
    cursor: "2019-01-01",
    completed: 93,
    total: 181,
    label: "Syncing sales and downloads"
  };
}

function createHarness(job, failureMessage, options = {}) {
  const requests = [], savedJobs = [], storedRows = plain(options.storedRows || [{ id: "previously-committed-row" }]), errors = [], notices = [];
  let failNextRequest = options.failFirstRequest !== false;
  let context;
  const API = {
    sales: month => `/sales/${month}`,
    downloads: month => `/downloads/${month}`,
    daily: "/daily"
  };
  context = {
    API,
    DAILY_API_WINDOW_DAYS: windowDays,
    publisherIdentity: { id: "publisher-a" },
    workspaceGeneration: 7,
    syncJob: plain(job),
    records: [],
    ownsWorkspace: (publisherId, generation) => context.publisherIdentity.id === publisherId && context.workspaceGeneration === generation,
    prepareFullSync: async () => { throw new Error("The recovery test must not prepare a new sync."); },
    apiJson: async (requestPath, options = {}) => {
      requests.push({ requestPath, options: plain(options) });
      if (failNextRequest) {
        failNextRequest = false;
        throw new Error(failureMessage);
      }
      return { requestNumber: requests.length };
    },
    normalizeSales: (_raw, month, publisherId) => [{ id: `sales-${month}`, publisherId }],
    normalizeDownloads: (_raw, month, publisherId) => [{ id: `downloads-${month}`, publisherId }],
    normalizeDaily: (_raw, scope, publisherId) => [{ id: `daily-${scope.id ?? "all"}-${requests.length}`, publisherId }],
    putMany: async rows => { storedRows.push(...plain(rows)); },
    saveJob: async savedJob => { savedJobs.push(plain(savedJob)); },
    getAll: async () => plain(storedRows),
    apiTimestamp: date => `${date}T00:00:00Z`,
    sleep: async () => {},
    render: () => {},
    toast: (message, type) => { notices.push({ message, type }); },
    console: { error: (...values) => { errors.push(values.map(String).join(" ")); } }
  };
  vm.runInNewContext(`${addDaysSource}\n${runFullSyncSource}\n${continueFullSyncSource}\nthis.syncActions = { runFullSync, continueFullSync };`, context);
  return { context, requests, savedJobs, storedRows, errors, notices, actions: context.syncActions };
}

test("a saved failed checkpoint resumes in a new runtime", async () => {
  const failureMessage = "Publisher API returned 429 for /publisher-v2-api/dashboard/daily.";
  const interrupted = createHarness(dailyJob(), failureMessage);
  await interrupted.actions.runFullSync("publisher-a", 7);

  const persistedJob = plain(interrupted.savedJobs.at(-1));
  const resumed = createHarness(persistedJob, "unused", {
    failFirstRequest: false,
    storedRows: interrupted.storedRows
  });
  await resumed.actions.continueFullSync();

  assert.equal(resumed.requests[0].options.body.start_date, `${persistedJob.cursor}T00:00:00Z`);
  assert.deepEqual(resumed.requests[0].options.body.package_ids, [persistedJob.scopes[persistedJob.scopeIndex].id]);
  assert.equal(resumed.context.syncJob.phase, "complete");
  assert.equal(resumed.context.syncJob.completed, persistedJob.total);
  assert.equal(resumed.context.syncJob.error, "");
  assert.ok(resumed.storedRows.some(row => row.id === "previously-committed-row"));
});

for (const failure of [
  { name: "HTTP 429", message: "Publisher API returned 429 for /publisher-v2-api/dashboard/daily." },
  { name: "timeout", message: "Publisher API timed out for /publisher-v2-api/dashboard/daily." },
  { name: "authentication failure", message: "Publisher API returned 401 for /publisher-v2-api/dashboard/daily." }
]) {
  test(`${failure.name} pauses a large daily sync and resumes the failed checkpoint`, async () => {
    const harness = createHarness(dailyJob(), failure.message);
    const checkpoint = plain(harness.context.syncJob);

    await harness.actions.runFullSync("publisher-a", 7);

    assert.equal(harness.context.syncJob.active, false);
    assert.equal(harness.context.syncJob.phase, "daily");
    assert.equal(harness.context.syncJob.scopeIndex, checkpoint.scopeIndex);
    assert.equal(harness.context.syncJob.cursor, checkpoint.cursor);
    assert.equal(harness.context.syncJob.completed, checkpoint.completed);
    assert.match(harness.context.syncJob.error, new RegExp(`^${failure.message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.deepEqual(harness.storedRows, [{ id: "previously-committed-row" }]);
    assert.equal(harness.savedJobs.at(-1).phase, "daily");
    assert.equal(harness.savedJobs.at(-1).active, false);

    harness.requests.length = 0;
    await harness.actions.continueFullSync();

    assert.equal(harness.requests[0].requestPath, "/daily");
    assert.deepEqual(harness.requests[0].options.body, {
      start_date: `${checkpoint.cursor}T00:00:00Z`,
      end_date: "2022-12-31T00:00:00Z",
      package_ids: [checkpoint.scopes[checkpoint.scopeIndex].id]
    });
    assert.equal(harness.context.syncJob.active, false);
    assert.equal(harness.context.syncJob.phase, "complete");
    assert.equal(harness.context.syncJob.error, "");
    assert.equal(harness.context.syncJob.scopeIndex, checkpoint.scopes.length);
    assert.equal(harness.context.syncJob.completed, checkpoint.total);
    assert.ok(harness.storedRows.length > 1);
    assert.equal(harness.errors.length, 1);
  });
}

test("a monthly failure resumes the same month without discarding committed rows", async () => {
  const failureMessage = "Publisher API returned 500 for /publisher-v2-api/monthly-sales.";
  const harness = createHarness(monthlyJob(), failureMessage);
  const checkpoint = plain(harness.context.syncJob);

  await harness.actions.runFullSync("publisher-a", 7);

  assert.equal(harness.context.syncJob.active, false);
  assert.equal(harness.context.syncJob.phase, "months");
  assert.equal(harness.context.syncJob.monthIndex, checkpoint.monthIndex);
  assert.equal(harness.context.syncJob.completed, checkpoint.completed);
  assert.deepEqual(harness.storedRows, [{ id: "previously-committed-row" }]);

  harness.requests.length = 0;
  await harness.actions.continueFullSync();

  const resumedMonth = checkpoint.months[checkpoint.monthIndex];
  assert.deepEqual(harness.requests.slice(0, 2).map(request => request.requestPath).sort(), [
    `/downloads/${resumedMonth}`,
    `/sales/${resumedMonth}`
  ]);
  assert.equal(harness.context.syncJob.phase, "complete");
  assert.equal(harness.context.syncJob.error, "");
  assert.equal(harness.context.syncJob.monthIndex, checkpoint.months.length);
  assert.equal(harness.context.syncJob.completed, checkpoint.total);
  assert.ok(harness.storedRows.length > 1);
});
