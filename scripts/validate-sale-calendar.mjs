import { readFile } from "node:fs/promises";
import { extractSchedules, selectActiveSale } from "./inspect-asset-store-sale.mjs";

const calendarUrl = new URL("../data/asset-store-sales.json", import.meta.url);
const calendar = JSON.parse(await readFile(calendarUrl, "utf8"));
const errors = [];
const ranges = new Set();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
let previousStartDate = "";

if (!Array.isArray(calendar)) errors.push("The sale calendar must be an array.");

for (const [index, sale] of Array.isArray(calendar) ? calendar.entries() : []) {
  const label = sale.title || `row ${index + 1}`;
  const keys = Object.keys(sale).sort().join(",");
  if (keys !== "endDate,startDate,title") errors.push(`Unexpected fields: ${label}`);
  if (!sale.title) errors.push(`Missing title: row ${index + 1}`);
  if (!datePattern.test(sale.startDate) || !datePattern.test(sale.endDate)) {
    errors.push(`Invalid date format: ${label}`);
  } else if (sale.startDate > sale.endDate) {
    errors.push(`Start date follows end date: ${label}`);
  }
  if (sale.startDate < previousStartDate) errors.push(`Calendar is not sorted: ${label}`);
  previousStartDate = sale.startDate;
  const rangeKey = `${sale.title}|${sale.startDate}|${sale.endDate}`;
  if (ranges.has(rangeKey)) errors.push(`Duplicate range: ${label}`);
  ranges.add(rangeKey);
}

const fixture = String.raw`<script>self.__next_f.push([1,"titleInternal\":\"Autumn Sale 2026 - Week 1\",\"visibilitySchedule\":{\"endDate\":\"2026-09-23T15:00:00.000Z\",\"startDate\":\"2026-09-14T15:00:00.000Z\"} \"titleInternal\":\"Autumn Sale 2026 - Shop amazing deals\",\"visibilitySchedule\":{\"endDate\":\"2026-10-06T15:00:00.000Z\",\"startDate\":\"2026-09-14T15:00:00.000Z\"}"])</script>`;
const schedules = extractSchedules(fixture);
const selected = selectActiveSale(schedules, new Date("2026-09-20T00:00:00Z"));
if (schedules.length !== 2) errors.push("Schedule extractor did not find both synthetic schedules.");
if (selected?.endAt !== "2026-10-06T15:00:00.000Z") {
  errors.push("Schedule selector did not choose the campaign-wide schedule.");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Sale calendar validation passed (${calendar.length} ranges).`);
}
