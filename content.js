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
  let prefs = { section: "dashboard", view: "revenue", range: "all", interval: "auto", start: "", end: "", calendarMetric: "sales", sankeyPackages: [] };
  let syncJob = null;
  let isRefreshing = false;
  let isOpen = false;
  let renderQueued = false;
  const chartInstances = new Map();
  const chartResizeObservers = new Map();
  const chartShareMetadata = new Map();
  const pendingApiRequests = new Map();

  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const compact = value => String(value ?? "").trim().replace(/\s+/g, " ");
  const keyOf = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
  const number = value => new Intl.NumberFormat().format(Number(value) || 0);
  const money = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const dateTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Refresh time unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };

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
      if (syncJob.active) {
        const completedAt = new Date().toISOString();
        syncJob.active = false; syncJob.phase = "complete"; syncJob.finishedAt = completedAt; syncJob.lastRefreshedAt = completedAt; syncJob.label = "Your history is up to date";
        await saveJob(); records = await getAll(); render(); toast("Your complete publisher history is ready.");
      }
    } catch (error) {
      console.error("Unity Publisher Analytics+ sync failed:", error);
      syncJob = { ...(syncJob || {}), active: false, phase: "error", error: error.message, label: "Sync couldn't be completed" }; await saveJob(); render(); toast("We couldn't finish syncing your history. Please try again.", "error");
    }
  }

  async function startFullSync() {
    await database({ type: "UPA_DB_CLEAR" }); records = []; syncJob = null; isOpen = true; render(); await runFullSync();
  }

  async function incrementalSync(announce = false) {
    if (syncJob?.active || isRefreshing || !records.length) return;
    isRefreshing = true; render();
    let notice = "", noticeType = "success";
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
      records = await getAll();
      syncJob = { ...(syncJob || {}), active: false, phase: "complete", error: "", label: "Your history is up to date", lastRefreshedAt: new Date().toISOString() };
      await saveJob();
      if (announce) notice = "Your publisher data has been refreshed.";
    } catch (error) {
      console.warn("Unity Publisher Analytics+ incremental API sync failed:", error.message);
      if (announce) { notice = "We couldn't refresh your publisher data. Please try again."; noticeType = "error"; }
    } finally { isRefreshing = false; render(); if (notice) toast(notice, noticeType); }
  }

  function availableDateBounds() {
    const dates = records.filter(item => item.type === "daily" && item.scope === "all").map(item => item.date).filter(Boolean).sort();
    return { start: dates[0] || "", end: dates.at(-1) || "" };
  }

  function selectedDateBounds() {
    const available = availableDateBounds();
    if (!available.start) return available;
    if (prefs.range === "custom") {
      const start = prefs.start || available.start, end = prefs.end || available.end;
      return start <= end ? { start, end } : { start: end, end: start };
    }
    if (prefs.range === "all") return available;
    const start = new Date(`${available.end}T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() - Number(prefs.range));
    return { start: start.toISOString().slice(0, 10), end: available.end };
  }

  function filtered(type) {
    const bounds = selectedDateBounds();
    return records.filter(item => item.type === type && (!bounds.start || (item.date >= bounds.start && item.date <= bounds.end)));
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

  function automaticInterval(bounds) {
    const days = bounds.start && bounds.end ? Math.max(1, (new Date(`${bounds.end}T00:00:00Z`) - new Date(`${bounds.start}T00:00:00Z`)) / 86400000) : 0;
    if (days <= 120) return "day";
    if (days <= 730) return "week";
    if (days <= 2190) return "month";
    return "quarter";
  }

  function resolvedInterval(bounds) {
    return prefs.interval && prefs.interval !== "auto" ? prefs.interval : automaticInterval(bounds);
  }

  function bucketStart(value, interval) {
    const date = new Date(`${value}T00:00:00Z`);
    if (interval === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    if (interval === "month") date.setUTCDate(1);
    if (interval === "quarter") { date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3, 1); }
    if (interval === "year") date.setUTCMonth(0, 1);
    return date.toISOString().slice(0, 10);
  }

  function revenueViewModel(items, interval) {
    const buckets = new Map();
    for (const item of items) {
      const key = bucketStart(item.date, interval);
      buckets.set(key, (buckets.get(key) || 0) + item.sales);
    }
    const points = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => [Date.parse(`${date}T00:00:00Z`), value]);
    const total = points.reduce((sum, point) => sum + point[1], 0);
    const peak = points.reduce((best, point) => !best || point[1] > best[1] ? point : best, null);
    return { interval, points, total, average: points.length ? total / points.length : 0, peak };
  }

  function overviewViewModel(items, bounds) {
    const interval = automaticInterval(bounds), buckets = new Map();
    for (const item of items) {
      const key = bucketStart(item.date, interval), bucket = buckets.get(key) || { date: key, revenue: 0, pageViews: 0, downloads: 0 };
      bucket.revenue += item.sales; bucket.pageViews += item.pageViews; bucket.downloads += item.downloads; buckets.set(key, bucket);
    }
    return { interval, points: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  }

  function intervalName(interval) {
    return ({ day: "Daily", week: "Weekly", month: "Monthly", quarter: "Quarterly", year: "Yearly" })[interval] || "Revenue";
  }

  function disposeCharts() {
    for (const observer of chartResizeObservers.values()) observer.disconnect();
    for (const chart of chartInstances.values()) chart.dispose();
    chartResizeObservers.clear(); chartInstances.clear();
  }

  function createChart(key, container, onResize) {
    if (!container || !globalThis.UPAECharts?.init) return null;
    const chart = globalThis.UPAECharts.init(container, null, { renderer: "svg" });
    let lastWidth = Math.round(container.clientWidth);
    const observer = new ResizeObserver(entries => {
      chart.resize();
      const width = Math.round(entries[0]?.contentRect.width || container.clientWidth);
      if (onResize && width !== lastWidth) {
        lastWidth = width;
        onResize(chart, width);
      }
    });
    observer.observe(container); chartInstances.set(key, chart); chartResizeObservers.set(key, observer);
    return chart;
  }

  function renderRevenueChart(viewModel) {
    const container = document.getElementById("upa-revenue-chart");
    if (!container || !viewModel.points.length) return;
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const compactMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(viewModel.interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chart = createChart("revenue", container); if (!chart) return;
    chart.setOption({
      animation: !reducedMotion && viewModel.points.length < 260,
      aria: { enabled: true, description: `${intervalName(viewModel.interval)} gross revenue from ${dateLabel(viewModel.points[0][0])} to ${dateLabel(viewModel.points.at(-1)[0])}.` },
      grid: { left: 14, right: 18, top: 22, bottom: 72, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => { const point = parameters[0]?.data; return point ? `<strong>${dateLabel(point[0])}</strong><br/><span style="color:#aaa3d8">Gross revenue</span>&nbsp;&nbsp;${fullMoney(point[1])}` : ""; }
      },
      xAxis: { type: "time", boundaryGap: false, axisLine: { lineStyle: { color: "#dfe2e9" } }, axisTick: { show: false }, axisLabel: { color: "#81899b", fontSize: 10, hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#81899b", fontSize: 10, formatter: compactMoney }, splitLine: { lineStyle: { color: "#eceef3" } } },
      dataZoom: [
        { type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, preventDefaultMouseMove: true },
        { type: "slider", filterMode: "none", height: 20, bottom: 16, borderColor: "transparent", backgroundColor: "#f0f1f5", fillerColor: "rgba(108,92,231,.14)", dataBackground: { lineStyle: { color: "#aaa2ec" }, areaStyle: { color: "#ddd9fa" } }, selectedDataBackground: { lineStyle: { color: "#6c5ce7" }, areaStyle: { color: "#c8c1f5" } }, handleStyle: { color: "#fff", borderColor: "#6c5ce7" }, moveHandleStyle: { color: "#6c5ce7" }, textStyle: { color: "#81899b", fontSize: 9 } }
      ],
      series: [{
        name: "Gross revenue", type: "line", data: viewModel.points, smooth: .16, sampling: "lttb", showSymbol: viewModel.points.length <= 120, symbol: "circle", symbolSize: 6,
        lineStyle: { color: "#6c5ce7", width: 2.5 }, itemStyle: { color: "#fff", borderColor: "#6c5ce7", borderWidth: 2 },
        areaStyle: { color: new globalThis.UPAECharts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(108,92,231,.23)" }, { offset: 1, color: "rgba(108,92,231,0)" }]) }, emphasis: { focus: "series" }
      }]
    });
  }

  function renderOverviewChart(viewModel) {
    const container = document.getElementById("upa-overview-chart");
    if (!container) return;
    if (!viewModel.points.length) { container.innerHTML = '<div class="upa-empty-chart">No activity is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const chart = createChart("overview", container); if (!chart) return;
    const lookup = new Map(viewModel.points.map(point => [Date.parse(`${point.date}T00:00:00Z`), point]));
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(viewModel.interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const compactNumber = value => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const compactMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const axes = [0, 1, 2].map(index => ({
      type: "time", gridIndex: index, boundaryGap: false, axisLine: { show: index === 2, lineStyle: { color: "#dfe2e9" } }, axisTick: { show: false },
      axisLabel: { show: index === 2, color: "#81899b", fontSize: 9, hideOverlap: true }, splitLine: { show: false }
    }));
    const yAxes = [
      { name: "REVENUE", formatter: compactMoney, color: "#6c5ce7" },
      { name: "PAGEVIEWS", formatter: compactNumber, color: "#21a7bd" },
      { name: "DOWNLOADS", formatter: compactNumber, color: "#d99721" }
    ].map((axis, index) => ({
      type: "value", gridIndex: index, min: 0, name: axis.name, nameLocation: "end", nameGap: 7, nameTextStyle: { color: axis.color, fontSize: 8, fontWeight: 800, align: "left" },
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#8b92a3", fontSize: 9, formatter: axis.formatter }, splitLine: { lineStyle: { color: "#eef0f4" } }
    }));
    const series = [
      { name: "Gross revenue", key: "revenue", color: "#6c5ce7", area: ["rgba(108,92,231,.2)", "rgba(108,92,231,0)"] },
      { name: "Pageviews", key: "pageViews", color: "#21a7bd", area: ["rgba(33,167,189,.17)", "rgba(33,167,189,0)"] },
      { name: "Downloads", key: "downloads", color: "#d99721", area: ["rgba(217,151,33,.16)", "rgba(217,151,33,0)"] }
    ].map((item, index) => ({
      name: item.name, type: "line", xAxisIndex: index, yAxisIndex: index, data: viewModel.points.map(point => [Date.parse(`${point.date}T00:00:00Z`), point[item.key]]),
      smooth: .16, sampling: "lttb", showSymbol: false, lineStyle: { color: item.color, width: 2 }, itemStyle: { color: item.color },
      areaStyle: { color: new globalThis.UPAECharts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: item.area[0] }, { offset: 1, color: item.area[1] }]) }, emphasis: { focus: "series" }
    }));
    chart.setOption({
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches && viewModel.points.length < 260,
      aria: { enabled: true, description: `${intervalName(viewModel.interval)} gross revenue, pageviews, and downloads across the selected period.` },
      grid: [{ left: 72, right: 18, top: 25, height: 72 }, { left: 72, right: 18, top: 140, height: 72 }, { left: 72, right: 18, top: 255, height: 72 }],
      tooltip: {
        trigger: "axis", confine: true, axisPointer: { type: "line", lineStyle: { color: "#a9afbc" } }, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => { const timestamp = parameters[0]?.value?.[0], point = lookup.get(timestamp); return point ? `<strong>${dateLabel(timestamp)}</strong><br/><span style="color:#aaa3d8">Gross revenue</span>&nbsp;&nbsp;${fullMoney(point.revenue)}<br/><span style="color:#8ad7e2">Pageviews</span>&nbsp;&nbsp;${number(point.pageViews)}<br/><span style="color:#f0c36c">Downloads</span>&nbsp;&nbsp;${number(point.downloads)}` : ""; }
      },
      xAxis: axes, yAxis: yAxes, series
    });
  }

  function calendarMetric(metric) {
    return ({
      sales: { key: "sales", label: "Gross revenue", currency: true },
      salesQty: { key: "salesQty", label: "Purchases and claims", currency: false },
      pageViews: { key: "pageViews", label: "Pageviews", currency: false },
      downloads: { key: "downloads", label: "Downloads", currency: false }
    })[metric] || { key: "sales", label: "Gross revenue", currency: true };
  }

  function calendarViewModel(items, metricKey) {
    const metric = calendarMetric(metricKey), byDate = new Map();
    for (const item of items) byDate.set(item.date, (byDate.get(item.date) || 0) + toNumber(item[metric.key]));
    const points = [...byDate].sort(([a], [b]) => a.localeCompare(b));
    const years = [...new Set(points.map(([date]) => date.slice(0, 4)))];
    const values = points.map(([, value]) => value).filter(value => value > 0).sort((a, b) => a - b);
    const scaleMax = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * .95))] : 1;
    const peak = points.reduce((best, point) => !best || point[1] > best[1] ? point : best, null);
    return { metric, points, years, scaleMax: Math.max(scaleMax, 1), peak, total: points.reduce((sum, point) => sum + point[1], 0) };
  }

  function renderCalendarChart(viewModel) {
    const container = document.getElementById("upa-calendar-chart");
    if (!container) return;
    if (!viewModel.points.length) { container.innerHTML = '<div class="upa-empty-chart">No daily activity is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const formatValue = value => viewModel.metric.currency
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
      : number(value);
    const series = viewModel.years.map((year, index) => ({
      name: viewModel.metric.label, type: "heatmap", coordinateSystem: "calendar", calendarIndex: index,
      data: viewModel.points.filter(([date]) => date.startsWith(year)), emphasis: { itemStyle: { borderColor: "#26213f", borderWidth: 1, shadowBlur: 5, shadowColor: "rgba(40,32,78,.25)" } }
    }));
    const setCalendarOption = (chart, availableWidth) => {
      const width = Math.max(280, availableWidth || container.clientWidth);
      const sideRoom = width < 540 ? 48 : 88;
      const cellSize = Math.max(5, Math.min(18, Math.floor((width - sideRoom) / 53)));
      const rowHeight = cellSize * 7;
      const rowGap = Math.max(30, Math.round(cellSize * 1.8));
      const firstRowTop = 90;
      const rowStep = rowHeight + rowGap;
      const calendarWidth = cellSize * 53;
      const left = Math.max(36, Math.round((width - calendarWidth) / 2));
      const chartHeight = Math.max(250, firstRowTop + viewModel.years.length * rowStep + 22);
      const calendars = viewModel.years.map((year, index) => ({
        range: year, top: firstRowTop + index * rowStep, left, cellSize: [cellSize, cellSize],
        splitLine: { show: true, lineStyle: { color: "#fff", width: 3 } },
        itemStyle: { color: "#f3f4f7", borderColor: "#fff", borderWidth: 2 },
        yearLabel: { show: true, position: "left", margin: 35, color: "#434b5d", fontSize: 12, fontWeight: 750 },
        monthLabel: { color: "#858da0", fontSize: 9, margin: 7 }, dayLabel: { firstDay: 1, color: "#a0a6b5", fontSize: 8, margin: 7 }
      }));
      container.style.height = `${chartHeight}px`;
      chart.resize({ height: chartHeight });
      chart.setOption({
        animation: false,
        aria: { enabled: true, description: `${viewModel.metric.label} by day across ${viewModel.years.length} calendar years.` },
        tooltip: { trigger: "item", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 }, formatter: parameter => `<strong>${escapeHtml(parameter.data[0])}</strong><br/><span style="color:#aaa3d8">${viewModel.metric.label}</span>&nbsp;&nbsp;${formatValue(parameter.data[1])}` },
        visualMap: { min: 0, max: viewModel.scaleMax, calculable: true, orient: "horizontal", right: 20, top: 8, itemWidth: 9, itemHeight: 110, text: [formatValue(viewModel.scaleMax), "0"], textGap: 7, textStyle: { color: "#81899b", fontSize: 9 }, inRange: { color: ["#f1f0f8", "#d9d4f6", "#a99def", "#6c5ce7", "#372c83"] }, seriesIndex: series.map((_, index) => index) },
        calendar: calendars, series
      }, { notMerge: true });
    };
    const chart = createChart("calendar", container, setCalendarOption); if (!chart) return;
    setCalendarOption(chart, container.clientWidth);
  }

  function sankeyPackageOptions(items) {
    const packages = new Map();
    for (const item of items) {
      const key = String(item.packageId || item.package || "unknown"), current = packages.get(key) || { key, name: item.package || `Package ${key}`, gross: 0 };
      current.gross += Math.max(0, item.gross); packages.set(key, current);
    }
    return [...packages.values()].filter(item => item.gross > 0).sort((a, b) => b.gross - a.gross);
  }

  function sankeyViewModel(items, selectedPackageKeys) {
    const options = sankeyPackageOptions(items), availableKeys = new Set(options.map(item => item.key));
    const explicitKeys = (selectedPackageKeys || []).filter(key => availableKeys.has(key));
    const activePackages = explicitKeys.length ? options.filter(item => explicitKeys.includes(item.key)) : options.slice(0, 8);
    const activeKeys = new Set(activePackages.map(item => item.key)), packageTierLinks = new Map(), tierTotals = new Map();
    for (const item of items) {
      const packageKey = String(item.packageId || item.package || "unknown"), gross = Math.max(0, item.gross);
      if (!activeKeys.has(packageKey) || !gross) continue;
      const tierKey = Number(item.price || 0).toFixed(2), linkKey = `${packageKey}|${tierKey}`;
      packageTierLinks.set(linkKey, (packageTierLinks.get(linkKey) || 0) + gross); tierTotals.set(tierKey, (tierTotals.get(tierKey) || 0) + gross);
    }
    const priceLabel = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(value);
    const palette = ["#6c5ce7", "#8b7cf0", "#4e8bd7", "#21a7bd", "#aa69c7", "#6170c7", "#6751aa", "#3f8fa4"];
    const nodes = activePackages.map((item, index) => ({ name: `package:${item.key}`, label: item.name, kind: "package", itemStyle: { color: palette[index % palette.length] } }));
    for (const tierKey of tierTotals.keys()) nodes.push({ name: `tier:${tierKey}`, label: `${priceLabel(Number(tierKey))} tier`, kind: "tier", itemStyle: { color: "#34a7b7" } });
    nodes.push({ name: "revenue", label: "Gross revenue", kind: "total", itemStyle: { color: "#2f9c69" } });
    const packageNames = new Map(activePackages.map(item => [item.key, item.name]));
    const links = [];
    for (const [key, value] of packageTierLinks) {
      const [packageKey, tierKey] = key.split("|");
      links.push({ source: `package:${packageKey}`, target: `tier:${tierKey}`, value, sourceLabel: packageNames.get(packageKey), targetLabel: `${priceLabel(Number(tierKey))} tier` });
    }
    for (const [tierKey, value] of tierTotals) links.push({ source: `tier:${tierKey}`, target: "revenue", value, sourceLabel: `${priceLabel(Number(tierKey))} tier`, targetLabel: "Gross revenue" });
    return { options, explicitKeys, activePackages, nodes, links, total: [...tierTotals.values()].reduce((sum, value) => sum + value, 0), tiers: tierTotals.size };
  }

  function renderSankeyChart(viewModel) {
    const container = document.getElementById("upa-sankey-chart");
    if (!container) return;
    if (!viewModel.links.length) { container.innerHTML = '<div class="upa-empty-chart">No package revenue is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const chart = createChart("sankey", container); if (!chart) return;
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    chart.setOption({
      animationDuration: 550, animationDurationUpdate: 350,
      aria: { enabled: true, description: `Gross revenue from ${viewModel.activePackages.length} packages through ${viewModel.tiers} price tiers.` },
      tooltip: { trigger: "item", triggerOn: "mousemove", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 }, formatter: parameter => parameter.dataType === "edge" ? `<strong>${escapeHtml(parameter.data.sourceLabel)}</strong><br/><span style="color:#aaa3d8">to ${escapeHtml(parameter.data.targetLabel)}</span>&nbsp;&nbsp;${fullMoney(parameter.value)}` : `<strong>${escapeHtml(parameter.data.label)}</strong><br/>${fullMoney(parameter.value)}` },
      series: [{
        type: "sankey", left: 18, right: 18, top: 22, bottom: 20, nodeWidth: 14, nodeGap: 13, nodeAlign: "justify", draggable: true, layoutIterations: 36,
        data: viewModel.nodes, links: viewModel.links, label: { color: "#343b4d", fontSize: 10, fontWeight: 650, formatter: parameter => parameter.data.label },
        lineStyle: { color: "gradient", curveness: .52, opacity: .3 }, emphasis: { focus: "adjacency", lineStyle: { opacity: .65 } }, itemStyle: { borderWidth: 0, borderRadius: 3 }
      }]
    });
  }

  function chartActions(key, disabled = false) {
    return `<div class="upa-chart-actions"><button data-chart-action="save" data-chart="${key}" title="Save this chart as a high-resolution PNG" ${disabled ? "disabled" : ""}>Save PNG</button><button data-chart-action="share" data-chart="${key}" title="Share this chart using your device" ${disabled ? "disabled" : ""}>Share</button></div>`;
  }

  function chartFilename(key) { return `unity-publisher-${key}-${new Date().toISOString().slice(0, 10)}.png`; }

  async function chartImage(key) {
    const chart = chartInstances.get(key), metadata = chartShareMetadata.get(key); if (!chart || !metadata) throw new Error("This chart is not ready yet.");
    const source = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    const image = new Image(); image.src = source; await image.decode();
    const headerHeight = 150, canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight + headerHeight;
    const context = canvas.getContext("2d"); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#172033"; context.font = "700 32px Segoe UI, sans-serif"; context.fillText(metadata.title, 40, 56);
    context.fillStyle = "#70798d"; context.font = "20px Segoe UI, sans-serif"; context.fillText(metadata.subtitle, 40, 91);
    context.fillStyle = "#6c5ce7"; context.font = "700 18px Segoe UI, sans-serif"; context.textAlign = "right"; context.fillText("Analytics+", canvas.width - 40, 56); context.textAlign = "left";
    context.drawImage(image, 0, headerHeight);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not create the chart image.")), "image/png"));
    return { blob, filename: chartFilename(key), metadata };
  }

  async function handleChartAction(action, key) {
    try {
      const image = await chartImage(key);
      if (action === "share" && navigator.share) {
        const file = new File([image.blob], image.filename, { type: "image/png" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) { await navigator.share({ title: image.metadata.title, text: image.metadata.subtitle, files: [file] }); return; }
      }
      const url = URL.createObjectURL(image.blob);
      const link = document.createElement("a"); link.href = url; link.download = image.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(action === "share" ? "Sharing is unavailable here, so the chart was downloaded instead." : "Chart saved as a high-resolution PNG.");
    } catch (error) { if (error.name !== "AbortError") toast(error.message, "error"); }
  }

  function render() {
    renderQueued = false; const host = document.getElementById("upa-root"); if (!host) return;
    disposeCharts(); chartShareMetadata.clear();
    const salesItems = filtered("sales"), sales = aggregateSales(salesItems);
    const daily = filtered("daily"), dailyAll = daily.filter(item => item.scope === "all"), packages = aggregatePackages(daily);
    const pageViews = dailyAll.reduce((sum, item) => sum + item.pageViews, 0), salesQty = dailyAll.reduce((sum, item) => sum + item.salesQty, 0);
    const paidUnits = dailyAll.reduce((sum, item) => sum + item.paidQty, 0), downloads = dailyAll.reduce((sum, item) => sum + item.downloads, 0);
    const revenue = records.filter(item => item.type === "revenue").sort((a, b) => a.date.localeCompare(b.date)), balance = revenue.at(-1)?.balance || 0;
    const progress = syncJob?.active ? Math.min(100, Math.round((syncJob.completed || 0) / Math.max(syncJob.total || 1, 1) * 100)) : 0;
    const daysTracked = new Set(dailyAll.map(item => item.date)).size;
    const hasData = records.length > 0;
    const availableBounds = availableDateBounds(), dateBounds = selectedDateBounds(), interval = resolvedInterval(dateBounds), revenueChartData = revenueViewModel(dailyAll, interval);
    const overviewChartData = overviewViewModel(dailyAll, dateBounds), calendarData = calendarViewModel(dailyAll, prefs.calendarMetric), sankeyData = sankeyViewModel(salesItems, prefs.sankeyPackages);
    const sankeyHeight = Math.max(410, sankeyData.activePackages.length * 48 + 96);
    chartShareMetadata.set("overview", { title: "Portfolio pulse", subtitle: `${intervalName(overviewChartData.interval)} revenue, pageviews, and downloads · ${dateBounds.start} to ${dateBounds.end}` });
    chartShareMetadata.set("revenue", { title: "Gross revenue over time", subtitle: `${intervalName(interval)} totals · ${dateBounds.start} to ${dateBounds.end}` });
    chartShareMetadata.set("calendar", { title: `${calendarData.metric.label} calendar`, subtitle: `${dateBounds.start} to ${dateBounds.end} · daily intensity across ${calendarData.years.length} ${calendarData.years.length === 1 ? "year" : "years"}` });
    chartShareMetadata.set("sankey", { title: "Where revenue comes from", subtitle: `${sankeyData.activePackages.length} packages · ${sankeyData.tiers} price tiers · ${dateBounds.start} to ${dateBounds.end}` });
    const views = [
      { id: "revenue", label: "Revenue", description: "Explore gross revenue over time with flexible intervals." },
      { id: "calendar", label: "Daily patterns", description: "Compare daily intensity and seasonality across years." },
      { id: "sankey", label: "Revenue flow", description: "See how package revenue is distributed across price tiers." },
      { id: "packages", label: "Packages", description: "Compare attention, conversion, downloads, and gross sales." }
    ];
    const section = ["dashboard", "analytics"].includes(prefs.section) ? prefs.section : "dashboard";
    const view = views.some(item => item.id === prefs.view) ? prefs.view : "revenue";
    const sectionMeta = section === "dashboard"
      ? { label: "Dashboard", description: "Your publishing business at a glance." }
      : { label: "Analytics", description: "Explore trends, patterns, and package performance." };
    const viewTabs = views.map(item => `<button class="upa-view-tab ${item.id === view ? "upa-active" : ""}" type="button" role="tab" aria-selected="${item.id === view}" aria-controls="upa-view-${item.id}" data-view="${item.id}">${item.label}</button>`).join("");
    const syncIncomplete = Boolean(syncJob && !syncJob.active && ["months", "daily"].includes(syncJob.phase));
    const syncTitle = syncJob?.active ? syncJob.label : syncJob?.phase === "error" ? "Sync couldn't be completed" : "Sync paused";
    const syncDetail = syncJob?.active
      ? `${syncJob.completed || 0} of ${syncJob.total || "?"} steps complete`
      : syncJob?.phase === "error"
        ? "Try again. If it keeps happening, refresh the Publisher Portal first."
        : "Continue when you're ready. Your progress has been saved.";
    const syncIcon = syncJob?.active
      ? `<div class="upa-sync-icon upa-sync-progress" style="--upa-progress-angle:${progress * 3.6}deg" aria-hidden="true"><span>${progress}%</span></div>`
      : syncJob?.phase === "error"
        ? '<div class="upa-sync-icon upa-sync-error" aria-hidden="true">!</div>'
        : '<div class="upa-sync-icon" aria-hidden="true">Ⅱ</div>';
    const latestCapturedAt = records.reduce((latest, item) => item.capturedAt > latest ? item.capturedAt : latest, "");
    const lastRefreshedAt = syncJob?.lastRefreshedAt || syncJob?.finishedAt || latestCapturedAt;
    const refreshTooltip = `Refresh publisher data · ${lastRefreshedAt ? `Last refreshed ${dateTime(lastRefreshedAt)}` : "Not refreshed yet"}`;
    const showRefreshAction = hasData && !syncJob?.active && syncJob?.phase !== "error" && !syncIncomplete;
    const refreshAction = showRefreshAction ? `<button class="upa-refresh-action ${isRefreshing ? "upa-refreshing" : ""}" type="button" data-action="refresh" aria-label="${escapeHtml(refreshTooltip)}" ${isRefreshing ? "disabled" : ""}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 5.9A5.5 5.5 0 1 0 13 10.7"></path><path d="M13.4 2.8v3.5H9.9"></path></svg><span>${isRefreshing ? "Refreshing…" : "Refresh data"}</span><span class="upa-refresh-tooltip" role="tooltip">${escapeHtml(refreshTooltip)}</span></button>` : "";
    host.classList.toggle("upa-open", isOpen);
    document.documentElement.classList.toggle("upa-dashboard-open", isOpen);
    host.innerHTML = `<button class="upa-fab" aria-label="Open Unity Analytics+" title="Unity Analytics+"><span>A+</span></button><aside class="upa-panel" aria-label="Unity Analytics+ dashboard">
      <div class="upa-shell">
        <aside class="upa-sidebar" aria-label="Analytics workspace">
          <div class="upa-brand"><span>A+</span><div><strong>Analytics+</strong><small>Unity Publisher</small></div></div>
          ${hasData ? `<div class="upa-primary-nav"><small>Workspace</small><button class="${section === "dashboard" ? "upa-active" : ""}" type="button" data-section="dashboard"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="6" height="6" rx="1.5"></rect><rect x="11.5" y="2.5" width="6" height="6" rx="1.5"></rect><rect x="2.5" y="11.5" width="6" height="6" rx="1.5"></rect><rect x="11.5" y="11.5" width="6" height="6" rx="1.5"></rect></svg><span>Dashboard</span></button><button class="${section === "analytics" ? "upa-active" : ""}" type="button" data-section="analytics"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 16.5V11m5 5.5V7m5 9.5V9m4 7.5V3.5"></path><path d="m3 8 5-4 5 2 4-3"></path></svg><span>Analytics</span></button></div>` : `<div class="upa-onboarding-nav"><small>Getting started</small><strong>Build your publisher history</strong><span>One sync brings your available analytics into this workspace.</span></div>`}
          <div class="upa-sidebar-status"><small>${hasData ? "Data coverage" : "Your data"}</small><strong>${hasData ? `${sales.months.length} months` : "Stored locally"}</strong><span>${hasData ? `${daysTracked} complete days tracked` : "Private to this browser"}</span></div>
          ${hasData ? '<div class="upa-sidebar-actions"><button data-action="export">Export data</button><button class="upa-danger" data-action="clear">Clear data</button></div>' : ""}
        </aside>
        <section class="upa-workspace">
          <header class="upa-header ${section === "dashboard" ? "upa-header-compact" : ""}"><div class="upa-header-main"><div><small>Publisher workspace</small><h1>${hasData ? sectionMeta.label : "Welcome"}</h1><div class="upa-header-subline"><p>${hasData ? sectionMeta.description : "Build a complete, configurable view of your publishing business."}</p>${refreshAction}</div></div><button class="upa-icon-button" data-action="close" aria-label="Close analytics">×</button></div>${hasData ? `<nav class="upa-mobile-nav" aria-label="Workspace sections"><button class="${section === "dashboard" ? "upa-active" : ""}" type="button" data-section="dashboard">Dashboard</button><button class="${section === "analytics" ? "upa-active" : ""}" type="button" data-section="analytics">Analytics</button></nav>` : ""}${hasData && section === "analytics" ? `<nav class="upa-view-tabs" role="tablist" aria-label="Analytics views">${viewTabs}</nav>` : ""}</header>
          ${hasData ? `<div class="upa-toolbar"><label>Time range<select id="upa-range"><option value="all" ${prefs.range === "all" ? "selected" : ""}>All available history</option><option value="12" ${prefs.range === "12" ? "selected" : ""}>Last 12 months</option><option value="6" ${prefs.range === "6" ? "selected" : ""}>Last 6 months</option><option value="3" ${prefs.range === "3" ? "selected" : ""}>Last 3 months</option><option value="custom" ${prefs.range === "custom" ? "selected" : ""}>Custom range</option></select></label><div class="upa-date-range"><label>From<input id="upa-start" type="date" value="${dateBounds.start}" min="${availableBounds.start}" max="${availableBounds.end}"></label><span>to</span><label>Until<input id="upa-end" type="date" value="${dateBounds.end}" min="${availableBounds.start}" max="${availableBounds.end}"></label></div>${section === "analytics" && view === "revenue" ? `<label>Interval<select id="upa-interval"><option value="auto" ${prefs.interval === "auto" ? "selected" : ""}>Automatic (${intervalName(interval).toLowerCase()})</option><option value="day" ${prefs.interval === "day" ? "selected" : ""}>Daily</option><option value="week" ${prefs.interval === "week" ? "selected" : ""}>Weekly</option><option value="month" ${prefs.interval === "month" ? "selected" : ""}>Monthly</option><option value="quarter" ${prefs.interval === "quarter" ? "selected" : ""}>Quarterly</option><option value="year" ${prefs.interval === "year" ? "selected" : ""}>Yearly</option></select></label>` : ""}</div>` : ""}
          ${(syncJob?.active || syncJob?.phase === "error" || syncIncomplete) ? `<section class="upa-sync ${syncJob?.active ? "upa-syncing" : ""}">${syncIcon}<div class="upa-sync-copy"><strong>${escapeHtml(syncTitle)}</strong><span>${escapeHtml(syncDetail)}</span>${syncJob?.active ? '<small class="upa-sync-note">Large catalogs can take several minutes. Keep this tab open; if interrupted, progress resumes when you return.</small>' : ""}</div><div class="upa-sync-actions">${syncJob?.active ? '<button data-action="stop-sync">Pause</button>' : syncIncomplete ? '<button data-action="continue-sync">Continue</button>' : '<button data-action="sync-all">Try full sync again</button>'}</div>${syncJob?.active ? `<div class="upa-progress"><i style="width:${progress}%"></i></div>` : ""}</section>` : ""}
          <main class="upa-content" data-section="${section}" data-view="${view}">${records.length ? `<section class="upa-kpis upa-view-panel upa-view-dashboard" id="upa-view-dashboard"><article><div><small>Gross revenue</small><span class="upa-kpi-dot upa-violet"></span></div><strong>${money(revenueChartData.total)}</strong><span>${number(paidUnits)} paid units</span></article><article><div><small>Pageviews</small><span class="upa-kpi-dot upa-cyan"></span></div><strong>${number(pageViews)}</strong><span>${number(salesQty)} purchases and claims</span></article><article><div><small>Downloads</small><span class="upa-kpi-dot upa-amber"></span></div><strong>${number(downloads)}</strong><span>Across the selected period</span></article><article><div><small>Current balance</small><span class="upa-kpi-dot upa-green"></span></div><strong>${money(balance)}</strong><span>${number(daysTracked)} days tracked</span></article><article class="upa-dashboard-chart"><div class="upa-section-title"><div><small>PORTFOLIO PULSE</small><h2>Business activity over time</h2><p>${intervalName(overviewChartData.interval)} revenue, pageviews, and downloads on aligned timelines.</p></div><div class="upa-section-tools"><span>${overviewChartData.points.length} periods</span>${chartActions("overview")}</div></div><div class="upa-pulse-legend"><span><i class="upa-pulse-revenue"></i>Gross revenue</span><span><i class="upa-pulse-views"></i>Pageviews</span><span><i class="upa-pulse-downloads"></i>Downloads</span></div><div id="upa-overview-chart" class="upa-overview-chart" role="img" aria-label="Aligned gross revenue, pageviews, and downloads timelines"></div></article></section>
            <section class="upa-dashboard-grid"><article class="upa-card upa-performance-card upa-view-panel upa-view-revenue" id="upa-view-revenue"><div class="upa-section-title"><div><small>PERFORMANCE</small><h2>Gross revenue over time</h2><p>${intervalName(interval)} totals from ${escapeHtml(dateBounds.start)} to ${escapeHtml(dateBounds.end)}.</p></div><div class="upa-section-tools"><span>${revenueChartData.points.length} periods</span>${chartActions("revenue")}</div></div><div class="upa-chart-summary"><div class="upa-chart-metric"><i></i><span>Gross revenue</span></div><dl><div><dt>Total</dt><dd>${money(revenueChartData.total)}</dd></div><div><dt>Average</dt><dd>${money(revenueChartData.average)}</dd></div><div><dt>Peak</dt><dd>${revenueChartData.peak ? money(revenueChartData.peak[1]) : money(0)}</dd></div></dl></div><div id="upa-revenue-chart" class="upa-revenue-chart" role="img" aria-label="Interactive gross revenue chart"></div><div class="upa-chart-hint"><span>Scroll or pinch to zoom</span><span>Drag to pan</span><span>Use the navigator handles for an exact window</span></div></article>
            <article class="upa-card upa-packages-card upa-view-panel upa-view-packages" id="upa-view-packages"><div class="upa-section-title"><div><small>AUDIENCE &amp; CONVERSION</small><h2>Package performance</h2><p>Top packages ranked by gross sales.</p></div><span>${packages.length} packages</span></div><div class="upa-package-list">${packages.slice(0, 10).map((item, index) => `<div class="upa-package-row"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escapeHtml(item.name)}</strong><span>${number(item.pageViews)} views · ${item.conversion.toFixed(2)}% conversion · ${number(item.downloads)} downloads</span></div><em>${money(item.sales)}</em></div>`).join("")}</div></article></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-calendar" id="upa-view-calendar"><div class="upa-section-title"><div><small>SEASONALITY &amp; OUTLIERS</small><h2>Daily activity calendar</h2><p>Compare daily intensity across years and spot recurring patterns at a glance.</p></div><div class="upa-section-tools"><span>${calendarData.years.length} ${calendarData.years.length === 1 ? "year" : "years"}</span>${chartActions("calendar")}</div></div><div class="upa-insight-toolbar"><label class="upa-inline-select">Show<select id="upa-calendar-metric"><option value="sales" ${prefs.calendarMetric === "sales" ? "selected" : ""}>Gross revenue</option><option value="salesQty" ${prefs.calendarMetric === "salesQty" ? "selected" : ""}>Purchases and claims</option><option value="pageViews" ${prefs.calendarMetric === "pageViews" ? "selected" : ""}>Pageviews</option><option value="downloads" ${prefs.calendarMetric === "downloads" ? "selected" : ""}>Downloads</option></select></label><div class="upa-insight-facts"><span><small>Total</small><strong>${calendarData.metric.currency ? money(calendarData.total) : number(calendarData.total)}</strong></span><span><small>Peak day</small><strong>${calendarData.peak ? escapeHtml(calendarData.peak[0]) : "—"}</strong></span><span><small>Peak value</small><strong>${calendarData.peak ? (calendarData.metric.currency ? money(calendarData.peak[1]) : number(calendarData.peak[1])) : "—"}</strong></span></div></div><div id="upa-calendar-chart" class="upa-calendar-chart" role="img" aria-label="Calendar heatmap with one row per year"></div><div class="upa-chart-hint"><span>Each row is one year</span><span>Darker days are higher</span><span>The color scale softens extreme outliers so everyday patterns stay visible</span></div></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-sankey" id="upa-view-sankey"><div class="upa-section-title"><div><small>REVENUE COMPOSITION</small><h2>Where revenue comes from</h2><p>Follow gross revenue from packages through their price tiers.</p></div><div class="upa-section-tools"><span>${sankeyData.activePackages.length} shown</span>${chartActions("sankey")}</div></div><div class="upa-insight-toolbar upa-sankey-toolbar"><details class="upa-package-filter"><summary><span>Packages</span><strong>${sankeyData.explicitKeys.length ? `${sankeyData.explicitKeys.length} selected` : "Top 8 by revenue"}</strong></summary><div class="upa-package-filter-panel"><div class="upa-package-filter-head"><span>Choose packages to compare</span><button data-action="sankey-top">Use top 8</button></div><div class="upa-package-checklist">${sankeyData.options.map(item => `<label><input type="checkbox" data-sankey-package="${escapeHtml(item.key)}" ${sankeyData.activePackages.some(active => active.key === item.key) ? "checked" : ""}><span><strong>${escapeHtml(item.name)}</strong><small>${money(item.gross)}</small></span></label>`).join("")}</div></div></details><div class="upa-insight-facts"><span><small>Revenue shown</small><strong>${money(sankeyData.total)}</strong></span><span><small>Price tiers</small><strong>${number(sankeyData.tiers)}</strong></span><span><small>Packages</small><strong>${number(sankeyData.activePackages.length)}</strong></span></div></div><div id="upa-sankey-chart" class="upa-sankey-chart" style="height:${sankeyHeight}px" role="img" aria-label="Sankey diagram of package revenue through price tiers"></div><div class="upa-chart-hint"><span>Hover to isolate a flow</span><span>Drag nodes to arrange the view</span><span>Shows revenue composition, not individual customer journeys</span></div></section>` : `<section class="upa-welcome"><div class="upa-welcome-copy"><small>YOUR COMPLETE PICTURE</small><h2>Go beyond the<br>one-year window.</h2><p>Bring your available sales, downloads, revenue, pageviews, and conversion history into one configurable workspace.</p>${syncJob?.active ? '<div class="upa-welcome-running"><i></i><span>Your history is being prepared. You can leave this page open and follow the progress above.</span></div>' : '<button class="upa-primary upa-large" data-action="sync-all">Sync full history</button>'}</div><div class="upa-welcome-visual" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span>Lifetime</span></div></section>`}</main>
        </section>
      </div>
      <div class="upa-toast" role="status" aria-live="polite"></div>
    </aside>`;
    if (hasData && isOpen) {
      if (section === "dashboard") renderOverviewChart(overviewChartData);
      if (section === "analytics" && view === "revenue") renderRevenueChart(revenueChartData);
      if (section === "analytics" && view === "calendar") renderCalendarChart(calendarData);
      if (section === "analytics" && view === "sankey") renderSankeyChart(sankeyData);
    }
  }

  function scheduleRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } }
  function toast(message, type = "success") { const node = document.querySelector("#upa-root .upa-toast"); if (!node) return; node.textContent = message; node.dataset.type = type; node.classList.add("upa-show"); setTimeout(() => node.classList.remove("upa-show"), 3600); }
  function download(name, contents) { const url = URL.createObjectURL(new Blob([contents], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  function bindEvents() {
    document.addEventListener("click", async event => {
      if (!event.target.closest("#upa-root")) return;
      const chartButton = event.target.closest("[data-chart-action]");
      if (chartButton) { await handleChartAction(chartButton.dataset.chartAction, chartButton.dataset.chart); return; }
      const sectionButton = event.target.closest("button[data-section]");
      if (sectionButton) { prefs.section = sectionButton.dataset.section; await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render(); return; }
      const viewButton = event.target.closest("button[data-view]");
      if (viewButton) { prefs.section = "analytics"; prefs.view = viewButton.dataset.view; await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render(); return; }
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (event.target.closest(".upa-fab")) { isOpen = true; render(); return; }
      if (action === "close") { isOpen = false; render(); }
      if (action === "sync-all") await startFullSync();
      if (action === "refresh") await incrementalSync(true);
      if (action === "stop-sync") { syncJob.active = false; syncJob.label = "Sync paused"; await saveJob(); render(); }
      if (action === "continue-sync") { syncJob.active = true; await saveJob(); render(); await runFullSync(); }
      if (action === "sankey-top") { prefs.sankeyPackages = []; await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render(); }
      if (action === "export") download(`unity-publisher-analytics-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2));
      if (action === "clear" && window.confirm("Clear all locally synced publisher data? This can't be undone.")) { await database({ type: "UPA_DB_CLEAR" }); records = []; syncJob = null; render(); }
    });
    document.addEventListener("change", async event => {
      if (event.target.id === "upa-range") {
        const currentBounds = selectedDateBounds(); prefs.range = event.target.value;
        if (prefs.range === "custom") { prefs.start = currentBounds.start; prefs.end = currentBounds.end; }
        await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render();
      }
      if (event.target.id === "upa-start" || event.target.id === "upa-end") {
        prefs.range = "custom"; prefs[event.target.id === "upa-start" ? "start" : "end"] = event.target.value;
        await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render();
      }
      if (event.target.id === "upa-interval") { prefs.interval = event.target.value; await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render(); }
      if (event.target.id === "upa-calendar-metric") { prefs.calendarMetric = event.target.value; await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render(); }
      if (event.target.matches("[data-sankey-package]")) {
        prefs.sankeyPackages = [...document.querySelectorAll("#upa-root [data-sankey-package]:checked")].map(input => input.dataset.sankeyPackage);
        await chrome.storage.local.set({ [PREFS_KEY]: prefs }); render(); requestAnimationFrame(() => { const filter = document.querySelector("#upa-root .upa-package-filter"); if (filter) filter.open = true; });
      }
    });
    chrome.runtime.onMessage.addListener(message => { if (message?.type === "UPA_TOGGLE") { isOpen = !isOpen; render(); } });
  }

  async function init() {
    const stored = await chrome.storage.local.get(PREFS_KEY);
    const storedPrefs = stored[PREFS_KEY] || {}, analyticsViews = ["revenue", "calendar", "sankey", "packages"];
    prefs = {
      section: storedPrefs.section || (storedPrefs.view && storedPrefs.view !== "overview" ? "analytics" : "dashboard"),
      view: analyticsViews.includes(storedPrefs.view) ? storedPrefs.view : "revenue", range: storedPrefs.range || "all", interval: storedPrefs.interval || "auto", start: storedPrefs.start || "", end: storedPrefs.end || "",
      calendarMetric: storedPrefs.calendarMetric || "sales", sankeyPackages: Array.isArray(storedPrefs.sankeyPackages) ? storedPrefs.sankeyPackages : []
    };
    await chrome.storage.local.set({ [PREFS_KEY]: prefs });
    records = await getAll(); syncJob = await getMeta(SYNC_KEY); isOpen = Boolean(syncJob?.active);
    const root = document.createElement("div"); root.id = "upa-root"; document.body.appendChild(root); bindEvents(); render();
    if (syncJob?.active) runFullSync(); else if (records.length) incrementalSync();
  }

  init().catch(error => console.error("Unity Publisher Analytics+ failed to initialize:", error));
})();
