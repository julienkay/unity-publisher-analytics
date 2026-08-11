(() => {
  "use strict";
  if (window.__unityPublisherAnalyticsLoaded) return;
  window.__unityPublisherAnalyticsLoaded = true;

  const PREFS_KEY = "unityPublisherAnalyticsApiPrefsV1";
  const SYNC_KEY = "apiSyncV1";
  const DAILY_API_MIN_DATE = "2019-01-01";
  const API = {
    packages: "/publisher-v2-api/proxy?path=%2Fmanagement%2Fonce-published-packages&type=array",
    sales: month => `/publisher-v2-api/monthly-sales?date=${month}-01`,
    downloads: month => `/publisher-v2-api/monthly-downloads?date=${month}-01`,
    revenue: "/publisher-v2-api/publisher-revenues",
    daily: "/publisher-v2-api/dashboard/daily"
  };
  let records = [];
  let prefs = { range: "all" };
  let syncJob = null;
  let isOpen = false;
  let renderQueued = false;
  const pendingApiRequests = new Map();

  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const compact = value => String(value ?? "").trim().replace(/\s+/g, " ");
  const keyOf = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
  const number = value => new Intl.NumberFormat().format(Number(value) || 0);
  const money = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);

  function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let normalized = String(value ?? "").replace(/\(([^)]+)\)/, "-$1").replace(/[^0-9.,-]/g, "");
    const comma = normalized.lastIndexOf(","), dot = normalized.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) normalized = comma > dot ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
    else if (comma >= 0) normalized = /,\d{1,2}$/.test(normalized) ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
    return Number.parseFloat(normalized) || 0;
  }

  function valueFrom(object, aliases) {
    for (const alias of aliases) {
      const key = Object.keys(object || {}).find(candidate => keyOf(candidate) === keyOf(alias));
      if (key) return object[key];
    }
    return "";
  }

  function parseDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
  }

  const apiTimestamp = dateString => `${dateString}T00:00:00Z`;
  const latestCompleteDailyDate = () => addDays(new Date().toISOString().slice(0, 10), -2);

  function addMonths(month, count) {
    const date = new Date(`${month}-01T00:00:00.000Z`); date.setUTCMonth(date.getUTCMonth() + count); return date.toISOString().slice(0, 7);
  }

  function monthSequence(startDate, endDate) {
    const result = []; let month = startDate.slice(0, 7), finalMonth = endDate.slice(0, 7);
    while (month <= finalMonth) { result.push(month); month = addMonths(month, 1); }
    return result;
  }

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); }
    return (result >>> 0).toString(36);
  }

  function recordId(record) {
    return `${record.type}|${hash([record.type, record.date, record.period, record.packageId, record.package, record.price, record.description, record.scope].join("|"))}`;
  }

  function normalize(record) {
    return { ...record, id: recordId(record), source: "publisher-api", capturedAt: new Date().toISOString() };
  }

  async function database(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "The local analytics database is unavailable.");
    return response.result;
  }

  const getAll = () => database({ type: "UPA_DB_GET_ALL" });
  const putMany = rows => rows.length ? database({ type: "UPA_DB_PUT_MANY", records: rows }) : Promise.resolve(0);
  const getMeta = key => database({ type: "UPA_DB_GET_META", key });
  const setMeta = (key, value) => database({ type: "UPA_DB_SET_META", key, value });

  async function apiJson(path, options = {}) {
    const requestId = crypto.randomUUID(), method = options.method || "GET";
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { pendingApiRequests.delete(requestId); reject(new Error(`Publisher API timed out for ${path.split("?")[0]}.`)); }, 45000);
      pendingApiRequests.set(requestId, { resolve, reject, timeout, path });
      window.postMessage({ source: "unity-publisher-analytics", type: "UPA_API_REQUEST", requestId, path, method, body: options.body }, location.origin);
    });
  }

  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== "unity-publisher-analytics-api" || message?.type !== "UPA_API_RESPONSE") return;
    const pending = pendingApiRequests.get(message.requestId); if (!pending) return;
    pendingApiRequests.delete(message.requestId); clearTimeout(pending.timeout);
    if (message.ok) pending.resolve(message.data);
    else {
      const detail = typeof message.data === "string" ? compact(message.data).slice(0, 180) : message.data?.message || message.error || "";
      pending.reject(new Error(`Publisher API returned ${message.status || "a network error"} for ${pending.path.split("?")[0]}${detail ? `: ${detail}` : ""}.`));
    }
  });

  async function fetchPackages() {
    const raw = await apiJson(API.packages);
    return (Array.isArray(raw) ? raw : []).map(item => {
      const id = String(valueFrom(item, ["package_id", "packageId", "id"]) || "");
      return { id, name: valueFrom(item, ["name", "title", "package_name"]) || `Package ${id}`, firstPublished: parseDate(valueFrom(item, ["first_published_time", "firstPublishedTime", "first_published"])) };
    }).filter(item => item.id);
  }

  function normalizeSales(raw, period) {
    return (Array.isArray(raw) ? raw : []).map(item => normalize({
      type: "sales", period, date: `${period}-01`, packageId: String(valueFrom(item, ["package_id", "packageId"]) || ""), package: valueFrom(item, ["name", "package_name"]),
      price: toNumber(item.price), qty: toNumber(valueFrom(item, ["sales", "quantity"])), refunds: toNumber(item.refunds), chargebacks: toNumber(item.chargebacks),
      gross: toNumber(item.gross), net: toNumber(item.revenue), first: parseDate(item.first), last: parseDate(item.last), currency: "USD"
    }));
  }

  function normalizeDownloads(raw, period) {
    return (Array.isArray(raw) ? raw : []).map(item => {
      const data = item.downloads || {};
      const freeDownloads = toNumber(valueFrom(data, ["free_downloads", "freeDownloads"])), entitledDownloads = toNumber(valueFrom(data, ["entitled_downloads", "entitledDownloads"]));
      const freeUsers = toNumber(valueFrom(data, ["free_users", "freeUsers"])), entitledUsers = toNumber(valueFrom(data, ["entitled_users", "entitledUsers"]));
      return normalize({ type: "downloads", period, date: `${period}-01`, packageId: String(valueFrom(item, ["package_id", "packageId"]) || ""), package: item.name,
        downloads: freeDownloads + entitledDownloads, users: freeUsers + entitledUsers, freeDownloads, freeUsers, entitledDownloads, entitledUsers,
        freeFirst: parseDate(valueFrom(data, ["free_first", "freeFirst"])), freeLast: parseDate(valueFrom(data, ["free_last", "freeLast"])),
        entitledFirst: parseDate(valueFrom(data, ["entitled_first", "entitledFirst"])), entitledLast: parseDate(valueFrom(data, ["entitled_last", "entitledLast"])) });
    });
  }

  function normalizeRevenue(raw) {
    return (Array.isArray(raw) ? raw : []).map(item => {
      const date = parseDate(item.date);
      return normalize({ type: "revenue", period: date?.slice(0, 7), date, description: item.description, debit: toNumber(item.debit), credit: toNumber(item.credit), balance: toNumber(item.balance), currency: "USD" });
    }).filter(item => item.date);
  }

  function normalizeDaily(raw, scope) {
    const result = [];
    for (const [dateKey, metrics] of Object.entries(raw || {})) {
      if (!metrics || typeof metrics !== "object") continue;
      const date = parseDate(dateKey); if (!date) continue;
      const pageViews = toNumber(valueFrom(metrics, ["page_views", "pageViews"]));
      const paidQty = toNumber(valueFrom(metrics, ["sales", "paid_sales", "paidSales"]));
      const freeQty = toNumber(valueFrom(metrics, ["free_obtained", "freeObtained"]));
      const salesQty = paidQty + freeQty;
      result.push(normalize({ type: "daily", period: date.slice(0, 7), date, scope: scope.id ? "package" : "all", packageId: scope.id, package: scope.name,
        sales: toNumber(valueFrom(metrics, ["gross"])), salesQty, paidQty, freeQty, pageViews, conversionRate: Math.min(1, salesQty / (pageViews || 1)) * 100,
        downloads: toNumber(metrics.downloads), wishlisted: toNumber(metrics.wishlisted), refunds: toNumber(metrics.refunds), ratingAvg: toNumber(valueFrom(metrics, ["rating", "ratingAvg"])),
        quickLooks: toNumber(valueFrom(metrics, ["quick_looks", "quickLooks"])), carted: toNumber(metrics.carted), currency: "USD" }));
    }
    return result;
  }

  function earliestAccountDate(packages, revenue) {
    const dates = [...packages.map(item => item.firstPublished), ...revenue.map(item => item.date)].filter(Boolean).sort();
    if (!dates.length) throw new Error("The Publisher API did not return an account start date.");
    return [dates[0], DAILY_API_MIN_DATE].sort().at(-1);
  }

  async function saveJob() { await setMeta(SYNC_KEY, syncJob); }

  async function prepareFullSync() {
    const [packages, revenueRaw] = await Promise.all([fetchPackages(), apiJson(API.revenue)]);
    const revenue = normalizeRevenue(revenueRaw); await putMany(revenue);
    const start = earliestAccountDate(packages, revenue), endInclusive = latestCompleteDailyDate(), months = monthSequence(start, new Date().toISOString().slice(0, 10));
    const scopes = [{ id: null, name: "All assets" }, ...packages];
    const chunksPerScope = Math.max(1, Math.ceil((new Date(`${addDays(endInclusive, 1)}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000 / 60));
    syncJob = { active: true, phase: "months", startedAt: new Date().toISOString(), packages, start, endExclusive: addDays(endInclusive, 1), months, monthIndex: 0,
      scopes, scopeIndex: 0, cursor: start, completed: 1, total: 1 + months.length * 2 + scopes.length * chunksPerScope, label: "Getting your history ready" };
    await saveJob(); render();
  }

  async function runFullSync() {
    try {
      if (!syncJob?.active || !syncJob.phase) await prepareFullSync();
      if (syncJob.phase === "months") {
        while (syncJob.active && syncJob.monthIndex < syncJob.months.length) {
          const month = syncJob.months[syncJob.monthIndex]; syncJob.label = `Syncing sales and downloads · ${month}`; render();
          const [salesRaw, downloadsRaw] = await Promise.all([apiJson(API.sales(month)), apiJson(API.downloads(month))]);
          await putMany([...normalizeSales(salesRaw, month), ...normalizeDownloads(downloadsRaw, month)]);
          syncJob.monthIndex += 1; syncJob.completed += 2; await saveJob(); render(); await sleep(80);
        }
        if (!syncJob.active) return;
        syncJob.phase = "daily"; await saveJob();
      }
      if (syncJob.phase === "daily") {
        while (syncJob.active && syncJob.scopeIndex < syncJob.scopes.length) {
          const scope = syncJob.scopes[syncJob.scopeIndex];
          while (syncJob.active && syncJob.cursor < syncJob.endExclusive) {
            const chunkEnd = [addDays(syncJob.cursor, 60), syncJob.endExclusive].sort()[0];
            syncJob.label = `Syncing daily performance · ${scope.name} · ${syncJob.cursor}–${addDays(chunkEnd, -1)}`; render();
            let raw;
            try { raw = await apiJson(API.daily, { method: "POST", body: { start_date: apiTimestamp(syncJob.cursor), end_date: apiTimestamp(chunkEnd), package_ids: scope.id ? [scope.id] : [] } }); }
            catch (error) { throw new Error(`${error.message} Range ${syncJob.cursor}–${addDays(chunkEnd, -1)}, scope ${scope.name}.`); }
            await putMany(normalizeDaily(raw, scope));
            syncJob.cursor = chunkEnd; syncJob.completed += 1; await saveJob(); render(); await sleep(120);
          }
          syncJob.scopeIndex += 1; syncJob.cursor = syncJob.start; await saveJob();
        }
      }
      if (syncJob.active) { syncJob.active = false; syncJob.phase = "complete"; syncJob.finishedAt = new Date().toISOString(); syncJob.label = "Your history is up to date"; await saveJob(); records = await getAll(); render(); toast("Your complete publisher history is ready."); }
    } catch (error) {
      console.error("Unity Publisher Analytics+ sync failed:", error);
      syncJob = { ...(syncJob || {}), active: false, phase: "error", error: error.message, label: "Sync couldn't be completed" }; await saveJob(); render(); toast("We couldn't finish syncing your history. Please try again.", "error");
    }
  }

  async function startFullSync() {
    await database({ type: "UPA_DB_CLEAR" }); records = []; syncJob = null; isOpen = true; render(); await runFullSync();
  }

  async function incrementalSync() {
    if (syncJob?.active || !records.length) return;
    try {
      const packages = await fetchPackages(), currentMonth = new Date().toISOString().slice(0, 7);
      const [salesRaw, downloadsRaw, revenueRaw] = await Promise.all([apiJson(API.sales(currentMonth)), apiJson(API.downloads(currentMonth)), apiJson(API.revenue)]);
      await putMany([...normalizeSales(salesRaw, currentMonth), ...normalizeDownloads(downloadsRaw, currentMonth), ...normalizeRevenue(revenueRaw)]);
      const scopes = [{ id: null, name: "All assets" }, ...packages];
      for (const scope of scopes) {
        const last = records.filter(item => item.type === "daily" && item.packageId === scope.id).map(item => item.date).sort().at(-1);
        if (!last) continue;
        const endExclusive = addDays(latestCompleteDailyDate(), 1);
        let cursor = last;
        while (cursor < endExclusive) {
          const chunkEnd = [addDays(cursor, 60), endExclusive].sort()[0];
          const raw = await apiJson(API.daily, { method: "POST", body: { start_date: apiTimestamp(cursor), end_date: apiTimestamp(chunkEnd), package_ids: scope.id ? [scope.id] : [] } });
          await putMany(normalizeDaily(raw, scope)); cursor = chunkEnd;
        }
      }
      records = await getAll(); render();
    } catch (error) { console.warn("Unity Publisher Analytics+ incremental API sync failed:", error.message); }
  }

  function filtered(type) {
    let result = records.filter(item => item.type === type);
    if (prefs.range === "all") return result;
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - Number(prefs.range));
    return result.filter(item => new Date(item.date) >= cutoff);
  }

  function aggregateSales(items) {
    const totals = items.reduce((sum, item) => ({ gross: sum.gross + item.gross, net: sum.net + item.net, qty: sum.qty + item.qty, refunds: sum.refunds + item.refunds }), { gross: 0, net: 0, qty: 0, refunds: 0 });
    const months = new Map();
    for (const item of items) { const month = months.get(item.period) || { month: item.period, gross: 0 }; month.gross += item.gross; months.set(item.period, month); }
    return { totals, months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)) };
  }

  function aggregatePackages(items) {
    const packages = new Map();
    for (const item of items.filter(row => row.scope === "package")) {
      const current = packages.get(item.packageId) || { name: item.package, sales: 0, salesQty: 0, pageViews: 0, downloads: 0, wishlisted: 0 };
      current.sales += item.sales; current.salesQty += item.salesQty; current.pageViews += item.pageViews; current.downloads += item.downloads; current.wishlisted += item.wishlisted;
      packages.set(item.packageId, current);
    }
    return [...packages.values()].map(item => ({ ...item, conversion: item.salesQty / (item.pageViews || 1) * 100 })).sort((a, b) => b.sales - a.sales);
  }

  function lineChart(points) {
    if (!points.length) return '<div class="upa-empty-chart">Sync your history to see the revenue trend.</div>';
    const width = 900, height = 280, padLeft = 64, padRight = 20, padTop = 20, padBottom = 35, max = Math.max(...points.map(point => point.gross), 1);
    const plotWidth = width - padLeft - padRight, plotHeight = height - padTop - padBottom;
    const coords = points.map((point, index) => ({ ...point, x: padLeft + (points.length === 1 ? plotWidth / 2 : index * plotWidth / (points.length - 1)), y: padTop + plotHeight - point.gross / max * plotHeight }));
    const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `${path} L${coords.at(-1).x.toFixed(1)},${(padTop + plotHeight).toFixed(1)} L${coords[0].x.toFixed(1)},${(padTop + plotHeight).toFixed(1)} Z`;
    const grid = [0, .25, .5, .75, 1].map(ratio => { const y = padTop + plotHeight * (1 - ratio); return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#eceef3"/><text x="${padLeft - 10}" y="${y + 3}" text-anchor="end">${money(max * ratio)}</text>`; }).join("");
    const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
    return `<svg class="upa-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly gross revenue trend"><defs><linearGradient id="upa-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c5ce7" stop-opacity=".22"/><stop offset="1" stop-color="#6c5ce7" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#upa-revenue-fill)"/><path d="${path}" fill="none" stroke="#6c5ce7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="3" fill="#fff" stroke="#6c5ce7" stroke-width="2"><title>${escapeHtml(point.month)}: ${money(point.gross)}</title></circle>`).join("")}${tickIndexes.map(index => `<text x="${coords[index].x}" y="${height - 9}" text-anchor="middle">${escapeHtml(points[index].month)}</text>`).join("")}</svg>`;
  }

  function render() {
    renderQueued = false; const host = document.getElementById("upa-root"); if (!host) return;
    const sales = aggregateSales(filtered("sales")), downloads = filtered("downloads").reduce((sum, item) => sum + item.downloads, 0);
    const daily = filtered("daily"), dailyAll = daily.filter(item => item.scope === "all"), packages = aggregatePackages(daily);
    const pageViews = dailyAll.reduce((sum, item) => sum + item.pageViews, 0), salesQty = dailyAll.reduce((sum, item) => sum + item.salesQty, 0);
    const revenue = records.filter(item => item.type === "revenue").sort((a, b) => a.date.localeCompare(b.date)), balance = revenue.at(-1)?.balance || 0;
    const progress = syncJob?.active ? Math.min(100, Math.round((syncJob.completed || 0) / Math.max(syncJob.total || 1, 1) * 100)) : 0;
    const daysTracked = new Set(dailyAll.map(item => item.date)).size;
    const hasData = records.length > 0;
    const syncTitle = syncJob?.active ? syncJob.label : syncJob?.phase === "error" ? "Sync couldn't be completed" : records.length ? "Your data is up to date" : "Ready to sync your history";
    const syncDetail = syncJob?.active
      ? `${syncJob.completed || 0} of ${syncJob.total || "?"} steps complete`
      : syncJob?.phase === "error"
        ? "Try again. If it keeps happening, refresh the Publisher Portal first."
        : "Checks for new data when you visit the portal";
    const syncIcon = syncJob?.active
      ? `<div class="upa-sync-icon upa-sync-progress" style="--upa-progress-angle:${progress * 3.6}deg" aria-hidden="true"><span>${progress}%</span></div>`
      : syncJob?.phase === "error"
        ? '<div class="upa-sync-icon upa-sync-error" aria-hidden="true">!</div>'
        : '<div class="upa-sync-icon upa-sync-complete" aria-hidden="true">✓</div>';
    host.classList.toggle("upa-open", isOpen);
    document.documentElement.classList.toggle("upa-dashboard-open", isOpen);
    host.innerHTML = `<button class="upa-fab" aria-label="Open Unity Analytics+" title="Unity Analytics+"><span>A+</span></button><aside class="upa-panel" aria-label="Unity Analytics+ dashboard">
      <div class="upa-shell">
        <nav class="upa-sidebar" aria-label="Dashboard sections">
          <div class="upa-brand"><span>A+</span><div><strong>Analytics+</strong><small>Unity Publisher</small></div></div>
          ${hasData ? `<div class="upa-nav-group"><small>Workspace</small><button class="upa-nav-item upa-active" data-action="scroll-overview"><span>Overview</span><i>01</i></button><button class="upa-nav-item" data-action="scroll-performance"><span>Performance</span><i>02</i></button><button class="upa-nav-item" data-action="scroll-packages"><span>Packages</span><i>03</i></button></div>` : `<div class="upa-onboarding-nav"><small>Getting started</small><strong>Build your publisher history</strong><span>One sync brings your available analytics into this workspace.</span></div>`}
          <div class="upa-sidebar-status"><small>${hasData ? "Data coverage" : "Your data"}</small><strong>${hasData ? `${sales.months.length} months` : "Stored locally"}</strong><span>${hasData ? `${daysTracked} complete days tracked` : "Private to this browser"}</span></div>
          ${hasData ? '<div class="upa-sidebar-actions"><button data-action="export">Export data</button><button class="upa-danger" data-action="clear">Clear data</button></div>' : ""}
        </nav>
        <section class="upa-workspace">
          <header class="upa-header"><div><small>Publisher workspace</small><h1>${hasData ? "Overview" : "Welcome"}</h1><p>${hasData ? "Your catalog performance across the selected period." : "Build a complete, configurable view of your publishing business."}</p></div><button class="upa-icon-button" data-action="close" aria-label="Close analytics">×</button></header>
          ${hasData ? `<div class="upa-toolbar"><label>Time range<select id="upa-range"><option value="all" ${prefs.range === "all" ? "selected" : ""}>All available history</option><option value="12" ${prefs.range === "12" ? "selected" : ""}>Last 12 months</option><option value="6" ${prefs.range === "6" ? "selected" : ""}>Last 6 months</option><option value="3" ${prefs.range === "3" ? "selected" : ""}>Last 3 months</option></select></label></div>` : ""}
          ${(hasData || syncJob?.active || syncJob?.phase === "error") ? `<section class="upa-sync ${syncJob?.active ? "upa-syncing" : ""}">${syncIcon}<div class="upa-sync-copy"><strong>${escapeHtml(syncTitle)}</strong><span>${escapeHtml(syncDetail)}</span>${syncJob?.active ? '<small class="upa-sync-note">Large catalogs can take several minutes. Keep this tab open; if interrupted, progress resumes when you return.</small>' : ""}</div><div class="upa-sync-actions">${syncJob?.active ? '<button data-action="stop-sync">Pause</button>' : hasData ? '<button class="upa-primary" data-action="sync-all">Resync full history</button>' : ""}</div>${syncJob?.active ? `<div class="upa-progress"><i style="width:${progress}%"></i></div>` : ""}</section>` : ""}
          <main class="upa-content" id="upa-overview">${records.length ? `<section class="upa-kpis"><article><div><small>Gross revenue</small><span class="upa-kpi-dot upa-violet"></span></div><strong>${money(sales.totals.gross)}</strong><span>${number(sales.totals.qty)} paid units</span></article><article><div><small>Pageviews</small><span class="upa-kpi-dot upa-cyan"></span></div><strong>${number(pageViews)}</strong><span>${number(salesQty)} purchases and claims</span></article><article><div><small>Downloads</small><span class="upa-kpi-dot upa-amber"></span></div><strong>${number(downloads)}</strong><span>Across the selected period</span></article><article><div><small>Current balance</small><span class="upa-kpi-dot upa-green"></span></div><strong>${money(balance)}</strong><span>${number(daysTracked)} days tracked</span></article></section>
            <section class="upa-dashboard-grid"><article class="upa-card upa-performance-card" id="upa-performance"><div class="upa-section-title"><div><small>PERFORMANCE</small><h2>Monthly gross revenue</h2><p>Lifetime revenue movement across your catalog.</p></div><span>${sales.months.length} periods</span></div>${lineChart(sales.months)}</article>
            <article class="upa-card upa-packages-card" id="upa-packages"><div class="upa-section-title"><div><small>AUDIENCE &amp; CONVERSION</small><h2>Package performance</h2><p>Top packages ranked by gross sales.</p></div><span>${packages.length} packages</span></div><div class="upa-package-list">${packages.slice(0, 10).map((item, index) => `<div class="upa-package-row"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escapeHtml(item.name)}</strong><span>${number(item.pageViews)} views · ${item.conversion.toFixed(2)}% conversion · ${number(item.downloads)} downloads</span></div><em>${money(item.sales)}</em></div>`).join("")}</div></article></section>` : `<section class="upa-welcome"><div class="upa-welcome-copy"><small>YOUR COMPLETE PICTURE</small><h2>Go beyond the<br>one-year window.</h2><p>Bring your available sales, downloads, revenue, pageviews, and conversion history into one configurable workspace.</p>${syncJob?.active ? '<div class="upa-welcome-running"><i></i><span>Your history is being prepared. You can leave this page open and follow the progress above.</span></div>' : '<button class="upa-primary upa-large" data-action="sync-all">Sync full history</button>'}</div><div class="upa-welcome-visual" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span>Lifetime</span></div></section>`}</main>
        </section>
      </div>
      <div class="upa-toast" role="status" aria-live="polite"></div>
    </aside>`;
  }

  function scheduleRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } }
  function toast(message, type = "success") { const node = document.querySelector("#upa-root .upa-toast"); if (!node) return; node.textContent = message; node.dataset.type = type; node.classList.add("upa-show"); setTimeout(() => node.classList.remove("upa-show"), 3600); }
  function download(name, contents) { const url = URL.createObjectURL(new Blob([contents], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  function bindEvents() {
    document.addEventListener("click", async event => {
      if (!event.target.closest("#upa-root")) return;
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (event.target.closest(".upa-fab")) { isOpen = true; render(); return; }
      if (action === "close") { isOpen = false; render(); }
      if (action?.startsWith("scroll-")) document.getElementById(`upa-${action.slice(7)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (action === "sync-all") await startFullSync();
      if (action === "stop-sync") { syncJob.active = false; syncJob.label = "Sync paused"; await saveJob(); render(); }
      if (action === "export") download(`unity-publisher-analytics-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2));
      if (action === "clear" && window.confirm("Clear all locally synced publisher data? This can't be undone.")) { await database({ type: "UPA_DB_CLEAR" }); records = []; syncJob = null; render(); }
    });
    document.addEventListener("change", async event => {
      if (event.target.id === "upa-range") { prefs.range = event.target.value; await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render(); }
    });
    chrome.runtime.onMessage.addListener(message => { if (message?.type === "UPA_TOGGLE") { isOpen = !isOpen; render(); } });
  }

  async function init() {
    const stored = await chrome.storage.local.get(PREFS_KEY);
    prefs = { range: stored[PREFS_KEY]?.range || "all" };
    await chrome.storage.local.set({ [PREFS_KEY]: prefs });
    records = await getAll(); syncJob = await getMeta(SYNC_KEY); isOpen = Boolean(syncJob?.active);
    const root = document.createElement("div"); root.id = "upa-root"; document.body.appendChild(root); bindEvents(); render();
    if (syncJob?.active) runFullSync(); else if (records.length) incrementalSync();
  }

  init().catch(error => console.error("Unity Publisher Analytics+ failed to initialize:", error));
})();
