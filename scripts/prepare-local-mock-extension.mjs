import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, ".local-mock-extension");
const runtimeFiles = [
  "api-client.js", "analytics.html", "background.js", "content.js", "portal-bridge.js", "portal-launcher.css", "styles.css", "manifest.json", "LICENSE",
  "icons/publisher-analytics-16.png", "icons/publisher-analytics-32.png",
  "icons/publisher-analytics-48.png", "icons/publisher-analytics-128.png",
  "vendor/echarts.min.js", "vendor/echarts.min.js.LEGAL.txt"
];

const marker = "  function bindEvents() {";
const clickMarker = '      if (action === "download-support")';
const accountMarker = '<button type="button" data-action="open-settings" role="menuitem">';

const mockCode = String.raw`
  const LOCAL_MOCK_PUBLISHER_ID = "local-mock-catalog-v1";

  async function localMockRecords(publisherId, packageCount, years) {
    const packages = Array.from({ length: packageCount }, (_, index) => ({
      id: String(900000000 + index), name: "Synthetic Asset " + String(index + 1).padStart(4, "0"),
      categoryId: String(index % 8 + 1), category: ["Tools", "Audio", "Visual Effects", "2D", "3D", "Systems", "Templates", "Utilities"][index % 8],
      firstPublished: String(new Date().getUTCFullYear() - years) + "-01-01", reviewCount: index % 83, icon: ""
    }));
    const rows = [];
    const end = new Date(); end.setUTCDate(1);
    const start = new Date(Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth(), 1));
    const monthDates = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) monthDates.push(cursor.toISOString().slice(0, 10));
    const add = row => rows.push(normalize(row, publisherId));
    for (const date of monthDates) {
      const period = date.slice(0, 7), monthIndex = monthDates.indexOf(date) + 1;
      const daily = {};
      for (let day = new Date(date + "T00:00:00Z"); day.getUTCMonth() === new Date(date + "T00:00:00Z").getUTCMonth() && day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
        const key = day.toISOString().slice(0, 10), seasonal = 1 + Math.sin((day.getUTCDate() + day.getUTCMonth() * 3) / 5) * 0.25;
        daily[key] = { gross: Math.round(320 * seasonal), sales: Math.max(0, Math.round(8 * seasonal)), free_obtained: Math.round(4 * seasonal), page_views: Math.round(900 * seasonal), downloads: Math.round(260 * seasonal), wishlisted: Math.round(18 * seasonal), refunds: 1, quick_looks: Math.round(70 * seasonal), carted: Math.round(24 * seasonal) };
      }
      for (const record of normalizeDaily(daily, { id: "", name: "", category: "" }, publisherId)) rows.push(record);
      for (const item of packages) {
        const scale = 0.35 + (Number(item.id) % 23) / 18, qty = Math.max(0, Math.round((1 + monthIndex % 7) * scale));
        add({ type: "sales", period, date: period + "-01", packageId: item.id, package: item.name, category: item.category, price: 24.99, qty, refunds: qty ? 1 : 0, chargebacks: 0, gross: qty * 24.99, net: qty * 17.49, first: date, last: date, currency: "USD" });
        add({ type: "downloads", period, date: period + "-01", packageId: item.id, package: item.name, category: item.category, downloads: qty * 3 + 2, users: qty * 2 + 1, freeDownloads: 2, freeUsers: 1, entitledDownloads: qty * 3, entitledUsers: qty * 2, freeFirst: date, freeLast: date, entitledFirst: date, entitledLast: date });
        add({ type: "daily", period, date: period + "-15", scope: "package", packageId: item.id, package: item.name, category: item.category, sales: qty * 24.99, salesQty: qty + 1, paidQty: qty, freeQty: 1, pageViews: qty * 85 + 45, conversionRate: 1.1, downloads: qty * 3 + 2, wishlisted: qty * 4 + 2, refunds: qty ? 1 : 0, ratingAvg: 4 + (Number(item.id) % 10) / 10, quickLooks: qty * 8 + 3, carted: qty * 2 + 2, currency: "USD" });
      }
      const progress = document.querySelector("#upa-root .upa-workspace-load-status");
      if (progress) progress.textContent = "Preparing sample history · " + rows.length + " records";
      await sleep(0);
    }
    for (let index = 0; index < Math.min(monthDates.length * 2, 240); index += 1) {
      const date = monthDates[Math.floor(index / 2)];
      add({ type: "revenue", period: date.slice(0, 7), date: date.slice(0, 7) + (index % 2 ? "-20" : "-05"), description: index % 2 ? "Synthetic monthly adjustment" : "Synthetic publisher payment", debit: 0, credit: 250 + index * 3, balance: 250 + index * 3, currency: "USD" });
    }
    return { rows, packages };
  }

  async function openLocalMockCatalog() {
    const packageCount = Number(prompt("How many synthetic assets? Enter 1 to 2,000.", "1000"));
    if (!Number.isInteger(packageCount) || packageCount < 1 || packageCount > 2000) return;
    const years = Number(prompt("How many years of synthetic history? Enter 1 to 10.", "5"));
    if (!Number.isInteger(years) || years < 1 || years > 10) return;
    const publisherId = LOCAL_MOCK_PUBLISHER_ID, generation = workspaceGeneration + 1;
    workspaceGeneration = generation;
    workspaceStage = "local-data"; publisherIdentityState = "loading"; workspaceFailure = null; workspaceLoading = true;
    workspaceRecordsLoaded = 0;
    publisherIdentity = { id: publisherId, organizationId: "", portalLabel: "Local mock", name: "Local Mock Publisher", icon: "", localMock: true };
    render();
    try {
      const existing = await getMeta(SYNC_KEY, publisherId);
      if (existing?.localMock && existing.mockCatalogCount === packageCount && existing.mockYears === years) {
        await activatePublisher(publisherIdentity, { resume: false });
        workspaceLoading = false;
        toast("Opened " + number(packageCount) + " synthetic assets across " + years + " years.");
        return;
      }
      const generated = await localMockRecords(publisherId, packageCount, years);
      await clearPublisherData(publisherId);
      for (let offset = 0; offset < generated.rows.length; offset += 50000) {
        await putMany(generated.rows.slice(offset, offset + 50000), publisherId);
        if (generation !== workspaceGeneration) return;
        const progress = document.querySelector("#upa-root .upa-workspace-load-status");
        if (progress) progress.textContent = "Saving sample history · " + Math.min(offset + 50000, generated.rows.length) + " records";
      }
      const job = { publisherId, active: false, phase: "complete", completed: generated.rows.length, total: generated.rows.length, packages: generated.packages, completedAt: new Date().toISOString(), localMock: true, mockCatalogCount: packageCount, mockYears: years };
      await setMeta(SYNC_KEY, job, publisherId);
      if (generation !== workspaceGeneration) return;
      await activatePublisher(publisherIdentity, { resume: false });
      workspaceLoading = false;
      toast("Loaded " + number(packageCount) + " synthetic assets across " + years + " years.");
    } catch (error) {
      if (generation !== workspaceGeneration) return;
      workspaceStage = "local-data"; publisherIdentityState = "error"; workspaceFailure = { stage: workspaceStage, ...failureDetails(error) };
      recordDiagnostic({ kind: "local-mock", ...workspaceFailure }); render();
    } finally { if (generation === workspaceGeneration || publisherIdentity.id === publisherId) workspaceLoading = false; }
  }

  async function importLocalPublisherBackup() {
    if (publisherIdentity.localMock || !publisherIdentity.id) return;
    const input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json";
    const file = await new Promise(resolve => { input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true }); input.click(); });
    if (!file) return;
    if (file.size > 512 * 1024 * 1024) { toast("The backup file is larger than 512 MiB.", "error"); return; }
    let backup;
    try { backup = JSON.parse(await file.text()); }
    catch { toast("We couldn't read this analytics backup as JSON.", "error"); return; }
    const publisherId = publisherIdentity.id, generation = workspaceGeneration;
    if (backup?.version !== 2 || backup?.publisher?.id !== publisherId || !Array.isArray(backup.records)
      || backup.records.some(row => !row || row.publisherId !== publisherId || typeof row.id !== "string" || !row.id.startsWith(publisherId + "|") || !["sales", "downloads", "daily", "revenue"].includes(row.type))) {
      toast("This backup does not match the signed-in publisher or uses an unsupported format.", "error"); return;
    }
    try {
      const encoder = new TextEncoder(); let batch = [], bytes = 0;
      for (const record of backup.records) {
        const size = encoder.encode(JSON.stringify(record)).byteLength;
        if (size > 1024 * 1024) throw new Error("A backup record is larger than 1 MiB.");
        if (batch.length && (batch.length >= 500 || bytes + size > 1024 * 1024)) {
          if (!ownsWorkspace(publisherId, generation)) return;
          await putMany(batch, publisherId); batch = []; bytes = 0;
        }
        batch.push(record); bytes += size;
      }
      if (batch.length) { if (!ownsWorkspace(publisherId, generation)) return; await putMany(batch, publisherId); }
      if (!ownsWorkspace(publisherId, generation)) return;
      await activatePublisher({ ...publisherIdentity }, { resume: false });
      toast("Imported " + number(backup.records.length) + " records into this local extension copy.");
    } catch (error) { if (ownsWorkspace(publisherId, generation)) toast("We couldn't import this backup: " + error.message, "error"); }
  }
`;

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });
for (const relativePath of runtimeFiles) {
  const sourcePath = path.join(projectRoot, relativePath), targetPath = path.join(outputRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

const localManifestPath = path.join(outputRoot, "manifest.json");
const manifest = JSON.parse(await fs.readFile(localManifestPath, "utf8"));
manifest.name = "Publisher Analytics+ (Local Mock)";
manifest.short_name = "Analytics Mock";
manifest.action.default_title = "Open Publisher Analytics+ (Local Mock)";
await fs.writeFile(localManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const contentPath = path.join(outputRoot, "content.js");
let content = await fs.readFile(contentPath, "utf8");
if (!content.includes(marker) || !content.includes(clickMarker) || !content.includes(accountMarker)) {
  throw new Error("The local mock patch points changed. Update this generator before preparing the extension.");
}
content = content.replace(marker, `${mockCode}\n${marker}`);
content = content.replace(clickMarker, `      if (action === "local-mock") { accountMenuOpen = false; await openLocalMockCatalog(); return; }\n      if (action === "local-live") { accountMenuOpen = false; await openPublisherWorkspace(true); return; }\n      if (action === "local-import") { accountMenuOpen = false; await importLocalPublisherBackup(); return; }\n${clickMarker}`);
content = content.replace(accountMarker, '<button type="button" data-action="local-mock" role="menuitem">Open local mock publisher…</button>${publisherIdentity.localMock ? \'<button type="button" data-action="local-live" role="menuitem">Return to live publisher</button>\' : \'<button type="button" data-action="local-import" role="menuitem">Import publisher backup…</button>\'}' + accountMarker);
content = content.replace('  async function apiJson(path, options = {}) {', '  async function apiJson(path, options = {}) {\n    if (publisherIdentity.localMock && path !== API.user) throw new Error("Unity data requests are disabled in the local mock workspace. Return to the live publisher to sync.");');
content = content.replace('    else if (records.length) incrementalSync(false, identity.id, generation);', '    else if (records.length && !identity.localMock) incrementalSync(false, identity.id, generation);');
content = content.replace('const settingsSyncAction = records.length || syncAlreadyStarted ? ""', 'const settingsSyncAction = publisherIdentity.localMock || records.length || syncAlreadyStarted ? ""');
content = content.replace('const showRefreshAction = section === "dashboard" && hasData &&', 'const showRefreshAction = !publisherIdentity.localMock && section === "dashboard" && hasData &&');
await fs.writeFile(contentPath, content);

await fs.writeFile(path.join(outputRoot, "LOCAL-MOCK-README.txt"), `LOCAL-ONLY MOCK EXTENSION\n\nLoad this folder as an unpacked extension. It has a separate extension storage area from the normal extension. It cannot read or change the normal extension's saved records.\n\nTo bring the real publisher's saved data into this copy, export an analytics backup from the normal extension. Open the local copy on the Publisher Portal while signed in to that publisher. In the publisher menu, select “Import publisher backup…” and choose the exported JSON file. The backup publisher ID must match the signed-in publisher. Import adds or replaces matching records in this copy. It does not clear existing records.\n\nOpen the publisher menu and select “Open local mock publisher…”. Choose 1–2,000 synthetic assets and 1–10 years. The generated workspace uses a fixed local publisher ID and synthetic records. Reopening it replaces only that mock publisher's local data. Select “Return to live publisher” to re-check the signed-in Portal identity.\n\nThe mock uses generated normalized records. It does not intercept Unity API responses. Analytics requests are blocked while the mock workspace is active; the identity request is allowed so the extension can switch back to the live publisher. This copy is outside package archives; the release package uses an explicit file allowlist.\n\nRegenerate after source changes with: npm run prepare:local-mock-extension\n`);
console.log(`Prepared local-only extension at ${outputRoot}`);
