const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const packages = JSON.parse(fs.readFileSync(path.join(root, "internal-docs", "api-fixtures", "once-published-packages.json"), "utf8"));
const mapping = content.match(/firstPublished:\s*parseDate\(valueFrom\(item,\s*(\[[^\]]+\])\)\)/);

assert.ok(mapping, "The package publication-date mapping is missing.");
const aliases = JSON.parse(mapping[1]);
assert.ok(aliases.includes("first_published_at"), "The captured publication-date field is not mapped.");

const keyOf = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const valueFrom = (object, candidates) => {
  for (const candidate of candidates) {
    const key = Object.keys(object || {}).find(item => keyOf(item) === keyOf(candidate));
    if (key) return object[key];
  }
  return "";
};
const parseDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

for (const item of packages) {
  assert.equal(parseDate(valueFrom(item, aliases)), item.first_published_at.slice(0, 10));
}

console.log("API fixture normalization validation passed.");
