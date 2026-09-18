const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const packages = JSON.parse(fs.readFileSync(path.join(root, "internal-docs", "api-fixtures", "once-published-packages.json"), "utf8"));
const minimumDate = content.match(/const DAILY_API_MIN_DATE = "([^"]+)"/)?.[1];
const windowDays = Number(content.match(/const DAILY_API_WINDOW_DAYS = (\d+)/)?.[1]);

function extractFunction(name) {
  const source = content.match(new RegExp(`  function ${name}\\([^\\n]+\\) \\{[\\s\\S]*?\\n  \\}`))?.[0];
  assert.ok(source, `Missing production function: ${name}`);
  return source;
}

const context = { DAILY_API_MIN_DATE: minimumDate, DAILY_API_WINDOW_DAYS: windowDays };
vm.runInNewContext(`${extractFunction("addDays")}\n${extractFunction("incrementalDailyStart")}\n${extractFunction("incrementalDailyRanges")}\nthis.syncPolicy = { addDays, incrementalDailyStart, incrementalDailyRanges };`, context);
const { addDays, incrementalDailyStart, incrementalDailyRanges } = context.syncPolicy;
const plain = value => JSON.parse(JSON.stringify(value));
const fixturePackageRow = packages[0];
const fixturePackage = {
  id: String(fixturePackageRow.package_id),
  name: fixturePackageRow.name,
  firstPublished: new Date(fixturePackageRow.first_published_at).toISOString().slice(0, 10)
};

test("a new package starts at its fixture-backed publication date", () => {
  const endExclusive = addDays(fixturePackage.firstPublished, 30);
  assert.deepEqual(plain(incrementalDailyRanges(fixturePackage, [], endExclusive)), [
    { start: fixturePackage.firstPublished, endExclusive }
  ]);
});

test("other package records do not prevent a new-package bootstrap", () => {
  const records = [{ type: "daily", packageId: "another-package", date: "2026-04-05" }];
  assert.equal(incrementalDailyStart(fixturePackage, records), fixturePackage.firstPublished);
});

test("the daily-history floor limits an older package start", () => {
  const scope = { ...fixturePackage, firstPublished: "2018-06-01" };
  assert.equal(incrementalDailyStart(scope, []), minimumDate);
});

test("a long bootstrap uses contiguous half-open request windows", () => {
  const scope = { ...fixturePackage, firstPublished: "2024-01-01" };
  const endExclusive = "2026-01-05";
  const ranges = plain(incrementalDailyRanges(scope, [], endExclusive));
  assert.deepEqual(ranges, [
    { start: "2024-01-01", endExclusive: "2024-12-31" },
    { start: "2024-12-31", endExclusive: "2025-12-31" },
    { start: "2025-12-31", endExclusive }
  ]);
  assert.ok(ranges.every((range, index) => !index || ranges[index - 1].endExclusive === range.start));
});

test("an existing package overlaps its latest stored date", () => {
  const records = [
    { type: "daily", packageId: fixturePackage.id, date: "2026-01-02" },
    { type: "daily", packageId: fixturePackage.id, date: "2026-02-03" }
  ];
  assert.equal(incrementalDailyStart(fixturePackage, records), "2026-02-03");
});

test("a future publication date schedules no request", () => {
  const scope = { ...fixturePackage, firstPublished: "2027-01-01" };
  assert.deepEqual(plain(incrementalDailyRanges(scope, [], "2026-12-01")), []);
});

test("a missing catalog cursor does not invent a start date", () => {
  assert.deepEqual(plain(incrementalDailyRanges({ id: null, name: "All assets" }, [], "2026-01-01")), []);
});

test("a new package without a publication date fails visibly", () => {
  assert.throws(() => incrementalDailyStart({ id: "new-package", name: "New package", firstPublished: null }, []), /publication date/);
});

test("incremental sync uses the tested range scheduler in daily requests", () => {
  assert.match(content, /for \(const range of incrementalDailyRanges\(scope, records, endExclusive\)\)/);
  assert.match(content, /start_date: apiTimestamp\(range\.start\), end_date: apiTimestamp\(range\.endExclusive\)/);
});
