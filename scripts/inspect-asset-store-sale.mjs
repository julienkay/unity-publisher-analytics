import { pathToFileURL } from "node:url";

const DEFAULT_URL = "https://assetstore.unity.com/";

export function extractSchedules(html) {
  const decoded = html.replaceAll('\\"', '"');
  const schedulePattern = /"titleInternal":"([^"]+)"(?:(?!"titleInternal":)[\s\S]){0,12000}?"visibilitySchedule":\{"endDate":"([^"]+)","startDate":"([^"]+)"\}/g;

  return [...decoded.matchAll(schedulePattern)].map((match) => ({
    titleInternal: match[1],
    startAt: match[3],
    endAt: match[2]
  }));
}

export function selectActiveSale(schedules, at = new Date()) {
  const atTime = at.getTime();
  const activeSales = schedules.filter((schedule) => {
    const titleIsSale = /\b(?:sale|deals?)\b/i.test(schedule.titleInternal);
    const isPublisherFeature = /publisher of the week/i.test(schedule.titleInternal);
    const startTime = Date.parse(schedule.startAt);
    const endTime = Date.parse(schedule.endAt);

    return titleIsSale && !isPublisherFeature && startTime <= atTime && atTime < endTime;
  });

  return activeSales.sort((left, right) => {
    const leftDuration = Date.parse(left.endAt) - Date.parse(left.startAt);
    const rightDuration = Date.parse(right.endAt) - Date.parse(right.startAt);
    return rightDuration - leftDuration;
  })[0] ?? null;
}

function campaignTitle(titleInternal) {
  return titleInternal
    .replace(/\s+-\s+shop amazing deals$/i, "")
    .replace(/\s+-\s+week\s+\d+$/i, "")
    .replace(/\s+\d{4}$/, "")
    .trim();
}

function parseArguments(argumentsList) {
  const options = { url: DEFAULT_URL, at: new Date() };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--url") {
      options.url = argumentsList[index + 1];
      index += 1;
    } else if (argument === "--at") {
      options.at = new Date(argumentsList[index + 1]);
      index += 1;
    } else if (argument === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.url || !Number.isFinite(options.at.getTime())) {
    throw new Error("Supply a valid --url and --at value.");
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node scripts/inspect-asset-store-sale.mjs [--url URL] [--at ISO_DATE]");
    return;
  }

  const response = await fetch(options.url, {
    headers: { "User-Agent": "Publisher Analytics sale schedule inspector" }
  });
  if (!response.ok) {
    throw new Error(`Asset Store request failed with HTTP ${response.status}.`);
  }

  const schedules = extractSchedules(await response.text());
  const selected = selectActiveSale(schedules, options.at);
  const output = {
    sourceUrl: options.url,
    inspectedAt: options.at.toISOString(),
    selectionRule: "Select the longest active sale schedule. Exclude Publisher of the Week.",
    selected: selected ? { title: campaignTitle(selected.titleInternal), ...selected } : null,
    activeCandidates: schedules.filter((schedule) => {
      const start = Date.parse(schedule.startAt);
      const end = Date.parse(schedule.endAt);
      return start <= options.at.getTime() && options.at.getTime() < end;
    })
  };

  console.log(JSON.stringify(output, null, 2));
  if (!selected) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
