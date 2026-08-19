(() => {
  "use strict";
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  if (window.__unityPublisherAnalyticsLoaded) return;
  window.__unityPublisherAnalyticsLoaded = true;

  const PREFS_KEY_PREFIX = "unityPublisherAnalyticsPrefsV2";
  const PUBLISHER_KEY_PREFIX = "unityPublisherAnalyticsPublisherV2";
  const GROUPS_KEY_PREFIX = "unityPublisherAnalyticsPackageGroupsV1";
  const SYNC_KEY = "apiSyncV1";
  const DAILY_API_MIN_DATE = "2019-01-01";
  const DAILY_API_WINDOW_DAYS = 365;
  const RANGE_OPTIONS = [
    { id: "all", label: "All time" }, { id: "7d", label: "Last 7 days" }, { id: "30d", label: "Last 30 days" }, { id: "3", label: "Last 3 months" },
    { id: "6", label: "Last 6 months" }, { id: "12", label: "Last 1 year" }, { id: "36", label: "Last 3 years" }, { id: "60", label: "Last 5 years" },
    { id: "mtd", label: "Month to date" }, { id: "ytd", label: "Year to date" }
  ];
  const API = {
    user: "/publisher-v2-api/user",
    packages: "/publisher-v2-api/proxy?path=%2Fmanagement%2Fonce-published-packages&type=array",
    categories: "/publisher-v2-api/proxy?path=%2Fmanagement%2Fcategories&type=array",
    packageMetadata: "/publisher-v2-api/management/packages",
    sales: month => `/publisher-v2-api/monthly-sales?date=${month}-01`,
    downloads: month => `/publisher-v2-api/monthly-downloads?date=${month}-01`,
    revenue: "/publisher-v2-api/publisher-revenues",
    daily: "/publisher-v2-api/dashboard/daily"
  };
  let records = [];
  let prefs = { section: "dashboard", view: "revenue", range: "all", interval: "auto", start: "", end: "", theme: "system", performanceScopes: [{ type: "all", id: "all" }], performanceHiddenScopes: [], calendarMetric: "sales", lifetimeMetric: "revenue", lifetimeStyle: "area", lifetimeAlign: "calendar", lifetimeStackDefaultApplied: true, lifetimePackages: [], lifetimeHiddenPackages: [], sankeyPackages: [], sankeyGroupBy: "category", sankeyCategoryDefaultApplied: true };
  let packageGroups = [];
  let groupEditor = null;
  let syncJob = null;
  let isRefreshing = false;
  let isOpen = false;
  let accountMenuOpen = false;
  let publisherIdentity = { id: "", organizationId: "", portalLabel: "", name: "Publisher", icon: "" };
  let publisherIdentityState = "loading";
  let workspaceGeneration = 0;
  let identityRefreshInFlight = false;
  let renderQueued = false;
  let isRangePopoverOpen = false;
  let isCustomRangeEditorOpen = false;
  let isPerformanceScopeMenuOpen = false;
  const chartInstances = new Map();
  const chartResizeObservers = new Map();
  const chartShareMetadata = new Map();
  const pendingApiRequests = new Map();
  const systemDarkTheme = matchMedia("(prefers-color-scheme: dark)");

  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const compact = value => String(value ?? "").trim().replace(/\s+/g, " ");
  const displayText = value => {
    const text = compact(value);
    if (!/%[0-9a-f]{2}/i.test(text)) return text;
    try { return compact(decodeURIComponent(text)); } catch { return text; }
  };
  const keyOf = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
  const number = value => new Intl.NumberFormat().format(Number(value) || 0);
  const money = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const metricValue = (metric, value) => metric.currency ? money(value) : number(value);
  const publisherStorageKey = (prefix, publisherId = publisherIdentity.id) => `${prefix}:${encodeURIComponent(publisherId)}`;
  const darkThemeActive = () => prefs.theme === "dark" || (prefs.theme === "system" && systemDarkTheme.matches);
  const chartTheme = () => darkThemeActive() ? {
    axis: "#98a5ba", axisLine: "#3b475b", grid: "#2c3749", zoom: "#273246", zoomLine: "#66738a", zoomArea: "#3a475d", handle: "#e6ebf3",
    pieBorder: "#1c2636", calendarSplit: "#1c2636", calendarEmpty: "#263246", calendarYear: "#dbe2ee", calendarMonth: "#9ca7b9", calendarDay: "#7d899e",
    calendarScale: "#263246", calendarScaleBorder: "#3a465a", calendarRange: ["#302d55", "#443b78", "#5b4db3", "#7565df", "#a496ff"], sankeyLabel: "#dbe2ee"
  } : {
    axis: "#81899b", axisLine: "#dfe2e9", grid: "#eceef3", zoom: "#f0f1f5", zoomLine: "#aaa2ec", zoomArea: "#ddd9fa", handle: "#fff",
    pieBorder: "#fff", calendarSplit: "#fff", calendarEmpty: "#f3f4f7", calendarYear: "#434b5d", calendarMonth: "#858da0", calendarDay: "#a0a6b5",
    calendarScale: "#f7f7fa", calendarScaleBorder: "#ebeaf1", calendarRange: ["#f1f0f8", "#d9d4f6", "#a99def", "#6c5ce7", "#372c83"], sankeyLabel: "#343b4d"
  };

  function publisherFromHeader() {
    const button = [...document.querySelectorAll("button")].find(item => /User menu/i.test(item.getAttribute("aria-label") || "")) || document.querySelector('nav[aria-label="User"] button:last-of-type');
    if (!button) return null;
    const lines = String(button.innerText || "").split(/\n+/).map(compact).filter(Boolean);
    const labelParts = (button.getAttribute("aria-label") || "").split(",").map(compact).filter(Boolean);
    const portalLabel = lines.at(-1) || labelParts.at(-2) || "";
    const username = lines.at(-2) || labelParts[0] || "";
    return { portalLabel, username, name: portalLabel.replace(/\s+Publisher$/i, "") || username || "Publisher" };
  }

  function profileValue(doc, labelText) {
    const label = [...doc.querySelectorAll("div, span, p")].find(item => !item.children.length && compact(item.textContent) === labelText);
    if (!label) return "";
    let node = label.parentElement;
    while (node && node !== doc.body) {
      const text = compact(node.innerText);
      if (text.startsWith(labelText) && text.length > labelText.length && text.length < 180) return compact(text.slice(labelText.length));
      node = node.parentElement;
    }
    return "";
  }

  function publisherFromProfile(doc) {
    const image = doc.querySelector('img[alt="Profile picture"]');
    const name = profileValue(doc, "Profile name"), icon = image?.currentSrc || image?.src || "";
    return name || icon ? { name, icon } : null;
  }

  async function loadPublisherProfile() {
    if (location.pathname === "/account/profile") {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const profile = publisherFromProfile(document); if (profile) return profile;
        await sleep(200);
      }
      return null;
    }
    const frame = document.createElement("iframe");
    frame.className = "upa-profile-frame"; frame.src = "/account/profile"; frame.tabIndex = -1; frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await sleep(200);
        try { const profile = frame.contentDocument && publisherFromProfile(frame.contentDocument); if (profile) return profile; } catch { return null; }
      }
      return null;
    } finally { frame.remove(); }
  }

  async function fetchPublisherIdentity(force = false) {
    const user = await apiJson(API.user);
    const id = compact(user?.publisherId);
    if (!id) throw new Error("The active Publisher Portal account did not provide a publisher identity.");
    const header = publisherFromHeader();
    const key = publisherStorageKey(PUBLISHER_KEY_PREFIX, id);
    const stored = await extensionApi.storage.local.get(key), cached = stored[key];
    const fresh = !force && cached?.id === id && Date.now() - Number(cached.updatedAt || 0) < 86400000;
    if (fresh) return { ...cached, portalLabel: displayText(cached.portalLabel), name: displayText(cached.name) };
    const apiIcon = typeof user.avatar === "string" ? user.avatar : "";
    const apiName = displayText(user.publisherName || user.publisherOrgName);
    const profile = apiIcon && apiName ? null : await loadPublisherProfile();
    const identity = {
      id,
      organizationId: compact(user.publisherOrgId || user.defaultOrgId),
      portalLabel: displayText(header?.portalLabel),
      name: apiName || displayText(profile?.name) || displayText(header?.name) || "Publisher",
      icon: apiIcon || profile?.icon || "",
      updatedAt: Date.now()
    };
    await extensionApi.storage.local.set({ [key]: identity });
    return identity;
  }
  const LIFETIME_METRICS = {
    revenue: { id: "revenue", label: "Gross revenue", noun: "revenue", rankingLabel: "revenue", field: "gross", source: "sales", currency: true, ageLabel: "Since first sale", ageDescription: "first sale", emptyLabel: "No package revenue is available yet." },
    sales: { id: "sales", label: "Sales quantity", noun: "sales", rankingLabel: "sales", field: "qty", source: "sales", currency: false, ageLabel: "Since first sale", ageDescription: "first sale", emptyLabel: "No package sales are available yet." },
    downloads: { id: "downloads", label: "Downloads", noun: "downloads", rankingLabel: "downloads", field: "downloads", source: "downloads", currency: false, ageLabel: "Since first download", ageDescription: "first download", emptyLabel: "No package downloads are available yet." },
    pageviews: { id: "pageviews", label: "Pageviews", noun: "pageviews", rankingLabel: "pageviews", field: "pageViews", source: "daily", currency: false, ageLabel: "Since first pageview", ageDescription: "first pageview", emptyLabel: "No package pageviews are available yet." }
  };
  const PERFORMANCE_METRICS = [
    { id: "revenue", label: "Gross revenue", eyebrow: "EARNINGS", field: "sales", currency: true, accent: "#6c5ce7", emptyLabel: "No gross revenue is available for this selection." },
    { id: "sales", label: "Purchases and claims", eyebrow: "ACQUISITIONS", field: "salesQty", currency: false, accent: "#3ca56f", emptyLabel: "No purchases or claims are available for this selection." },
    { id: "pageviews", label: "Pageviews", eyebrow: "ATTENTION", field: "pageViews", currency: false, accent: "#21a7bd", emptyLabel: "No pageviews are available for this selection." },
    { id: "downloads", label: "Downloads", eyebrow: "USAGE", field: "downloads", currency: false, accent: "#d99721", emptyLabel: "No downloads are available for this selection." }
  ];
  const lifetimeMetricDefinition = id => LIFETIME_METRICS[id] || LIFETIME_METRICS.revenue;
  const lifetimeValue = (metric, value) => metric.currency ? money(value) : number(value);
  const percent = value => `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}%`;
  const dateTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Refresh time unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const shortDate = value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
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

  function packageCategory(item) {
    const raw = valueFrom(item, ["category", "category_name", "categoryName", "asset_category", "assetCategory"]);
    if (Array.isArray(raw)) return compact(raw.map(value => typeof value === "object" ? valueFrom(value, ["name", "title", "label"]) : value).filter(Boolean).at(-1));
    if (raw && typeof raw === "object") return compact(valueFrom(raw, ["name", "title", "label"]));
    return compact(raw);
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

  function addYears(dateString, count) {
    const date = new Date(`${dateString}T00:00:00.000Z`), month = date.getUTCMonth(), day = date.getUTCDate();
    date.setUTCDate(1); date.setUTCFullYear(date.getUTCFullYear() + count);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
    date.setUTCMonth(month, Math.min(day, lastDay)); return date.toISOString().slice(0, 10);
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
    return `${record.publisherId}|${record.type}|${hash([record.publisherId, record.type, record.date, record.period, record.packageId, record.package, record.price, record.description, record.scope].join("|"))}`;
  }

  function normalize(record, publisherId) {
    const ownedRecord = { ...record, publisherId };
    return { ...ownedRecord, id: recordId(ownedRecord), source: "publisher-api", capturedAt: new Date().toISOString() };
  }

  async function database(message) {
    const response = await extensionApi.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "The local analytics database is unavailable.");
    return response.result;
  }

  const getAll = (publisherId = publisherIdentity.id) => database({ type: "UPA_DB_GET_ALL", publisherId });
  const putMany = (rows, publisherId = publisherIdentity.id) => rows.length ? database({ type: "UPA_DB_PUT_MANY", publisherId, records: rows }) : Promise.resolve(0);
  const getMeta = (key, publisherId = publisherIdentity.id) => database({ type: "UPA_DB_GET_META", publisherId, key });
  const setMeta = (key, value, publisherId = publisherIdentity.id) => database({ type: "UPA_DB_SET_META", publisherId, key, value });
  const clearPublisherData = (publisherId = publisherIdentity.id) => database({ type: "UPA_DB_CLEAR", publisherId });

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

  function categoryReference(item) {
    const raw = valueFrom(item, ["category_id", "categoryId", "category"]);
    if (raw === "" || raw === null || raw === undefined) return null;
    if (typeof raw === "object") {
      const id = String(valueFrom(raw, ["id", "category_id", "categoryId"]) || ""), name = compact(valueFrom(raw, ["assetstore_name", "assetstoreName", "name", "title", "label"]));
      return id || name ? { id: id || name, name } : null;
    }
    const value = compact(raw);
    return value ? { id: value, name: value } : null;
  }

  async function fetchPackageCategoryMetadata() {
    const categoriesByIdentifier = new Map(), categoriesByName = new Map(), limit = 200;
    let offset = 0;
    while (true) {
      const body = { limit: String(limit), order_by: "name", order: "asc" };
      if (offset) body.offset = String(offset);
      const response = await apiJson(API.packageMetadata, { method: "POST", body });
      const rows = valueFrom(response, ["package_versions", "packageVersions"]);
      if (!Array.isArray(rows) || !rows.length) break;
      for (const item of rows) {
        const category = categoryReference(item);
        if (!category) continue;
        for (const identifier of [valueFrom(item, ["package_id", "packageId"]), valueFrom(item, ["genesis_product_id", "genesisProductId", "product_id", "productId"]), valueFrom(item, ["id"])]) {
          if (identifier !== "" && identifier !== null && identifier !== undefined) categoriesByIdentifier.set(String(identifier), category);
        }
        const name = compact(valueFrom(item, ["name", "package_name", "packageName"])).toLocaleLowerCase();
        if (name) categoriesByName.set(name, category);
      }
      offset += rows.length;
      const total = toNumber(valueFrom(response, ["total"]));
      if (rows.length < limit || (total && offset >= total)) break;
    }
    return { categoriesByIdentifier, categoriesByName };
  }

  async function fetchPackages() {
    const [raw, categoryRows, metadata] = await Promise.all([apiJson(API.packages), apiJson(API.categories), fetchPackageCategoryMetadata()]);
    const categories = new Map((Array.isArray(categoryRows) ? categoryRows : []).map(item => [String(valueFrom(item, ["id", "category_id", "categoryId"]) || ""), compact(valueFrom(item, ["assetstore_name", "assetstoreName", "name", "title", "category_name", "categoryName"]))]).filter(([id, name]) => id && name));
    return (Array.isArray(raw) ? raw : []).map(item => {
      const id = String(valueFrom(item, ["package_id", "packageId", "id"]) || "");
      const name = valueFrom(item, ["name", "title", "package_name"]) || `Package ${id}`;
      const metadataCategory = metadata.categoriesByIdentifier.get(id) || metadata.categoriesByName.get(compact(name).toLocaleLowerCase());
      const categoryId = String(valueFrom(item, ["category_id", "categoryId"]) || metadataCategory?.id || "");
      return { id, name, categoryId, category: categories.get(categoryId) || packageCategory(item) || metadataCategory?.name || "", firstPublished: parseDate(valueFrom(item, ["first_published_at", "first_published_time", "firstPublishedTime", "first_published"])) };
    }).filter(item => item.id);
  }

  function normalizeSales(raw, period, publisherId) {
    return (Array.isArray(raw) ? raw : []).map(item => normalize({
      type: "sales", period, date: `${period}-01`, packageId: String(valueFrom(item, ["package_id", "packageId"]) || ""), package: valueFrom(item, ["name", "package_name"]), category: packageCategory(item),
      price: toNumber(item.price), qty: toNumber(valueFrom(item, ["sales", "quantity"])), refunds: toNumber(item.refunds), chargebacks: toNumber(item.chargebacks),
      gross: toNumber(item.gross), net: toNumber(item.revenue), first: parseDate(item.first), last: parseDate(item.last), currency: "USD"
    }, publisherId));
  }

  function normalizeDownloads(raw, period, publisherId) {
    return (Array.isArray(raw) ? raw : []).map(item => {
      const data = item.downloads || {};
      const freeDownloads = toNumber(valueFrom(data, ["free_downloads", "freeDownloads"])), entitledDownloads = toNumber(valueFrom(data, ["entitled_downloads", "entitledDownloads"]));
      const freeUsers = toNumber(valueFrom(data, ["free_users", "freeUsers"])), entitledUsers = toNumber(valueFrom(data, ["entitled_users", "entitledUsers"]));
      return normalize({ type: "downloads", period, date: `${period}-01`, packageId: String(valueFrom(item, ["package_id", "packageId"]) || ""), package: item.name, category: packageCategory(item),
        downloads: freeDownloads + entitledDownloads, users: freeUsers + entitledUsers, freeDownloads, freeUsers, entitledDownloads, entitledUsers,
        freeFirst: parseDate(valueFrom(data, ["free_first", "freeFirst"])), freeLast: parseDate(valueFrom(data, ["free_last", "freeLast"])),
        entitledFirst: parseDate(valueFrom(data, ["entitled_first", "entitledFirst"])), entitledLast: parseDate(valueFrom(data, ["entitled_last", "entitledLast"])) }, publisherId);
    });
  }

  function normalizeRevenue(raw, publisherId) {
    return (Array.isArray(raw) ? raw : []).map(item => {
      const date = parseDate(item.date);
      return normalize({ type: "revenue", period: date?.slice(0, 7), date, description: item.description, debit: toNumber(item.debit), credit: toNumber(item.credit), balance: toNumber(item.balance), currency: "USD" }, publisherId);
    }).filter(item => item.date);
  }

  function normalizeDaily(raw, scope, publisherId) {
    const result = [];
    for (const [dateKey, metrics] of Object.entries(raw || {})) {
      if (!metrics || typeof metrics !== "object") continue;
      const date = parseDate(dateKey); if (!date) continue;
      const pageViews = toNumber(valueFrom(metrics, ["page_views", "pageViews"]));
      const paidQty = toNumber(valueFrom(metrics, ["sales", "paid_sales", "paidSales"]));
      const freeQty = toNumber(valueFrom(metrics, ["free_obtained", "freeObtained"]));
      const salesQty = paidQty + freeQty;
      result.push(normalize({ type: "daily", period: date.slice(0, 7), date, scope: scope.id ? "package" : "all", packageId: scope.id, package: scope.name, category: scope.category || "",
        sales: toNumber(valueFrom(metrics, ["gross"])), salesQty, paidQty, freeQty, pageViews, conversionRate: Math.min(1, salesQty / (pageViews || 1)) * 100,
        downloads: toNumber(metrics.downloads), wishlisted: toNumber(metrics.wishlisted), refunds: toNumber(metrics.refunds), ratingAvg: toNumber(valueFrom(metrics, ["rating", "ratingAvg"])),
        quickLooks: toNumber(valueFrom(metrics, ["quick_looks", "quickLooks"])), carted: toNumber(metrics.carted), currency: "USD" }, publisherId));
    }
    return result;
  }

  function earliestAccountDate(packages, revenue) {
    const dates = [...packages.map(item => item.firstPublished), ...revenue.map(item => item.date)].filter(Boolean).sort();
    if (!dates.length) throw new Error("The Publisher API did not return an account start date.");
    return [dates[0], DAILY_API_MIN_DATE].sort().at(-1);
  }

  function sanitizedPreferences(storedPrefs = {}) {
    const analyticsViews = ["revenue", "lifetime", "calendar", "sankey", "packages"], ranges = ["all", "7d", "30d", "3", "6", "12", "36", "60", "mtd", "ytd", "custom"];
    const storedSankeyGroupBy = ["none", "category"].includes(storedPrefs.sankeyGroupBy) ? storedPrefs.sankeyGroupBy : "category";
    const storedLifetimeAlign = storedPrefs.lifetimeAlign === "age" ? "age" : "calendar";
    const storedLifetimeStyle = storedPrefs.lifetimeStyle === "area" && storedLifetimeAlign === "calendar" ? "area" : "lines";
    const lifetimeStyle = storedPrefs.lifetimeStackDefaultApplied === true ? storedLifetimeStyle : "area";
    return {
      section: ["dashboard", "analytics", "groups", "settings"].includes(storedPrefs.section) ? storedPrefs.section : (storedPrefs.view && storedPrefs.view !== "overview" ? "analytics" : "dashboard"),
      view: analyticsViews.includes(storedPrefs.view) ? storedPrefs.view : "revenue", range: ranges.includes(storedPrefs.range) ? storedPrefs.range : "all", interval: storedPrefs.interval || "auto", start: storedPrefs.start || "", end: storedPrefs.end || "", theme: ["system", "light", "dark"].includes(storedPrefs.theme) ? storedPrefs.theme : "system",
      performanceScopes: sanitizedPerformanceScopes(storedPrefs.performanceScopes), performanceHiddenScopes: Array.isArray(storedPrefs.performanceHiddenScopes) ? [...new Set(storedPrefs.performanceHiddenScopes.map(String).filter(Boolean))] : [], calendarMetric: storedPrefs.calendarMetric || "sales", lifetimeMetric: LIFETIME_METRICS[storedPrefs.lifetimeMetric] ? storedPrefs.lifetimeMetric : "revenue", lifetimeStyle, lifetimeAlign: lifetimeStyle === "area" ? "calendar" : storedLifetimeAlign, lifetimeStackDefaultApplied: true, lifetimePackages: Array.isArray(storedPrefs.lifetimePackages) ? storedPrefs.lifetimePackages : [], lifetimeHiddenPackages: Array.isArray(storedPrefs.lifetimeHiddenPackages) ? storedPrefs.lifetimeHiddenPackages : [], sankeyPackages: Array.isArray(storedPrefs.sankeyPackages) ? storedPrefs.sankeyPackages : [], sankeyGroupBy: storedPrefs.sankeyCategoryDefaultApplied === true ? storedSankeyGroupBy : "category", sankeyCategoryDefaultApplied: true
    };
  }

  function sanitizedPerformanceScopes(value) {
    if (!Array.isArray(value)) return [{ type: "all", id: "all" }];
    const seen = new Set(), scopes = [];
    for (const item of value) {
      const type = item?.type, id = type === "all" ? "all" : compact(item?.id), key = `${type}:${id}`;
      if (!["all", "group", "asset"].includes(type) || !id || seen.has(key)) continue;
      seen.add(key); scopes.push({ type, id });
    }
    return scopes.length ? scopes : [{ type: "all", id: "all" }];
  }

  function sanitizedPackageGroups(value) {
    if (!Array.isArray(value)) return [];
    const ids = new Set(), names = new Set(), memberships = new Set(), groups = [];
    for (const item of value) {
      const id = compact(item?.id), name = compact(item?.name).slice(0, 40), normalizedName = name.toLocaleLowerCase();
      const packageIds = [...new Set((Array.isArray(item?.packageIds) ? item.packageIds : []).map(value => compact(value)).filter(Boolean))];
      const membership = [...packageIds].sort().join("\u0000");
      if (!id || ["all", "custom"].includes(id) || !name || !packageIds.length || ids.has(id) || names.has(normalizedName) || memberships.has(membership) || normalizedName === "all assets") continue;
      ids.add(id); names.add(normalizedName); memberships.add(membership);
      groups.push({ id, name, packageIds, createdAt: item.createdAt || new Date().toISOString(), updatedAt: item.updatedAt || item.createdAt || new Date().toISOString() });
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  async function savePrefs() {
    if (!publisherIdentity.id) return;
    await extensionApi.storage.local.set({ [publisherStorageKey(PREFS_KEY_PREFIX)]: prefs });
  }

  async function savePackageGroups() {
    if (!publisherIdentity.id) return;
    packageGroups = sanitizedPackageGroups(packageGroups);
    await extensionApi.storage.local.set({ [publisherStorageKey(GROUPS_KEY_PREFIX)]: packageGroups });
  }

  function ownsWorkspace(publisherId, generation) {
    return publisherIdentity.id === publisherId && workspaceGeneration === generation;
  }

  async function activatePublisher(identity, { initial = false, resume = true } = {}) {
    workspaceGeneration += 1;
    const generation = workspaceGeneration;
    publisherIdentity = identity;
    publisherIdentityState = "loading";
    records = [];
    syncJob = null;
    packageGroups = [];
    groupEditor = null;
    isPerformanceScopeMenuOpen = false;
    isRefreshing = false;
    render();
    const preferencesKey = publisherStorageKey(PREFS_KEY_PREFIX, identity.id), groupsKey = publisherStorageKey(GROUPS_KEY_PREFIX, identity.id);
    const stored = await extensionApi.storage.local.get([preferencesKey, groupsKey]);
    if (!ownsWorkspace(identity.id, generation)) return;
    prefs = sanitizedPreferences(stored[preferencesKey] || {});
    packageGroups = sanitizedPackageGroups(stored[groupsKey] || []);
    prefs.performanceScopes = sanitizedPerformanceScopes(prefs.performanceScopes).filter(scope => scope.type !== "group" || packageGroups.some(group => group.id === scope.id));
    if (!prefs.performanceScopes.length) prefs.performanceScopes = [{ type: "all", id: "all" }];
    await extensionApi.storage.local.set({ [preferencesKey]: prefs });
    const [publisherRecords, publisherJob] = await Promise.all([getAll(identity.id), getMeta(SYNC_KEY, identity.id)]);
    if (!ownsWorkspace(identity.id, generation)) return;
    records = publisherRecords;
    syncJob = publisherJob;
    publisherIdentityState = "ready";
    if (initial && syncJob?.active) isOpen = true;
    render();
    if (!resume) return;
    if (syncJob?.active) runFullSync(identity.id, generation);
    else if (records.length) incrementalSync(false, identity.id, generation);
  }

  async function verifyPublisherWorkspace(publisherId, generation) {
    const identity = await fetchPublisherIdentity();
    if (identity.id !== publisherId) {
      if (identity.id !== publisherIdentity.id || publisherIdentityState !== "ready") await activatePublisher(identity);
      throw new Error("The active publisher changed while data was being synced.");
    }
    if (!ownsWorkspace(publisherId, generation)) throw new Error("The publisher workspace changed while data was being synced.");
    publisherIdentity = identity;
  }

  async function saveJob(job = syncJob, publisherId = publisherIdentity.id) { await setMeta(SYNC_KEY, job, publisherId); }

  async function prepareFullSync(publisherId, generation) {
    const [packages, revenueRaw] = await Promise.all([fetchPackages(), apiJson(API.revenue)]);
    await verifyPublisherWorkspace(publisherId, generation);
    const revenue = normalizeRevenue(revenueRaw, publisherId); await putMany(revenue, publisherId);
    if (!ownsWorkspace(publisherId, generation)) return;
    const start = earliestAccountDate(packages, revenue), endInclusive = latestCompleteDailyDate(), months = monthSequence(start, new Date().toISOString().slice(0, 10));
    const scopes = [{ id: null, name: "All assets" }, ...packages];
    const chunksPerScope = Math.max(1, Math.ceil((new Date(`${addDays(endInclusive, 1)}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000 / DAILY_API_WINDOW_DAYS));
    syncJob = { publisherId, active: true, phase: "months", startedAt: new Date().toISOString(), packages, start, endExclusive: addDays(endInclusive, 1), months, monthIndex: 0,
      scopes, scopeIndex: 0, cursor: start, completed: 1, total: 1 + months.length * 2 + scopes.length * chunksPerScope, label: "Getting your history ready" };
    await saveJob(syncJob, publisherId); render();
  }

  async function runFullSync(publisherId = publisherIdentity.id, generation = workspaceGeneration) {
    try {
      if (!ownsWorkspace(publisherId, generation)) return;
      if (!syncJob?.active || !syncJob.phase || syncJob.phase === "preparing") await prepareFullSync(publisherId, generation);
      if (!ownsWorkspace(publisherId, generation)) return;
      const job = syncJob;
      if (job.publisherId !== publisherId) throw new Error("The saved sync does not belong to this publisher.");
      if (job.phase === "months") {
        while (job.active && ownsWorkspace(publisherId, generation) && job.monthIndex < job.months.length) {
          const month = job.months[job.monthIndex]; job.label = `Syncing sales and downloads · ${month}`; render();
          const [salesRaw, downloadsRaw] = await Promise.all([apiJson(API.sales(month)), apiJson(API.downloads(month))]);
          await verifyPublisherWorkspace(publisherId, generation);
          await putMany([...normalizeSales(salesRaw, month, publisherId), ...normalizeDownloads(downloadsRaw, month, publisherId)], publisherId);
          job.monthIndex += 1; job.completed += 2; await saveJob(job, publisherId); render(); await sleep(80);
        }
        if (!job.active || !ownsWorkspace(publisherId, generation)) return;
        job.phase = "daily"; await saveJob(job, publisherId);
      }
      if (job.phase === "daily") {
        while (job.active && ownsWorkspace(publisherId, generation) && job.scopeIndex < job.scopes.length) {
          const scope = job.scopes[job.scopeIndex];
          while (job.active && ownsWorkspace(publisherId, generation) && job.cursor < job.endExclusive) {
            const chunkEnd = [addDays(job.cursor, DAILY_API_WINDOW_DAYS), job.endExclusive].sort()[0];
            job.label = `Syncing daily performance · ${scope.name} · ${job.cursor}–${addDays(chunkEnd, -1)}`; render();
            let raw;
            try { raw = await apiJson(API.daily, { method: "POST", body: { start_date: apiTimestamp(job.cursor), end_date: apiTimestamp(chunkEnd), package_ids: scope.id ? [scope.id] : [] } }); }
            catch (error) { throw new Error(`${error.message} Range ${job.cursor}–${addDays(chunkEnd, -1)}, scope ${scope.name}.`); }
            await verifyPublisherWorkspace(publisherId, generation);
            await putMany(normalizeDaily(raw, scope, publisherId), publisherId);
            job.cursor = chunkEnd; job.completed += 1; await saveJob(job, publisherId); render(); await sleep(120);
          }
          if (!ownsWorkspace(publisherId, generation)) return;
          job.scopeIndex += 1; job.cursor = job.start; await saveJob(job, publisherId);
        }
      }
      if (job.active && ownsWorkspace(publisherId, generation)) {
        const completedAt = new Date().toISOString();
        job.active = false; job.phase = "complete"; job.finishedAt = completedAt; job.lastRefreshedAt = completedAt; job.label = "Your history is up to date";
        await saveJob(job, publisherId); records = await getAll(publisherId); render(); toast("Your complete publisher history is ready.");
      }
    } catch (error) {
      if (!ownsWorkspace(publisherId, generation)) return;
      console.error("Publisher Analytics+ sync failed:", error);
      syncJob = { ...(syncJob || {}), publisherId, active: false, phase: "error", error: error.message, label: "Sync couldn't be completed" }; await saveJob(syncJob, publisherId); render(); toast("We couldn't finish syncing your history. Please try again.", "error");
    }
  }

  async function startFullSync() {
    syncJob = { publisherId: publisherIdentity.id, active: true, phase: "preparing", startedAt: new Date().toISOString(), completed: 0, total: 0, label: "Preparing your history" };
    isOpen = true;
    render();
    const identity = await fetchPublisherIdentity(true);
    if (identity.id !== publisherIdentity.id) await activatePublisher(identity, { resume: false });
    const publisherId = identity.id, generation = workspaceGeneration;
    await clearPublisherData(publisherId);
    if (!ownsWorkspace(publisherId, generation)) return;
    records = [];
    syncJob = { publisherId, active: true, phase: "preparing", startedAt: new Date().toISOString(), completed: 0, total: 0, label: "Preparing your history" };
    render();
    await runFullSync(publisherId, generation);
  }

  async function incrementalSync(announce = false, publisherId = publisherIdentity.id, generation = workspaceGeneration) {
    if (syncJob?.active || isRefreshing || !records.length) return;
    isRefreshing = true; render();
    let notice = "", noticeType = "success";
    try {
      const packages = await fetchPackages(), currentMonth = new Date().toISOString().slice(0, 7);
      const [salesRaw, downloadsRaw, revenueRaw] = await Promise.all([apiJson(API.sales(currentMonth)), apiJson(API.downloads(currentMonth)), apiJson(API.revenue)]);
      await verifyPublisherWorkspace(publisherId, generation);
      await putMany([...normalizeSales(salesRaw, currentMonth, publisherId), ...normalizeDownloads(downloadsRaw, currentMonth, publisherId), ...normalizeRevenue(revenueRaw, publisherId)], publisherId);
      const scopes = [{ id: null, name: "All assets" }, ...packages];
      for (const scope of scopes) {
        if (!ownsWorkspace(publisherId, generation)) return;
        const last = records.filter(item => item.type === "daily" && item.packageId === scope.id).map(item => item.date).sort().at(-1);
        if (!last) continue;
        const endExclusive = addDays(latestCompleteDailyDate(), 1);
        let cursor = last;
        while (ownsWorkspace(publisherId, generation) && cursor < endExclusive) {
          const chunkEnd = [addDays(cursor, DAILY_API_WINDOW_DAYS), endExclusive].sort()[0];
          const raw = await apiJson(API.daily, { method: "POST", body: { start_date: apiTimestamp(cursor), end_date: apiTimestamp(chunkEnd), package_ids: scope.id ? [scope.id] : [] } });
          await verifyPublisherWorkspace(publisherId, generation);
          await putMany(normalizeDaily(raw, scope, publisherId), publisherId); cursor = chunkEnd;
        }
      }
      if (!ownsWorkspace(publisherId, generation)) return;
      records = await getAll(publisherId);
      syncJob = { ...(syncJob || {}), publisherId, packages, active: false, phase: "complete", error: "", label: "Your history is up to date", lastRefreshedAt: new Date().toISOString() };
      await saveJob(syncJob, publisherId);
      if (announce) notice = "Your publisher data has been refreshed.";
    } catch (error) {
      console.warn("Publisher Analytics+ incremental API sync failed:", error.message);
      if (announce) { notice = "We couldn't refresh your publisher data. Please try again."; noticeType = "error"; }
    } finally { if (ownsWorkspace(publisherId, generation)) { isRefreshing = false; render(); if (notice) toast(notice, noticeType); } }
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
    if (prefs.range === "7d") return { start: [addDays(available.end, -6), available.start].sort().at(-1), end: available.end };
    if (prefs.range === "30d") return { start: [addDays(available.end, -29), available.start].sort().at(-1), end: available.end };
    if (prefs.range === "mtd") return { start: [`${available.end.slice(0, 7)}-01`, available.start].sort().at(-1), end: available.end };
    if (prefs.range === "ytd") return { start: [`${available.end.slice(0, 4)}-01-01`, available.start].sort().at(-1), end: available.end };
    const start = new Date(`${available.end}T00:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() - Number(prefs.range));
    return { start: [start.toISOString().slice(0, 10), available.start].sort().at(-1), end: available.end };
  }

  function rangePopoverMarkup(dateBounds = selectedDateBounds(), availableBounds = availableDateBounds()) {
    const customRangeLabel = `${shortDate(dateBounds.start)} – ${shortDate(dateBounds.end)}`;
    return `<div class="upa-range-popover" role="dialog" aria-label="Choose time range">${isCustomRangeEditorOpen
      ? `<div class="upa-custom-range"><div class="upa-custom-range-head"><button type="button" data-action="range-back" aria-label="Back to time ranges">←</button><div><strong>Custom range</strong><span>Choose exact start and end dates.</span></div></div><div class="upa-custom-range-fields"><label>From<input id="upa-custom-start" type="date" value="${dateBounds.start}" min="${availableBounds.start}" max="${availableBounds.end}"></label><label>Until<input id="upa-custom-end" type="date" value="${dateBounds.end}" min="${availableBounds.start}" max="${availableBounds.end}"></label></div><div class="upa-custom-range-actions"><button type="button" data-action="range-cancel">Cancel</button><button class="upa-primary" type="button" data-action="range-apply">Apply range</button></div></div>`
      : `<div class="upa-range-menu" role="listbox">${RANGE_OPTIONS.map(option => `<button type="button" role="option" aria-selected="${prefs.range === option.id}" data-range-option="${option.id}"><span>${option.label}</span>${prefs.range === option.id ? "<i>✓</i>" : ""}</button>`).join("")}<button class="upa-range-custom-option" type="button" role="option" aria-selected="${prefs.range === "custom"}" data-range-option="custom"><span><strong>Custom range</strong><small>${prefs.range === "custom" ? customRangeLabel : "Choose exact dates"}</small></span>${prefs.range === "custom" ? "<i>✓</i>" : ""}</button></div>`}</div>`;
  }

  function updateRangePopover() {
    // Keep popover-only interactions out of render(), which recreates the charts and clears their zoom state.
    const picker = document.querySelector("#upa-root .upa-range-picker"), trigger = picker?.querySelector(".upa-range-trigger");
    if (!picker || !trigger) return;
    picker.querySelector(".upa-range-popover")?.remove();
    trigger.setAttribute("aria-expanded", String(isRangePopoverOpen));
    if (isRangePopoverOpen) picker.insertAdjacentHTML("beforeend", rangePopoverMarkup());
  }

  function comparisonDateBounds(bounds, range) {
    if (!bounds.start || !bounds.end || range === "all") return null;
    if (range === "mtd") {
      const month = addMonths(bounds.start.slice(0, 7), -1), start = `${month}-01`, days = Math.round((new Date(`${bounds.end}T00:00:00Z`) - new Date(`${bounds.start}T00:00:00Z`)) / 86400000);
      const monthEnd = addDays(`${addMonths(month, 1)}-01`, -1);
      return { start, end: [addDays(start, days), monthEnd].sort()[0], label: "previous month-to-date" };
    }
    if (range === "ytd") return { start: `${Number(bounds.start.slice(0, 4)) - 1}-01-01`, end: addYears(bounds.end, -1), label: "previous year-to-date" };
    const days = Math.round((new Date(`${bounds.end}T00:00:00Z`) - new Date(`${bounds.start}T00:00:00Z`)) / 86400000) + 1;
    const labels = { "7d": "previous 7 days", "30d": "previous 30 days", "3": "previous 3 months", "6": "previous 6 months", "12": "previous year", "36": "previous 3 years", "60": "previous 5 years", custom: "previous range" };
    return { start: addDays(bounds.start, -days), end: addDays(bounds.start, -1), label: labels[range] || "previous period" };
  }

  function relativeChange(current, previous) {
    return previous > 0 ? (current - previous) / previous * 100 : null;
  }

  function changeIndicator(change, label, unit = "%") {
    if (change === null || change === undefined || !Number.isFinite(change) || !label) return "";
    if (Math.abs(change) < .05) return `<span class="upa-kpi-change upa-change-neutral">No change vs ${escapeHtml(label)}</span>`;
    const direction = change > 0 ? "up" : "down", arrow = change > 0 ? "↑" : "↓";
    const value = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(change));
    return `<span class="upa-kpi-change upa-change-${change > 0 ? "positive" : "negative"}"><i aria-hidden="true">${arrow}</i>${value}${unit} ${direction} vs ${escapeHtml(label)}</span>`;
  }

  function kpiHelp(id, label, text) {
    return `<button class="upa-kpi-help" type="button" aria-label="${escapeHtml(label)}" aria-describedby="${id}"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"></circle><path d="M8 7.2v3.5M8 4.8h.01"></path></svg><span id="${id}" class="upa-kpi-tooltip" role="tooltip">${escapeHtml(text)}</span></button>`;
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
      const id = item.packageId || item.package, current = packages.get(id) || { id, name: item.package, sales: 0, salesQty: 0, paidQty: 0, freeQty: 0, pageViews: 0, downloads: 0, wishlisted: 0 };
      current.sales += item.sales; current.salesQty += item.salesQty; current.paidQty += item.paidQty; current.freeQty += item.freeQty;
      current.pageViews += item.pageViews; current.downloads += item.downloads; current.wishlisted += item.wishlisted;
      packages.set(id, current);
    }
    return [...packages.values()].map(item => ({ ...item, conversion: item.salesQty / (item.pageViews || 1) * 100 })).sort((a, b) => b.sales - a.sales);
  }

  function trailingRevenueMetrics(items, available) {
    if (!available.start || !available.end) return { monthlyAverage: 0, monthCount: 0, growth: null, hasBaseline: false, isNew: false };
    const latestMonth = available.end.slice(0, 7), latestMonthEnd = addDays(`${addMonths(latestMonth, 1)}-01`, -1);
    const endMonth = available.end >= latestMonthEnd ? latestMonth : addMonths(latestMonth, -1);
    const currentStartMonth = addMonths(endMonth, -11), previousEndMonth = addMonths(currentStartMonth, -1), previousStartMonth = addMonths(currentStartMonth, -12);
    const currentRevenue = items.filter(item => item.period >= currentStartMonth && item.period <= endMonth).reduce((sum, item) => sum + item.sales, 0);
    const previousRevenue = items.filter(item => item.period >= previousStartMonth && item.period <= previousEndMonth).reduce((sum, item) => sum + item.sales, 0);
    const effectiveStartMonth = [currentStartMonth, available.start.slice(0, 7)].sort().at(-1);
    const monthCount = effectiveStartMonth <= endMonth ? monthSequence(`${effectiveStartMonth}-01`, `${endMonth}-01`).length : 0;
    const hasBaseline = available.start <= `${previousStartMonth}-01`;
    return {
      monthlyAverage: monthCount ? currentRevenue / monthCount : 0,
      monthCount,
      growth: hasBaseline ? (previousRevenue ? (currentRevenue - previousRevenue) / previousRevenue * 100 : currentRevenue ? null : 0) : null,
      hasBaseline,
      isNew: hasBaseline && !previousRevenue && currentRevenue > 0
    };
  }

  function revenueGrowthLabel(metric) {
    if (metric.isNew) return "New";
    if (metric.growth === null) return "—";
    return `${metric.growth > 0 ? "+" : ""}${percent(metric.growth)}`;
  }

  function revenueGrowthClass(metric) {
    if (metric.isNew || metric.growth > 0) return "upa-positive";
    if (metric.growth < 0) return "upa-negative";
    return "upa-neutral";
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

  function performancePackageOptions(allItems, selectedItems, discoveredPackages) {
    const packages = new Map();
    for (const item of discoveredPackages || []) {
      const key = String(item.id || "");
      if (key) packages.set(key, { key, name: item.name || `Package ${key}`, revenue: 0 });
    }
    for (const item of allItems) {
      const key = String(item.packageId || "");
      if (!key) continue;
      const current = packages.get(key) || { key, name: item.package || `Package ${key}`, revenue: 0 };
      if (item.package) current.name = item.package;
      packages.set(key, current);
    }
    for (const item of selectedItems) {
      const key = String(item.packageId || ""), current = packages.get(key);
      if (current) current.revenue += toNumber(item.sales);
    }
    return [...packages.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  function performanceViewModel(active, interval, metric, options, hiddenScopeKeys) {
    const activeKeys = new Set(active.map(item => item.key));
    const hiddenKeys = new Set((hiddenScopeKeys || []).filter(key => activeKeys.has(key)));
    const palette = ["#6c5ce7", "#21a7bd", "#d99721", "#d45c70", "#3ca56f", "#4e8bd7", "#aa69c7", "#6751aa", "#3f8fa4", "#a66b35"];
    const colorByKey = new Map(options.map((item, index) => [item.key, palette[index % palette.length]]));
    const lineTypes = ["solid", "dashed", "dotted"], lineTypeByKey = new Map(options.map((item, index) => [item.key, lineTypes[index % lineTypes.length]]));
    const prepared = active.map(item => {
      const buckets = new Map();
      for (const row of item.items) {
        const key = bucketStart(row.date, interval);
        buckets.set(key, (buckets.get(key) || 0) + toNumber(row[metric.field]));
      }
      const points = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => [Date.parse(`${date}T00:00:00Z`), value]);
      return { key: item.key, name: item.name, color: colorByKey.get(item.key) || metric.accent, lineType: lineTypeByKey.get(item.key) || "solid", points, total: points.reduce((sum, point) => sum + point[1], 0) };
    });
    const visibleSeries = prepared.filter(item => !hiddenKeys.has(item.key));
    const combined = new Map();
    for (const item of visibleSeries) for (const point of item.points) combined.set(point[0], (combined.get(point[0]) || 0) + point[1]);
    const combinedPoints = [...combined].sort(([a], [b]) => a - b);
    const total = visibleSeries.reduce((sum, item) => sum + item.total, 0), peak = combinedPoints.reduce((best, point) => !best || point[1] > best[1] ? point : best, null);
    return {
      metric, interval, options, series: visibleSeries,
      legend: prepared.map(item => ({ key: item.key, name: item.name, color: item.color, lineType: item.lineType, visible: !hiddenKeys.has(item.key) })),
      pointCount: new Set(visibleSeries.flatMap(item => item.points.map(point => point[0]))).size,
      total, average: combinedPoints.length ? total / combinedPoints.length : 0, peak
    };
  }

  function lifetimeViewModel(items, requestedMetric, selectedPackageKeys, hiddenPackageKeys, requestedStyle, requestedAlign) {
    const metric = lifetimeMetricDefinition(requestedMetric);
    const packages = new Map();
    for (const item of items) {
      const key = String(item.packageId || item.package || "unknown"), period = item.period || item.date?.slice(0, 7);
      if (!period) continue;
      const current = packages.get(key) || { key, name: item.package || `Package ${key}`, monthly: new Map(), total: 0 };
      const value = toNumber(item[metric.field]); current.monthly.set(period, (current.monthly.get(period) || 0) + value); current.total += value; packages.set(key, current);
    }
    const options = [...packages.values()].filter(item => item.total > 0).sort((a, b) => b.total - a.total);
    const availableKeys = new Set(options.map(item => item.key)), explicitKeys = (selectedPackageKeys || []).filter(key => availableKeys.has(key));
    const activePackages = explicitKeys.length ? options.filter(item => explicitKeys.includes(item.key)) : options.slice(0, 8);
    const activeKeys = new Set(activePackages.map(item => item.key)), hiddenKeys = new Set((hiddenPackageKeys || []).filter(key => activeKeys.has(key)));
    const visiblePackages = activePackages.filter(item => !hiddenKeys.has(item.key));
    const align = requestedAlign === "age" ? "age" : "calendar", style = requestedStyle === "area" && align === "calendar" ? "area" : "lines";
    const allPeriods = items.map(item => item.period || item.date?.slice(0, 7)).filter(Boolean).sort(), latestPeriod = allPeriods.at(-1) || "";
    const palette = ["#6c5ce7", "#21a7bd", "#d99721", "#d45c70", "#3ca56f", "#4e8bd7", "#aa69c7", "#6751aa", "#3f8fa4", "#a66b35"];
    const colors = new Map(activePackages.map((item, index) => [item.key, palette[index % palette.length]]));
    const firstPeriods = new Map(visiblePackages.map(item => {
      const periods = [...item.monthly.keys()].sort();
      return [item.key, periods.find(period => item.monthly.get(period) !== 0) || periods[0]];
    }));
    const sharedStartPeriod = style === "area" ? [...firstPeriods.values()].filter(Boolean).sort()[0] : "";
    const prepared = visiblePackages.map(item => {
      const firstPeriod = firstPeriods.get(item.key), startPeriod = sharedStartPeriod || firstPeriod;
      let cumulative = 0, points = [];
      if (startPeriod && latestPeriod) {
        points = monthSequence(`${startPeriod}-01`, `${latestPeriod}-01`).map((period, index) => {
          cumulative += item.monthly.get(period) || 0;
          return [align === "age" ? index : Date.parse(`${period}-01T00:00:00Z`), cumulative];
        });
      }
      return { key: item.key, name: item.name, total: item.total, firstPeriod, points };
    });
    const series = prepared.map(item => ({ ...item, color: colors.get(item.key) }));
    const legend = activePackages.map(item => ({ key: item.key, name: item.name, total: item.total, color: colors.get(item.key), visible: !hiddenKeys.has(item.key) }));
    const pointCount = align === "age" ? Math.max(0, ...series.map(item => item.points.length)) : new Set(series.flatMap(item => item.points.map(point => point[0]))).size;
    return { metric, options, explicitKeys, activePackages, legend, series, pointCount, align, style };
  }

  function renderLifetimeChart(viewModel) {
    const container = document.getElementById("upa-lifetime-chart");
    if (!container) return;
    if (!viewModel.series.length) { container.innerHTML = `<div class="upa-empty-chart">${viewModel.legend.length ? "Choose at least one package from the legend." : viewModel.metric.emptyLabel}</div>`; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const compactValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }
      : { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }).format(value || 0);
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const axisLabel = value => viewModel.align === "age" ? `Month ${Math.round(value) + 1}` : dateLabel(value);
    const theme = chartTheme();
    const chart = createChart("lifetime", container); if (!chart) return;
    chart.setOption({
      animation: false,
      color: viewModel.series.map(item => item.color),
      aria: { enabled: true, description: `Cumulative ${viewModel.metric.label.toLowerCase()} for ${viewModel.series.length} packages, aligned by ${viewModel.align === "age" ? `months since ${viewModel.metric.ageDescription}` : "calendar month"}.` },
      grid: { left: 14, right: 20, top: 25, bottom: 72, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true, axisPointer: { type: "line", lineStyle: { color: "#a9afbc" } }, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => {
          const visible = parameters.filter(parameter => Array.isArray(parameter.data)).sort((a, b) => b.data[1] - a.data[1]);
          if (!visible.length) return "";
          return `<strong>${axisLabel(visible[0].data[0])}</strong>${visible.map(parameter => `<br/><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${parameter.color};margin-right:6px"></span>${escapeHtml(parameter.seriesName)}&nbsp;&nbsp;${fullValue(parameter.data[1])}`).join("")}`;
        }
      },
      xAxis: viewModel.align === "age"
        ? { type: "value", min: 0, minInterval: 1, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: value => `${Math.round(value) + 1}m` }, splitLine: { show: false } }
        : { type: "time", boundaryGap: false, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: compactValue }, splitLine: { lineStyle: { color: theme.grid } } },
      dataZoom: [
        { type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, preventDefaultMouseMove: true },
        { type: "slider", filterMode: "none", height: 20, bottom: 16, borderColor: "transparent", backgroundColor: theme.zoom, fillerColor: "rgba(108,92,231,.18)", dataBackground: { lineStyle: { color: theme.zoomLine }, areaStyle: { color: theme.zoomArea } }, selectedDataBackground: { lineStyle: { color: "#6c5ce7" }, areaStyle: { color: "#5a4f8f" } }, handleStyle: { color: theme.handle, borderColor: "#6c5ce7" }, moveHandleStyle: { color: "#6c5ce7" }, textStyle: { color: theme.axis, fontSize: 9 } }
      ],
      series: viewModel.series.map(item => ({
        name: item.name, type: "line", data: item.points, stack: viewModel.style === "area" ? "lifetime" : undefined, smooth: .12, showSymbol: false,
        lineStyle: { color: item.color, width: viewModel.style === "area" ? 1.5 : 2.4 }, itemStyle: { color: item.color }, areaStyle: viewModel.style === "area" ? { color: item.color, opacity: .68 } : undefined,
        emphasis: { focus: "series", lineStyle: { width: 3.2 } }
      }))
    });
  }

  function overviewViewModel(items, bounds) {
    const interval = automaticInterval(bounds), buckets = new Map();
    for (const item of items) {
      const key = bucketStart(item.date, interval), bucket = buckets.get(key) || { date: key, revenue: 0, pageViews: 0, downloads: 0 };
      bucket.revenue += item.sales; bucket.pageViews += item.pageViews; bucket.downloads += item.downloads; buckets.set(key, bucket);
    }
    return { interval, points: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  }

  function revenueMixViewModel(items, label) {
    const packages = new Map();
    for (const item of items) {
      const key = String(item.packageId || item.package || "unknown");
      const current = packages.get(key) || { key, name: item.package || `Package ${key}`, value: 0 };
      current.value += toNumber(item.gross ?? item.sales); packages.set(key, current);
    }
    const ranked = [...packages.values()].filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    const total = ranked.reduce((sum, item) => sum + item.value, 0);
    const palette = ["#6c5ce7", "#21a7bd", "#d99721", "#d45c70", "#3ca56f", "#4e8bd7", "#aa69c7", "#6751aa"];
    return {
      label,
      total,
      packageCount: ranked.length,
      largest: ranked[0] || null,
      topThreeShare: total ? ranked.slice(0, 3).reduce((sum, item) => sum + item.value, 0) / total * 100 : 0,
      items: ranked.map((item, index) => ({ ...item, share: total ? item.value / total * 100 : 0, color: palette[index % palette.length] }))
    };
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

  function renderPerformanceChart(viewModel) {
    const key = `performance-${viewModel.metric.id}`, container = document.getElementById(`upa-${key}-chart`);
    if (!container) return;
    if (!viewModel.series.some(item => item.points.length)) { container.innerHTML = `<div class="upa-empty-chart">${viewModel.metric.emptyLabel}</div>`; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const compactValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }
      : { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }).format(value || 0);
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(viewModel.interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const allPoints = viewModel.series.flatMap(item => item.points).sort((a, b) => a[0] - b[0]);
    const theme = chartTheme();
    const chart = createChart(key, container); if (!chart) return;
    chart.group = "upa-performance";
    globalThis.UPAECharts.connect?.("upa-performance");
    chart.setOption({
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches && allPoints.length < 400,
      color: viewModel.series.map(item => item.color),
      aria: { enabled: true, description: `${intervalName(viewModel.interval)} ${viewModel.metric.label.toLowerCase()} for ${viewModel.series.map(item => item.name).join(", ")} from ${dateLabel(allPoints[0][0])} to ${dateLabel(allPoints.at(-1)[0])}.` },
      grid: { left: 12, right: 16, top: 18, bottom: 66, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => {
          const visible = parameters.filter(parameter => Array.isArray(parameter.data)).sort((a, b) => b.data[1] - a.data[1]);
          if (!visible.length) return "";
          return `<strong>${dateLabel(visible[0].data[0])}</strong>${visible.map(parameter => `<br/><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${parameter.color};margin-right:6px"></span>${escapeHtml(parameter.seriesName)}&nbsp;&nbsp;${fullValue(parameter.data[1])}`).join("")}`;
        }
      },
      xAxis: { type: "time", boundaryGap: false, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: compactValue }, splitLine: { lineStyle: { color: theme.grid } } },
      dataZoom: [
        { type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, preventDefaultMouseMove: true },
        { type: "slider", filterMode: "none", height: 18, bottom: 14, borderColor: "transparent", backgroundColor: theme.zoom, fillerColor: "rgba(108,92,231,.18)", dataBackground: { lineStyle: { color: theme.zoomLine }, areaStyle: { color: theme.zoomArea } }, selectedDataBackground: { lineStyle: { color: "#6c5ce7" }, areaStyle: { color: "#5a4f8f" } }, handleStyle: { color: theme.handle, borderColor: "#6c5ce7" }, moveHandleStyle: { color: "#6c5ce7" }, textStyle: { color: theme.axis, fontSize: 9 } }
      ],
      series: viewModel.series.map(item => ({
        name: item.name, type: "line", data: item.points, smooth: .14, sampling: "lttb", showSymbol: item.points.length <= 80, symbol: "circle", symbolSize: 5,
        lineStyle: { color: item.color, type: item.lineType, width: viewModel.series.length === 1 ? 2.5 : 2 }, itemStyle: { color: item.color }, emphasis: { focus: "series", lineStyle: { width: 3 } }
      }))
    });
  }

  function renderOverviewChart(viewModel) {
    const container = document.getElementById("upa-overview-chart");
    if (!container) return;
    if (!viewModel.points.length) { container.innerHTML = '<div class="upa-empty-chart">No activity is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme();
    const chart = createChart("overview", container); if (!chart) return;
    const lookup = new Map(viewModel.points.map(point => [Date.parse(`${point.date}T00:00:00Z`), point]));
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(viewModel.interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const compactNumber = value => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const compactMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const axes = [0, 1, 2].map(index => ({
      type: "time", gridIndex: index, boundaryGap: false, axisLine: { show: index === 2, lineStyle: { color: theme.axisLine } }, axisTick: { show: false },
      axisLabel: { show: index === 2, color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false }
    }));
    const yAxes = [
      { name: "REVENUE", formatter: compactMoney, color: "#6c5ce7" },
      { name: "PAGEVIEWS", formatter: compactNumber, color: "#21a7bd" },
      { name: "DOWNLOADS", formatter: compactNumber, color: "#d99721" }
    ].map((axis, index) => ({
      type: "value", gridIndex: index, min: 0, name: axis.name, nameLocation: "end", nameGap: 7, nameTextStyle: { color: axis.color, fontSize: 9, fontWeight: 800, align: "left" },
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: axis.formatter }, splitLine: { lineStyle: { color: theme.grid } }
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

  function renderRevenueMixChart(viewModel) {
    const container = document.getElementById("upa-revenue-mix-chart");
    if (!container || !viewModel.items.length) return;
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme();
    const chart = createChart("revenueMix", container); if (!chart) return;
    const centerLabel = document.getElementById("upa-revenue-mix-label"), centerValue = document.getElementById("upa-revenue-mix-value");
    const updateCenter = item => {
      if (!centerLabel || !centerValue) return;
      centerLabel.textContent = item?.name || viewModel.label;
      centerValue.textContent = money(item?.value ?? viewModel.total);
    };
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: `${viewModel.label} gross revenue split across ${viewModel.packageCount} revenue-generating assets.` },
      tooltip: { show: false },
      series: [{
        name: "Revenue mix", type: "pie", radius: ["65%", "86%"], center: ["50%", "50%"], avoidLabelOverlap: true, selectedMode: false,
        label: { show: false }, labelLine: { show: false }, emphasis: { scale: true, scaleSize: 5, itemStyle: { shadowBlur: 14, shadowColor: "rgba(31,36,53,.16)" } },
        itemStyle: { borderColor: theme.pieBorder, borderWidth: 3, borderRadius: 5 },
        data: viewModel.items.map(item => ({ name: item.name, value: item.value, itemStyle: { color: item.color } }))
      }]
    });
    chart.on("mouseover", parameter => updateCenter(parameter.data));
    chart.on("mouseout", () => updateCenter());
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
    const theme = chartTheme();
    const formatValue = value => viewModel.metric.currency
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
      : number(value);
    const series = viewModel.years.map((year, index) => ({
      name: viewModel.metric.label, type: "heatmap", coordinateSystem: "calendar", calendarIndex: index,
      data: viewModel.points.filter(([date, value]) => date.startsWith(year) && value > 0), emphasis: { itemStyle: { borderColor: "#26213f", borderWidth: 1, shadowBlur: 5, shadowColor: "rgba(40,32,78,.25)" } }
    }));
    const setCalendarOption = (chart, availableWidth) => {
      const width = Math.max(280, availableWidth || container.clientWidth);
      const sideRoom = width < 540 ? 48 : 88;
      const cellSize = Math.max(5, Math.min(18, Math.floor((width - sideRoom) / 53)));
      const rowHeight = cellSize * 7;
      const rowGap = Math.max(30, Math.round(cellSize * 1.8));
      const firstRowTop = 48;
      const rowStep = rowHeight + rowGap;
      const calendarWidth = cellSize * 53;
      const left = Math.max(36, Math.round((width - calendarWidth) / 2));
      const chartHeight = Math.max(250, firstRowTop + viewModel.years.length * rowStep + 22);
      const calendars = viewModel.years.map((year, index) => ({
        range: year, top: firstRowTop + index * rowStep, left, cellSize: [cellSize, cellSize],
        splitLine: { show: false },
        itemStyle: { color: theme.calendarEmpty, borderColor: theme.calendarSplit, borderWidth: 2 },
        yearLabel: { show: true, position: "left", margin: 35, color: theme.calendarYear, fontSize: 12, fontWeight: 750 },
        monthLabel: { color: theme.calendarMonth, fontSize: 10, margin: 7 }, dayLabel: { firstDay: 1, color: theme.calendarDay, fontSize: 9, margin: 7 }
      }));
      container.style.height = `${chartHeight}px`;
      chart.resize({ height: chartHeight });
      chart.setOption({
        animation: false,
        aria: { enabled: true, description: `${viewModel.metric.label} by day across ${viewModel.years.length} calendar years.` },
        tooltip: { trigger: "item", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 }, formatter: parameter => `<strong>${escapeHtml(parameter.data[0])}</strong><br/><span style="color:#aaa3d8">${viewModel.metric.label}</span>&nbsp;&nbsp;${formatValue(parameter.data[1])}` },
        visualMap: {
          min: 0, max: viewModel.scaleMax, calculable: false, orient: "horizontal", left: "center", bottom: 6,
          itemWidth: 8, itemHeight: 148, text: ["Higher", "Lower"], textGap: 10,
          textStyle: { color: theme.axis, fontSize: 10, fontWeight: 650 },
          padding: [8, 12], backgroundColor: theme.calendarScale, borderColor: theme.calendarScaleBorder, borderWidth: 1, borderRadius: 14,
          inRange: { color: theme.calendarRange }, seriesIndex: series.map((_, index) => index)
        },
        calendar: calendars, series
      }, { notMerge: true });
    };
    const chart = createChart("calendar", container, setCalendarOption); if (!chart) return;
    setCalendarOption(chart, container.clientWidth);
  }

  function sankeyPackageOptions(items, categoriesByPackage) {
    const packages = new Map();
    for (const item of items) {
      const key = String(item.packageId || item.package || "unknown"), current = packages.get(key) || { key, name: item.package || `Package ${key}`, category: item.category || categoriesByPackage.get(key) || "", gross: 0 };
      if (!current.category) current.category = item.category || categoriesByPackage.get(key) || "";
      current.gross += Math.max(0, item.gross); packages.set(key, current);
    }
    return [...packages.values()].filter(item => item.gross > 0).sort((a, b) => b.gross - a.gross);
  }

  function sankeyViewModel(items, selectedPackageKeys, requestedGroupBy, categoriesByPackage) {
    const options = sankeyPackageOptions(items, categoriesByPackage), availableKeys = new Set(options.map(item => item.key));
    const explicitKeys = (selectedPackageKeys || []).filter(key => availableKeys.has(key));
    const activePackages = explicitKeys.length ? options.filter(item => explicitKeys.includes(item.key)) : options.slice(0, 8);
    const categoryAvailable = options.some(item => item.category);
    const groupBy = requestedGroupBy === "category" && categoryAvailable ? "category" : "none";
    const palette = ["#6c5ce7", "#8b7cf0", "#4e8bd7", "#21a7bd", "#aa69c7", "#6170c7", "#6751aa", "#3f8fa4"];
    const total = activePackages.reduce((sum, item) => sum + item.gross, 0);
    const nodes = [{ name: "revenue", displayLabel: "Gross revenue", kind: "total", depth: 0, label: { position: "left" }, itemStyle: { color: "#2f9c69" } }];
    const links = [];
    const categoryTotals = new Map();
    if (groupBy === "category") {
      for (const item of activePackages) {
        const category = item.category || "Uncategorized";
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + item.gross);
      }
      for (const [category, value] of categoryTotals) {
        const key = `category:${category}`;
        nodes.push({ name: key, displayLabel: category, kind: "category", depth: 1, itemStyle: { color: "#34a7b7" } });
        links.push({ source: "revenue", target: key, value, sourceLabel: "Gross revenue", targetLabel: category });
      }
    }
    activePackages.forEach((item, index) => {
      const packageNode = `package:${item.key}`, source = groupBy === "category" ? `category:${item.category || "Uncategorized"}` : "revenue";
      nodes.push({ name: packageNode, displayLabel: item.name, kind: "package", depth: groupBy === "category" ? 2 : 1, label: { position: "right" }, itemStyle: { color: palette[index % palette.length] } });
      links.push({ source, target: packageNode, value: item.gross, sourceLabel: groupBy === "category" ? (item.category || "Uncategorized") : "Gross revenue", targetLabel: item.name });
    });
    return { options, explicitKeys, activePackages, nodes, links, total, groupBy, categoryAvailable, categories: categoryTotals.size };
  }

  function renderSankeyChart(viewModel) {
    const container = document.getElementById("upa-sankey-chart");
    if (!container) return;
    if (!viewModel.links.length) { container.innerHTML = '<div class="upa-empty-chart">No package revenue is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme();
    const chart = createChart("sankey", container); if (!chart) return;
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: `Gross revenue split across ${viewModel.activePackages.length} packages${viewModel.groupBy === "category" ? ` in ${viewModel.categories} categories` : ""}.` },
      tooltip: { trigger: "item", triggerOn: "mousemove", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 }, formatter: parameter => parameter.dataType === "edge" ? `<strong>${escapeHtml(parameter.data.sourceLabel)}</strong><br/><span style="color:#aaa3d8">to ${escapeHtml(parameter.data.targetLabel)}</span>&nbsp;&nbsp;${fullMoney(parameter.value)}` : `<strong>${escapeHtml(parameter.data.displayLabel)}</strong><br/>${fullMoney(parameter.value)}` },
      series: [{
        type: "sankey", left: 110, right: 205, top: 22, bottom: 20, nodeWidth: 14, nodeGap: 13, nodeAlign: "justify", draggable: false, layoutIterations: 36,
        data: viewModel.nodes, links: viewModel.links, label: { color: theme.sankeyLabel, fontSize: 11, fontWeight: 650, lineHeight: 16, width: 185, overflow: "truncate", formatter: parameter => parameter.data.kind === "total" ? `Gross revenue\n${money(viewModel.total)}` : parameter.data.displayLabel },
        lineStyle: { color: "gradient", curveness: .52, opacity: .3 }, emphasis: { focus: "adjacency", lineStyle: { opacity: .65 } }, itemStyle: { borderWidth: 0, borderRadius: 3 }
      }]
    });
  }

  function chartActions(key, disabled = false) {
    return `<div class="upa-chart-actions"><button data-chart-action="save" data-chart="${key}" title="Save this chart as a high-resolution PNG" ${disabled ? "disabled" : ""}>Save PNG</button><button data-chart-action="share" data-chart="${key}" title="Share this chart using your device" ${disabled ? "disabled" : ""}>Share</button></div>`;
  }

  function chartFilename(key) { return `publisher-analytics-${key}-${new Date().toISOString().slice(0, 10)}.png`; }

  const CHART_EXPORT_WIDTH = 1920;

  async function chartExportDataUrl(chart) {
    const chartWidth = chart.getWidth();
    const chartHeight = chart.getHeight();
    const exportHeight = Math.round(CHART_EXPORT_WIDTH * chartHeight / chartWidth);
    const container = document.createElement("div");
    Object.assign(container.style, { position: "fixed", left: "-10000px", top: "0", width: `${CHART_EXPORT_WIDTH}px`, height: `${exportHeight}px`, visibility: "hidden", pointerEvents: "none" });
    document.body.appendChild(container);
    const exportChart = globalThis.UPAECharts.init(container, null, { renderer: "canvas", width: CHART_EXPORT_WIDTH, height: exportHeight });
    try {
      const option = chart.getOption();
      option.animation = false;
      exportChart.setOption(option, { notMerge: true, lazyUpdate: false });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      exportChart.getZr().flush();
      return exportChart.getDataURL({ type: "png", pixelRatio: 1, backgroundColor: darkThemeActive() ? "#1d2939" : "#ffffff" });
    } finally {
      exportChart.dispose();
      container.remove();
    }
  }

  async function chartImage(key) {
    const chart = chartInstances.get(key), metadata = chartShareMetadata.get(key); if (!chart || !metadata) throw new Error("This chart is not ready yet.");
    const source = await chartExportDataUrl(chart);
    const image = new Image(); image.src = source; await image.decode();
    const scopeLegend = Array.isArray(metadata.scopeLegend) ? metadata.scopeLegend : [], headerHeight = 150, footerHeight = scopeLegend.length ? 60 + scopeLegend.length * 28 : 0;
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight + headerHeight + footerHeight;
    const context = canvas.getContext("2d"), darkExport = darkThemeActive(); context.fillStyle = darkExport ? "#1d2939" : "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = darkExport ? "#e7ebf3" : "#172033"; context.font = "700 32px Segoe UI, sans-serif"; context.fillText(metadata.title, 40, 56);
    context.fillStyle = darkExport ? "#98a3b6" : "#70798d"; context.font = "20px Segoe UI, sans-serif"; context.fillText(metadata.subtitle, 40, 91);
    context.fillStyle = "#6c5ce7"; context.font = "700 18px Segoe UI, sans-serif"; context.textAlign = "right"; context.fillText("Publisher Analytics+", canvas.width - 40, 56); context.textAlign = "left";
    context.drawImage(image, 0, headerHeight);
    if (scopeLegend.length) {
      const footerTop = headerHeight + image.naturalHeight, maxLabelWidth = canvas.width - 105;
      context.strokeStyle = darkExport ? "#303b4e" : "#e8eaf0"; context.lineWidth = 1; context.beginPath(); context.moveTo(40, footerTop + .5); context.lineTo(canvas.width - 40, footerTop + .5); context.stroke();
      context.fillStyle = darkExport ? "#98a3b6" : "#8a91a1"; context.font = "700 14px Segoe UI, sans-serif"; context.fillText("COMPARED SCOPES", 40, footerTop + 30);
      context.font = "18px Segoe UI, sans-serif";
      scopeLegend.forEach((entry, index) => {
        const baseline = footerTop + 60 + index * 28;
        context.fillStyle = entry.color || "#6c5ce7"; context.beginPath(); context.arc(46, baseline - 6, 5, 0, Math.PI * 2); context.fill();
        let label = String(entry.name || "Unnamed scope"), shortened = false;
        while (label.length > 1 && context.measureText(`${label}…`).width > maxLabelWidth) { label = label.slice(0, -1); shortened = true; }
        context.fillStyle = darkExport ? "#d7dde7" : "#4e5669"; context.fillText(shortened ? `${label.trimEnd()}…` : label, 62, baseline);
      });
    }
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

  function publisherAccount() {
    const initial = escapeHtml((publisherIdentity.name || "P").trim().charAt(0).toUpperCase() || "P");
    const avatar = publisherIdentity.icon ? `<img src="${escapeHtml(publisherIdentity.icon)}" alt="">` : `<span>${initial}</span>`;
    return `<div class="upa-publisher-account">${accountMenuOpen ? `<div class="upa-account-menu" role="menu"><button type="button" data-action="open-settings" role="menuitem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>Settings</span></button><button type="button" data-action="exit-analytics" role="menuitem"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 3.5h-4v13h4"></path><path d="M11.5 6.5 15 10l-3.5 3.5M15 10H7"></path></svg><span>Exit to Publisher Portal</span></button></div>` : ""}<button class="upa-account-trigger" type="button" data-action="toggle-account" aria-haspopup="menu" aria-expanded="${accountMenuOpen}"><span class="upa-publisher-avatar">${avatar}</span><span class="upa-publisher-copy"><strong>${escapeHtml(publisherIdentity.name || "Publisher")}</strong><small>Publisher</small></span><svg class="upa-account-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 7.5 3-3 3 3"></path></svg></button></div>`;
  }

  function groupEditorMarkup(packageOptions) {
    if (!groupEditor) return "";
    const existing = groupEditor.id ? packageGroups.find(group => group.id === groupEditor.id) : null;
    if (groupEditor.id && !existing) return "";
    const selected = new Set(existing?.packageIds || []), availableIds = new Set(packageOptions.map(item => item.key));
    const unavailableCount = [...selected].filter(id => !availableIds.has(id)).length;
    const title = existing ? "Edit package group" : "Create package group";
    const options = packageOptions.map(item => {
      const otherGroups = packageGroups.filter(group => group.id !== existing?.id && group.packageIds.includes(item.key)).length;
      return `<label><input type="checkbox" data-group-package="${escapeHtml(item.key)}" ${selected.has(item.key) ? "checked" : ""}><span><strong>${escapeHtml(item.name)}</strong><small>${otherGroups ? `In ${otherGroups} other ${otherGroups === 1 ? "group" : "groups"}` : "Not grouped elsewhere"}</small></span></label>`;
    }).join("");
    return `<section class="upa-groups-page"><button class="upa-page-back" type="button" data-action="group-cancel">← Back to package groups</button><article class="upa-group-editor" aria-labelledby="upa-group-editor-title"><div class="upa-group-editor-head"><div><small>PACKAGE GROUP</small><h2 id="upa-group-editor-title">${title}</h2><p>Choose a clear name and at least one asset. Assets can belong to more than one group.</p></div></div><label class="upa-group-name">Group name<input id="upa-group-name" type="text" maxlength="40" value="${escapeHtml(existing?.name || "")}" placeholder="For example, Editor tools"></label><div class="upa-group-package-head"><strong>Assets</strong><span>${packageOptions.length} available${unavailableCount ? ` · ${unavailableCount} unavailable kept` : ""}</span></div><div class="upa-group-package-list">${options || '<div class="upa-group-empty">Sync package history before creating a group.</div>'}</div>${unavailableCount ? `<label class="upa-group-unavailable"><input id="upa-remove-unavailable" type="checkbox"><span>Remove ${number(unavailableCount)} unavailable ${unavailableCount === 1 ? "asset" : "assets"} when saving</span></label>` : ""}<div class="upa-group-editor-actions"><button type="button" data-action="group-cancel">Cancel</button><button class="upa-primary" type="button" data-action="group-save" ${packageOptions.length || existing?.packageIds.length ? "" : "disabled"}>${existing ? "Save changes" : "Create group"}</button></div></article></section>`;
  }

  function groupsPanel(packageOptions) {
    if (groupEditor) return groupEditorMarkup(packageOptions);
    const groupRows = packageGroups.map(group => {
      const availableCount = group.packageIds.filter(id => packageOptions.some(item => item.key === id)).length, unavailableCount = group.packageIds.length - availableCount;
      return `<div class="upa-group-row"><div><strong>${escapeHtml(group.name)}</strong><span>${number(group.packageIds.length)} ${group.packageIds.length === 1 ? "asset" : "assets"}${unavailableCount ? ` · ${number(unavailableCount)} unavailable` : ""}</span></div><div><button type="button" data-action="group-edit" data-group-id="${escapeHtml(group.id)}">Edit</button><button class="upa-group-delete" type="button" data-action="group-delete" data-group-id="${escapeHtml(group.id)}">Delete</button></div></div>`;
    }).join("");
    return `<section class="upa-groups-page"><button class="upa-page-back" type="button" data-action="group-back-performance">← Back to Performance</button><article class="upa-card upa-settings-card upa-settings-groups"><div class="upa-section-title"><div><small>ANALYTICS SCOPES</small><h2>Package groups</h2><p>Save reusable asset selections for Performance. Assets can belong to more than one group.</p></div><button class="upa-settings-primary" type="button" data-action="group-create" ${packageOptions.length ? "" : "disabled"}>New group</button></div><div class="upa-group-list"><div class="upa-group-row upa-group-built-in"><div><strong>All assets</strong><span>${number(packageOptions.length)} assets · Always includes the complete catalog</span></div><em>Built in</em></div>${groupRows || '<div class="upa-group-list-empty">No saved groups yet. Create one to reuse the same asset selection in Performance.</div>'}</div></article></section>`;
  }

  function settingsPanel() {
    const salesMonths = new Set(records.filter(item => item.type === "sales").map(item => item.period)).size;
    const downloadMonths = new Set(records.filter(item => item.type === "downloads").map(item => item.period)).size;
    const performanceDays = new Set(records.filter(item => item.type === "daily" && item.scope === "all").map(item => item.date)).size;
    const revenueEntries = records.filter(item => item.type === "revenue").length;
    const themeOptions = [
      { id: "system", label: "System", icon: "◐" },
      { id: "light", label: "Light", icon: "☀" },
      { id: "dark", label: "Dark", icon: "☾" }
    ].map(option => `<button type="button" data-theme="${option.id}" aria-pressed="${prefs.theme === option.id}"><span aria-hidden="true">${option.icon}</span>${option.label}</button>`).join("");
    return `<section class="upa-settings-page">
      <section class="upa-settings-section"><div class="upa-settings-intro"><h2>Local data</h2><p>See how much publisher history is currently available.</p></div><article class="upa-settings-panel"><div class="upa-settings-panel-head"><strong>Data coverage</strong><small>Stored for ${escapeHtml(publisherIdentity.name)} in this browser.</small></div><div class="upa-coverage-grid"><div><span>Sales</span><strong>${number(salesMonths)}</strong><small>months</small></div><div><span>Downloads</span><strong>${number(downloadMonths)}</strong><small>months</small></div><div><span>Performance</span><strong>${number(performanceDays)}</strong><small>days</small></div><div><span>Revenue</span><strong>${number(revenueEntries)}</strong><small>entries</small></div></div></article></section>
      <section class="upa-settings-section"><div class="upa-settings-intro"><h2>Data management</h2><p>Back up or remove analytics kept for this publisher.</p></div><article class="upa-settings-panel"><div class="upa-settings-panel-head"><strong>Browser storage</strong><small>Your analytics stays in this browser and is never sent to an external service. Each publisher has a separate local workspace.</small></div><button class="upa-data-action" type="button" data-action="export" ${records.length ? "" : "disabled"}><span><strong>Export data</strong><small>Download a JSON backup of this publisher's analytics.</small></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v10m-4-4 4 4 4-4"></path><path d="M3.5 14v2.5h13V14"></path></svg></button><div class="upa-danger-zone"><div><strong>Clear local data</strong><span>Deletes this publisher's synced analytics and saved sync progress. Preferences and package groups are kept.</span></div><button type="button" data-action="clear" ${records.length || syncJob ? "" : "disabled"}>Clear data</button></div></article></section>
      <section class="upa-settings-section"><div class="upa-settings-intro"><h2>Appearance</h2><p>Choose how Publisher Analytics+ looks in this browser.</p></div><article class="upa-settings-panel"><div class="upa-settings-row"><div><strong>Color theme</strong><small>System follows your browser or device preference.</small></div><div class="upa-theme-options" role="group" aria-label="Color theme">${themeOptions}</div></div></article></section>
    </section>`;
  }

  function render() {
    renderQueued = false; const host = document.getElementById("upa-root"); if (!host) return;
    disposeCharts(); chartShareMetadata.clear();
    const salesItems = filtered("sales");
    const lifetimeMetric = lifetimeMetricDefinition(prefs.lifetimeMetric);
    const lifetimeItems = records.filter(item => item.type === lifetimeMetric.source && (lifetimeMetric.source !== "daily" || item.scope === "package"));
    const daily = filtered("daily"), dailyAll = daily.filter(item => item.scope === "all"), dailyPackages = daily.filter(item => item.scope === "package"), packages = aggregatePackages(daily);
    const pageViews = dailyAll.reduce((sum, item) => sum + item.pageViews, 0), salesQty = dailyAll.reduce((sum, item) => sum + item.salesQty, 0);
    const paidUnits = dailyAll.reduce((sum, item) => sum + item.paidQty, 0), downloads = dailyAll.reduce((sum, item) => sum + item.downloads, 0);
    const conversionRate = pageViews ? salesQty / pageViews * 100 : 0;
    const progress = syncJob?.active ? Math.min(100, Math.round((syncJob.completed || 0) / Math.max(syncJob.total || 1, 1) * 100)) : 0;
    const hasData = records.length > 0;
    const availableBounds = availableDateBounds(), dateBounds = selectedDateBounds(), suggestedInterval = automaticInterval(dateBounds), interval = resolvedInterval(dateBounds), revenueChartData = revenueViewModel(dailyAll, interval);
    const allDaily = records.filter(item => item.type === "daily" && item.scope === "all"), trailingRevenue = trailingRevenueMetrics(allDaily, availableBounds);
    const comparisonBounds = comparisonDateBounds(dateBounds, prefs.range);
    const comparisonAvailable = comparisonBounds && comparisonBounds.start >= availableBounds.start && comparisonBounds.end <= availableBounds.end;
    const previousDaily = comparisonAvailable ? allDaily.filter(item => item.date >= comparisonBounds.start && item.date <= comparisonBounds.end) : [];
    const previousRevenue = previousDaily.reduce((sum, item) => sum + item.sales, 0), previousPageViews = previousDaily.reduce((sum, item) => sum + item.pageViews, 0);
    const previousSalesQty = previousDaily.reduce((sum, item) => sum + item.salesQty, 0), previousDownloads = previousDaily.reduce((sum, item) => sum + item.downloads, 0);
    const previousConversionRate = previousPageViews ? previousSalesQty / previousPageViews * 100 : null;
    const revenueGrowthValue = revenueGrowthLabel(trailingRevenue);
    const comparisonLabel = comparisonAvailable ? comparisonBounds.label : "";
    const revenueChange = changeIndicator(relativeChange(revenueChartData.total, previousRevenue), comparisonLabel);
    const averageRevenueChange = trailingRevenue.hasBaseline ? changeIndicator(trailingRevenue.growth, "previous 12 months") : "";
    const pageViewsChange = changeIndicator(relativeChange(pageViews, previousPageViews), comparisonLabel);
    const conversionChange = previousConversionRate === null ? "" : changeIndicator(conversionRate - previousConversionRate, comparisonLabel, " pp");
    const downloadsChange = changeIndicator(relativeChange(downloads, previousDownloads), comparisonLabel);
    const packageHistory = new Map();
    for (const item of records.filter(row => row.type === "daily" && row.scope === "package")) {
      const id = item.packageId || item.package, history = packageHistory.get(id) || []; history.push(item); packageHistory.set(id, history);
    }
    const packageRevenueTotal = packages.reduce((sum, item) => sum + item.sales, 0);
    const dashboardPackages = packages.slice(0, 12).map(item => ({
      ...item,
      share: packageRevenueTotal ? item.sales / packageRevenueTotal * 100 : 0,
      trailing: trailingRevenueMetrics(packageHistory.get(item.id) || [], availableBounds)
    }));
    const packageCategories = new Map();
    for (const item of syncJob?.packages || []) {
      const packageKey = String(item.id || item.name || "");
      if (packageKey && item.category) packageCategories.set(packageKey, item.category);
    }
    for (const item of records) {
      const packageKey = String(item.packageId || item.package || "");
      if (packageKey && item.category && !packageCategories.has(packageKey)) packageCategories.set(packageKey, item.category);
    }
    const allPackageDaily = records.filter(item => item.type === "daily" && item.scope === "package");
    const performanceOptions = performancePackageOptions(allPackageDaily, dailyPackages, syncJob?.packages);
    const availablePerformancePackageIds = new Set(performanceOptions.map(item => item.key));
    const performanceScopeOptions = [
      { type: "all", id: "all", key: "all:all", name: "All assets", membershipIds: [...availablePerformancePackageIds], items: dailyAll },
      ...packageGroups.map(group => {
        const membershipIds = group.packageIds.filter(id => availablePerformancePackageIds.has(id)), membership = new Set(membershipIds);
        return { type: "group", id: group.id, key: `group:${group.id}`, name: group.name, membershipIds, items: dailyPackages.filter(item => membership.has(String(item.packageId || ""))) };
      }),
      ...performanceOptions.map(option => ({ type: "asset", id: option.key, key: `asset:${option.key}`, name: option.name, membershipIds: [option.key], items: dailyPackages.filter(item => String(item.packageId || "") === option.key) }))
    ];
    const requestedPerformanceScopeKeys = new Set(sanitizedPerformanceScopes(prefs.performanceScopes).map(scope => `${scope.type}:${scope.id}`));
    let selectedPerformanceScopes = performanceScopeOptions.filter(scope => requestedPerformanceScopeKeys.has(scope.key));
    if (!selectedPerformanceScopes.length) selectedPerformanceScopes = [performanceScopeOptions[0]];
    const selectedPerformanceScopeKeys = new Set(selectedPerformanceScopes.map(scope => scope.key));
    const overlapCounts = new Map();
    for (const scope of selectedPerformanceScopes) for (const packageId of scope.membershipIds) overlapCounts.set(packageId, (overlapCounts.get(packageId) || 0) + 1);
    const overlappingPerformanceAssets = [...overlapCounts.values()].filter(count => count > 1).length;
    const performanceCharts = PERFORMANCE_METRICS.map(metric => performanceViewModel(selectedPerformanceScopes, interval, metric, performanceScopeOptions, prefs.performanceHiddenScopes));
    const performanceData = performanceCharts[0];
    const performanceScopeName = selectedPerformanceScopes.length === 1 ? selectedPerformanceScopes[0].name : `${number(selectedPerformanceScopes.length)} scopes selected`;
    const performanceScopeSummary = selectedPerformanceScopes.length <= 3 ? selectedPerformanceScopes.map(scope => scope.name).join(", ") : `${number(selectedPerformanceScopes.length)} selected scopes`;
    const overviewChartData = overviewViewModel(dailyAll, dateBounds), calendarData = calendarViewModel(dailyAll, prefs.calendarMetric), lifetimeData = lifetimeViewModel(lifetimeItems, lifetimeMetric.id, prefs.lifetimePackages, prefs.lifetimeHiddenPackages, prefs.lifetimeStyle, prefs.lifetimeAlign), sankeyData = sankeyViewModel(salesItems, prefs.sankeyPackages, prefs.sankeyGroupBy, packageCategories);
    const sankeyHeight = Math.max(410, sankeyData.activePackages.length * 48 + 96);
    chartShareMetadata.set("overview", { title: "Business activity over time", subtitle: `${intervalName(overviewChartData.interval)} revenue, pageviews, and downloads · ${dateBounds.start} to ${dateBounds.end}` });
    for (const chart of performanceCharts) chartShareMetadata.set(`performance-${chart.metric.id}`, { title: `${chart.metric.label} over time`, subtitle: `${intervalName(interval)} totals · ${dateBounds.start} to ${dateBounds.end}`, scopeLegend: chart.series.map(scope => ({ name: scope.name, color: scope.color })) });
    chartShareMetadata.set("lifetime", { title: `${lifetimeData.metric.label} lifetime growth`, subtitle: `${lifetimeData.style === "area" ? "Stacked cumulative" : "Cumulative"} ${lifetimeData.metric.label.toLowerCase()} · ${lifetimeData.align === "age" ? `aligned by ${lifetimeData.metric.ageDescription}` : "calendar time"} · all available history` });
    chartShareMetadata.set("calendar", { title: `${calendarData.metric.label} calendar`, subtitle: `${dateBounds.start} to ${dateBounds.end} · daily intensity across ${calendarData.years.length} ${calendarData.years.length === 1 ? "year" : "years"}` });
    chartShareMetadata.set("sankey", { title: "Where revenue comes from", subtitle: `${sankeyData.activePackages.length} packages${sankeyData.groupBy === "category" ? ` · ${sankeyData.categories} categories` : ""} · ${dateBounds.start} to ${dateBounds.end}` });
    const views = [
      { id: "revenue", label: "Performance", description: "Compare revenue, demand, attention, and usage for the catalog or individual assets." },
      { id: "lifetime", label: "Lifetime growth", description: "See how each package accumulates gross revenue and where growth plateaus." },
      { id: "calendar", label: "Daily patterns", description: "Compare daily intensity and seasonality across years." },
      { id: "sankey", label: "Revenue composition", description: "Break down gross revenue by category and package." },
      { id: "packages", label: "Packages", description: "Compare attention, conversion, downloads, and gross sales." }
    ];
    const section = ["dashboard", "analytics", "groups", "settings"].includes(prefs.section) ? prefs.section : "dashboard";
    const view = views.some(item => item.id === prefs.view) ? prefs.view : "revenue";
    const sectionMeta = section === "dashboard"
      ? { label: "Dashboard", description: "Your publishing business at a glance." }
      : section === "analytics"
        ? { label: "Analytics", description: "Explore trends, patterns, and package performance." }
        : section === "groups"
          ? { label: "Package groups", description: "Create and manage reusable asset selections." }
          : { label: "Settings", description: "Manage data coverage and local browser storage." };
    const viewTabs = views.map(item => `<button class="upa-view-tab ${item.id === view ? "upa-active" : ""}" type="button" role="tab" aria-selected="${item.id === view}" aria-controls="upa-view-${item.id}" data-view="${item.id}">${item.label}</button>`).join("");
    const syncIncomplete = Boolean(syncJob && !syncJob.active && ["months", "daily"].includes(syncJob.phase));
    const syncTitle = syncJob?.active ? syncJob.label : syncJob?.phase === "error" ? "Sync couldn't be completed" : "Sync paused";
    const syncPreparing = syncJob?.active && syncJob.phase === "preparing";
    const syncDetail = syncJob?.active
      ? syncPreparing ? "Finding your assets and available history…" : `${syncJob.completed || 0} of ${syncJob.total || "?"} steps complete`
      : syncJob?.phase === "error"
        ? "Try again. If it keeps happening, refresh the Publisher Portal first."
        : "Continue when you're ready. Your progress has been saved.";
    const syncIcon = syncJob?.active
      ? syncPreparing ? '<div class="upa-sync-icon upa-sync-preparing" aria-hidden="true"><i></i></div>' : `<div class="upa-sync-icon upa-sync-progress" style="--upa-progress-angle:${progress * 3.6}deg" aria-hidden="true"><span>${progress}%</span></div>`
      : syncJob?.phase === "error"
        ? '<div class="upa-sync-icon upa-sync-error" aria-hidden="true">!</div>'
        : '<div class="upa-sync-icon" aria-hidden="true">Ⅱ</div>';
    const latestCapturedAt = records.reduce((latest, item) => item.capturedAt > latest ? item.capturedAt : latest, "");
    const lastRefreshedAt = syncJob?.lastRefreshedAt || syncJob?.finishedAt || latestCapturedAt;
    const refreshTooltip = `Refresh publisher data · ${lastRefreshedAt ? `Last refreshed ${dateTime(lastRefreshedAt)}` : "Not refreshed yet"}`;
    const showRefreshAction = hasData && !syncJob?.active && syncJob?.phase !== "error" && !syncIncomplete;
    const refreshAction = showRefreshAction ? `<button class="upa-refresh-action ${isRefreshing ? "upa-refreshing" : ""}" type="button" data-action="refresh" aria-label="${escapeHtml(refreshTooltip)}" ${isRefreshing ? "disabled" : ""}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 5.9A5.5 5.5 0 1 0 13 10.7"></path><path d="M13.4 2.8v3.5H9.9"></path></svg><span>${isRefreshing ? "Refreshing…" : "Refresh data"}</span><span class="upa-refresh-tooltip" role="tooltip">${escapeHtml(refreshTooltip)}</span></button>` : "";
    const customRangeLabel = `${shortDate(dateBounds.start)} – ${shortDate(dateBounds.end)}`;
    const selectedRangeLabel = prefs.range === "custom" ? customRangeLabel : RANGE_OPTIONS.find(option => option.id === prefs.range)?.label || "All time";
    const revenueMixLabel = prefs.range === "all" ? "Lifetime" : selectedRangeLabel;
    const revenueMixData = revenueMixViewModel(daily.filter(item => item.scope === "package"), revenueMixLabel);
    const rangePopover = isRangePopoverOpen ? rangePopoverMarkup(dateBounds, availableBounds) : "";
    const rangeControl = hasData && section !== "settings" && !(section === "analytics" && view === "lifetime") ? `<div class="upa-header-control upa-header-range"><span>Time range</span><div class="upa-range-picker"><button class="upa-range-trigger" type="button" data-action="range-toggle" aria-haspopup="dialog" aria-expanded="${isRangePopoverOpen}"><b>${selectedRangeLabel}</b><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"></path></svg></button>${rangePopover}</div></div>` : "";
    const intervalControl = hasData && section === "analytics" && view === "revenue" ? `<label class="upa-header-control upa-header-interval"><span>Interval</span><select id="upa-interval" aria-label="Chart interval"><option value="auto" ${prefs.interval === "auto" ? "selected" : ""}>Automatic (${intervalName(suggestedInterval).toLowerCase()})</option><option value="day" ${prefs.interval === "day" ? "selected" : ""}>Daily</option><option value="week" ${prefs.interval === "week" ? "selected" : ""}>Weekly</option><option value="month" ${prefs.interval === "month" ? "selected" : ""}>Monthly</option><option value="quarter" ${prefs.interval === "quarter" ? "selected" : ""}>Quarterly</option><option value="year" ${prefs.interval === "year" ? "selected" : ""}>Yearly</option></select></label>` : "";
    const averageRevenueHelp = trailingRevenue.monthCount ? `Average gross revenue across the ${trailingRevenue.monthCount === 12 ? "last 12" : number(trailingRevenue.monthCount)} complete months available.` : "Average monthly revenue is calculated once a complete month is available.";
    const performancePackageNames = new Map(performanceOptions.map(item => [item.key, item.name]));
    const performanceGroupMenuItems = packageGroups.map(group => {
      const key = `group:${group.id}`, selected = selectedPerformanceScopeKeys.has(key);
      const names = group.packageIds.map(id => performancePackageNames.get(id)).filter(Boolean), shownNames = names.slice(0, 6), remaining = group.packageIds.length - shownNames.length;
      const packageNamesTooltip = shownNames.length ? `${shownNames.join(", ")}${remaining ? `, … +${number(remaining)} more` : ""}` : "Package names unavailable";
      const assetCountLabel = `${number(group.packageIds.length)} ${group.packageIds.length === 1 ? "asset" : "assets"}`;
      return `<button type="button" role="menuitemcheckbox" aria-checked="${selected}" data-performance-scope="group" data-performance-scope-id="${escapeHtml(group.id)}" data-performance-scope-key="${escapeHtml(key)}"><span><strong>${escapeHtml(group.name)}</strong></span><em class="upa-performance-scope-count" title="${escapeHtml(packageNamesTooltip)}" aria-label="${escapeHtml(`${assetCountLabel}: ${packageNamesTooltip}`)}">${number(group.packageIds.length)}</em><i aria-hidden="true">${selected ? "✓" : ""}</i></button>`;
    }).join("");
    const performanceAssetMenuItems = performanceOptions.map(item => {
      const key = `asset:${item.key}`, selected = selectedPerformanceScopeKeys.has(key);
      return `<button type="button" role="menuitemcheckbox" aria-checked="${selected}" data-performance-scope="asset" data-performance-scope-id="${escapeHtml(item.key)}" data-performance-scope-key="${escapeHtml(key)}"><span><strong>${escapeHtml(item.name)}</strong></span><i aria-hidden="true">${selected ? "✓" : ""}</i></button>`;
    }).join("");
    const allPerformanceScopeSelected = selectedPerformanceScopeKeys.has("all:all");
    const performanceOverlapWarning = overlappingPerformanceAssets ? `<div class="upa-performance-overlap-note" role="note"><strong>Overlapping selection</strong><span>${number(overlappingPerformanceAssets)} ${overlappingPerformanceAssets === 1 ? "asset appears" : "assets appear"} in more than one selected scope.</span></div>` : "";
    const performanceScopeBlocks = `${performanceGroupMenuItems ? `${performanceGroupMenuItems}<div class="upa-performance-scope-separator" role="separator"></div>` : ""}${performanceAssetMenuItems ? `${performanceAssetMenuItems}<div class="upa-performance-scope-separator" role="separator"></div>` : ""}`;
    const performanceScopeMenu = isPerformanceScopeMenuOpen ? `<div class="upa-performance-scope-menu" role="menu" aria-label="Choose asset groups and individual assets"><div class="upa-performance-scope-list">${performanceScopeBlocks}<button type="button" role="menuitemcheckbox" aria-checked="${allPerformanceScopeSelected}" data-performance-scope="all" data-performance-scope-key="all:all"><span><strong>All assets</strong></span><i aria-hidden="true">${allPerformanceScopeSelected ? "✓" : ""}</i></button></div>${performanceOverlapWarning}<button class="upa-performance-manage-groups" type="button" data-action="manage-groups"><span>Manage groups</span><i>→</i></button></div>` : "";
    const performanceScopeControls = `<div class="upa-performance-scope-controls"><div class="upa-performance-scope-control"><span>Asset group</span><div class="upa-performance-scope-picker"><button class="upa-performance-scope-trigger" type="button" data-action="performance-scope-toggle" aria-haspopup="menu" aria-expanded="${isPerformanceScopeMenuOpen}"><strong>${escapeHtml(performanceScopeName)}</strong><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"></path></svg></button>${performanceScopeMenu}</div></div></div>`;
    const performanceLegend = `<div class="upa-performance-legend" aria-label="Visible comparison lines">${performanceData.legend.map(item => `<button type="button" data-performance-legend-scope="${escapeHtml(item.key)}" aria-pressed="${item.visible}" title="${item.visible ? "Hide" : "Show"} ${escapeHtml(item.name)}"><i class="upa-line-${item.lineType}" style="border-color:${item.color}"></i><strong>${escapeHtml(item.name)}</strong></button>`).join("")}</div>`;
    const performanceChartScopeDescription = selectedPerformanceScopes.length === 1 && selectedPerformanceScopes[0].type === "all" ? "the complete catalog" : escapeHtml(performanceScopeSummary);
    const performanceChartsMarkup = performanceCharts.map(chart => {
      return `<article class="upa-card upa-performance-metric-card"><div class="upa-section-title"><div><small>${chart.metric.eyebrow}</small><h2>${escapeHtml(chart.metric.label)} over time</h2><p>${intervalName(interval)} totals for ${performanceChartScopeDescription}.</p></div><div class="upa-section-tools"><span>${chart.pointCount} periods</span>${chartActions(`performance-${chart.metric.id}`, !chart.series.some(item => item.points.length))}</div></div><div class="upa-chart-summary"><dl><div><dt>Total shown</dt><dd>${metricValue(chart.metric, chart.total)}</dd></div><div><dt>Average</dt><dd>${metricValue(chart.metric, chart.average)}</dd></div><div><dt>Peak</dt><dd>${metricValue(chart.metric, chart.peak?.[1] || 0)}</dd></div></dl></div><div id="upa-performance-${chart.metric.id}-chart" class="upa-performance-chart" role="img" aria-label="Interactive ${escapeHtml(chart.metric.label.toLowerCase())} chart"></div></article>`;
    }).join("");
    const dashboardSummary = `<div class="upa-dashboard-summary"><section class="upa-dashboard-mix-card"><div class="upa-section-title"><div><small>ASSET ALLOCATION</small><h2>Revenue mix</h2></div></div>${revenueMixData.items.length ? `<div class="upa-revenue-mix-layout"><div class="upa-revenue-mix-visual"><div id="upa-revenue-mix-chart" class="upa-revenue-mix-chart" role="img" aria-label="Gross revenue contribution by asset for ${escapeHtml(revenueMixData.label)}"></div><div class="upa-revenue-mix-center"><small id="upa-revenue-mix-label">${escapeHtml(revenueMixData.label)}</small><strong id="upa-revenue-mix-value">${money(revenueMixData.total)}</strong></div></div><div class="upa-revenue-concentration"><small>REVENUE CONCENTRATION</small><dl><div><dt>Largest asset share</dt><dd>${revenueMixData.largest ? percent(revenueMixData.largest.value / revenueMixData.total * 100) : "—"}</dd><span>${revenueMixData.largest ? escapeHtml(revenueMixData.largest.name) : "No revenue yet"}</span></div><div><dt>Top 3 share</dt><dd>${percent(revenueMixData.topThreeShare)}</dd><span>${prefs.range === "all" ? "Of lifetime gross revenue" : "Of gross revenue in this range"}</span></div><div><dt>Revenue-generating assets</dt><dd>${number(revenueMixData.packageCount)}</dd><span>With recorded gross revenue</span></div></dl></div></div>` : '<div class="upa-revenue-mix-empty">No gross revenue is available for this range.</div>'}</section><div class="upa-kpi-groups"><div class="upa-kpis upa-kpis-selected"><article><div><small>Gross revenue</small></div><strong>${money(revenueChartData.total)}</strong><span>${number(paidUnits)} paid units in the selected period</span>${revenueChange}</article><article><div><small>Pageviews</small></div><strong>${number(pageViews)}</strong><span>${number(salesQty)} purchases and claims</span>${pageViewsChange}</article><article><div><small>Conversion rate</small></div><strong>${percent(conversionRate)}</strong><span>Views that became purchases or claims</span>${conversionChange}</article><article><div><small>Downloads</small></div><strong>${number(downloads)}</strong><span>Across the selected period</span>${downloadsChange}</article></div><div class="upa-kpis upa-kpis-trailing"><article><div><small>Average monthly revenue</small>${kpiHelp("upa-average-revenue-help", "About average monthly revenue", averageRevenueHelp)}</div><strong>${money(trailingRevenue.monthlyAverage)}</strong>${averageRevenueChange}</article><article><div><small>Revenue growth</small>${kpiHelp("upa-revenue-growth-help", "About revenue growth", "Compares gross revenue from the last 12 complete months with the preceding 12 months. It requires 24 months of history.")}</div><strong>${revenueGrowthValue}</strong></article></div></div></div>`;
    const dashboardPackageTable = `<article class="upa-dashboard-packages"><div class="upa-section-title"><div><small>PACKAGE BREAKDOWN</small><h2>Package performance</h2><p>Selected-range results ranked by gross revenue, with trailing revenue context.</p></div><div class="upa-section-tools"><span>${number(packages.length)} packages</span><button class="upa-table-link" type="button" data-view="packages">Explore packages</button></div></div>${dashboardPackages.length ? `<div class="upa-package-table-wrap"><table class="upa-package-table"><thead><tr><th scope="col">Package</th><th scope="col">Revenue / share</th><th scope="col">Monthly avg. (12m)</th><th scope="col">Growth (12m)</th><th scope="col">Conversion</th><th scope="col">Pageviews</th><th scope="col">Downloads</th></tr></thead><tbody>${dashboardPackages.map(item => `<tr><th scope="row"><div class="upa-package-identity" title="${number(item.paidQty)} paid units${item.freeQty ? ` · ${number(item.freeQty)} claims` : ""}"><span class="upa-package-avatar" aria-hidden="true">${escapeHtml(item.name?.trim().slice(0, 1).toUpperCase() || "P")}</span><strong class="upa-package-name">${escapeHtml(item.name)}</strong></div></th><td><span class="upa-table-value">${money(item.sales)}</span><span class="upa-table-inline-detail">${percent(item.share)}</span></td><td><span class="upa-table-value">${item.trailing.monthCount ? money(item.trailing.monthlyAverage) : "—"}</span></td><td><span class="upa-table-value ${revenueGrowthClass(item.trailing)}">${revenueGrowthLabel(item.trailing)}</span></td><td><span class="upa-table-value">${item.pageViews ? percent(item.conversion) : "—"}</span></td><td><span class="upa-table-value">${number(item.pageViews)}</span></td><td><span class="upa-table-value">${number(item.downloads)}</span></td></tr>`).join("")}</tbody></table></div><div class="upa-package-table-footer"><span>${packages.length > dashboardPackages.length ? `Showing the top ${dashboardPackages.length} of ${packages.length} packages` : `Showing all ${packages.length} packages in this range`}</span></div>` : '<div class="upa-package-table-empty">No package activity is available for this date range.</div>'}</article>`;
    host.classList.toggle("upa-open", isOpen);
    host.classList.toggle("upa-theme-dark", darkThemeActive());
    document.documentElement.classList.toggle("upa-dashboard-open", isOpen);
    const logoUrl = extensionApi.runtime.getURL("icons/publisher-analytics-128.png");
    host.innerHTML = `<button class="upa-fab" aria-label="Open Publisher Analytics+" title="Publisher Analytics+"><img src="${logoUrl}" alt=""></button><aside class="upa-panel" aria-label="Publisher Analytics+ dashboard">
      <div class="upa-shell">
        <aside class="upa-sidebar" aria-label="Analytics workspace">
          <div class="upa-brand"><span aria-hidden="true"><img src="${logoUrl}" alt=""></span><div><strong>Publisher Analytics+</strong><small>Asset Store Insights</small></div></div>
          ${hasData ? `<div class="upa-primary-nav"><small>Workspace</small><button class="${section === "dashboard" ? "upa-active" : ""}" type="button" data-section="dashboard"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="6" height="6" rx="1.5"></rect><rect x="11.5" y="2.5" width="6" height="6" rx="1.5"></rect><rect x="2.5" y="11.5" width="6" height="6" rx="1.5"></rect><rect x="11.5" y="11.5" width="6" height="6" rx="1.5"></rect></svg><span>Dashboard</span></button><button class="${section === "analytics" ? "upa-active" : ""}" type="button" data-section="analytics"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 16.5V11m5 5.5V7m5 9.5V9m4 7.5V3.5"></path><path d="m3 8 5-4 5 2 4-3"></path></svg><span>Analytics</span></button></div>` : `<div class="upa-onboarding-nav"><small>Getting started</small><strong>Build your publisher history</strong><span>One sync brings your available analytics into this workspace.</span></div>`}
          ${publisherAccount()}
        </aside>
        <section class="upa-workspace">
          <header class="upa-header ${section === "dashboard" || section === "groups" || section === "settings" ? "upa-header-compact" : ""}"><div class="upa-header-main"><div class="upa-header-copy"><small>Publisher workspace</small><h1>${hasData || ["groups", "settings"].includes(section) ? sectionMeta.label : "Welcome"}</h1><div class="upa-header-subline"><p>${hasData || ["groups", "settings"].includes(section) ? sectionMeta.description : "Build a complete, configurable view of your publishing business."}</p>${refreshAction}</div></div><div class="upa-header-actions">${intervalControl}${rangeControl}</div></div>${hasData ? `<nav class="upa-mobile-nav" aria-label="Workspace sections"><button class="${section === "dashboard" ? "upa-active" : ""}" type="button" data-section="dashboard">Dashboard</button><button class="${section === "analytics" ? "upa-active" : ""}" type="button" data-section="analytics">Analytics</button><button class="${section === "settings" ? "upa-active" : ""}" type="button" data-section="settings">Settings</button></nav>` : ""}${hasData && section === "analytics" ? `<nav class="upa-view-tabs" role="tablist" aria-label="Analytics views">${viewTabs}</nav>` : ""}</header>
          ${(syncJob?.active || syncJob?.phase === "error" || syncIncomplete) ? `<section class="upa-sync ${syncJob?.active ? "upa-syncing" : ""}" role="status" aria-live="polite">${syncIcon}<div class="upa-sync-copy"><strong>${escapeHtml(syncTitle)}</strong><span>${escapeHtml(syncDetail)}</span>${syncJob?.active ? '<small class="upa-sync-note">Large catalogs can take several minutes. Keep this tab open; if interrupted, progress resumes when you return.</small>' : ""}</div><div class="upa-sync-actions">${syncPreparing ? "" : syncJob?.active ? '<button data-action="stop-sync">Pause</button>' : syncIncomplete ? '<button data-action="continue-sync">Continue</button>' : '<button data-action="sync-all">Try full sync again</button>'}</div>${syncJob?.active ? `<div class="upa-progress ${syncPreparing ? "upa-progress-preparing" : ""}"><i style="width:${progress}%"></i></div>` : ""}</section>` : ""}
          <main class="upa-content" data-section="${section}" data-view="${view}">${publisherIdentityState !== "ready" ? `<section class="upa-welcome"><div class="upa-welcome-copy"><small>PUBLISHER WORKSPACE</small><h2>${publisherIdentityState === "loading" ? "Checking your publisher…" : "We couldn't identify the active publisher."}</h2><p>${publisherIdentityState === "loading" ? "Your local workspace will open in a moment." : "Refresh the Publisher Portal, or try again while signed in."}</p>${publisherIdentityState === "error" ? '<button class="upa-primary upa-large" data-action="retry-publisher">Try again</button>' : ""}</div></section>` : section === "groups" ? groupsPanel(performanceOptions) : section === "settings" ? settingsPanel() : records.length ? `<section class="upa-dashboard-view upa-view-panel upa-view-dashboard" id="upa-view-dashboard">${dashboardSummary}<article class="upa-dashboard-chart"><div class="upa-section-title"><div><small>BUSINESS ACTIVITY</small><h2>Performance over time</h2><p>${intervalName(overviewChartData.interval)} revenue, pageviews, and downloads on aligned timelines.</p></div><div class="upa-section-tools"><span>${overviewChartData.points.length} periods</span>${chartActions("overview")}</div></div><div class="upa-pulse-legend"><span><i class="upa-pulse-revenue"></i>Gross revenue</span><span><i class="upa-pulse-views"></i>Pageviews</span><span><i class="upa-pulse-downloads"></i>Downloads</span></div><div id="upa-overview-chart" class="upa-overview-chart" role="img" aria-label="Aligned gross revenue, pageviews, and downloads timelines"></div></article>${dashboardPackageTable}</section>
            <section class="upa-dashboard-grid"><section class="upa-view-panel upa-view-revenue upa-performance-view" id="upa-view-revenue"><article class="upa-card upa-performance-controls"><div class="upa-performance-control-layout"><div><small>CATALOG PERFORMANCE</small><h2>Compare the signals that drive your business</h2><p>Choose All assets, a saved group, or an individual asset. Every included asset gets its own line across all four charts.</p></div>${performanceScopeControls}</div>${performanceLegend}</article><div class="upa-performance-chart-grid">${performanceChartsMarkup}</div></section>
            <article class="upa-card upa-packages-card upa-view-panel upa-view-packages" id="upa-view-packages"><div class="upa-section-title"><div><small>AUDIENCE &amp; CONVERSION</small><h2>Package performance</h2><p>Top packages ranked by gross sales.</p></div><span>${packages.length} packages</span></div><div class="upa-package-list">${packages.slice(0, 10).map((item, index) => `<div class="upa-package-row"><b>${String(index + 1).padStart(2, "0")}</b><div><strong>${escapeHtml(item.name)}</strong><span>${number(item.pageViews)} views · ${item.conversion.toFixed(2)}% conversion · ${number(item.downloads)} downloads</span></div><em>${money(item.sales)}</em></div>`).join("")}</div></article></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-lifetime" id="upa-view-lifetime"><div class="upa-section-title"><div><small>LIFETIME GROWTH</small><h2>How packages accumulate ${escapeHtml(lifetimeData.metric.noun)}</h2><p>Cumulative ${escapeHtml(lifetimeData.metric.label.toLowerCase())} across all available history makes momentum and plateaus visible.</p></div><div class="upa-section-tools"><span>${lifetimeData.pointCount} months</span>${chartActions("lifetime", !lifetimeData.series.length)}</div></div><div class="upa-insight-toolbar upa-lifetime-toolbar"><div class="upa-lifetime-controls"><label class="upa-inline-select">View<select id="upa-lifetime-style"><option value="area" ${lifetimeData.style === "area" ? "selected" : ""}>Stacked area</option><option value="lines" ${lifetimeData.style === "lines" ? "selected" : ""}>Cumulative lines</option></select></label><label class="upa-inline-select">Metric<select id="upa-lifetime-metric">${Object.values(LIFETIME_METRICS).map(metric => `<option value="${metric.id}" ${lifetimeData.metric.id === metric.id ? "selected" : ""}>${metric.label}</option>`).join("")}</select></label>${lifetimeData.style === "lines" ? `<label class="upa-inline-select">Align<select id="upa-lifetime-align"><option value="calendar" ${lifetimeData.align === "calendar" ? "selected" : ""}>Calendar time</option><option value="age" ${lifetimeData.align === "age" ? "selected" : ""}>${lifetimeData.metric.ageLabel}</option></select></label>` : ""}<details class="upa-package-filter"><summary><span>Packages</span><strong>${lifetimeData.explicitKeys.length ? `${lifetimeData.explicitKeys.length} selected` : `Top 8 by ${lifetimeData.metric.rankingLabel}`}</strong></summary><div class="upa-package-filter-panel"><div class="upa-package-filter-head"><span>Choose packages to compare</span><button data-action="lifetime-top">Use top 8</button></div><div class="upa-package-checklist">${lifetimeData.options.map(item => `<label><input type="checkbox" data-lifetime-package="${escapeHtml(item.key)}" ${lifetimeData.activePackages.some(active => active.key === item.key) ? "checked" : ""}><span><strong>${escapeHtml(item.name)}</strong><small>${lifetimeValue(lifetimeData.metric, item.total)}</small></span></label>`).join("")}</div></div></details></div></div><div class="upa-lifetime-legend">${lifetimeData.legend.map(item => `<button type="button" data-lifetime-legend-package="${escapeHtml(item.key)}" aria-pressed="${item.visible}" title="${item.visible ? "Hide" : "Show"} ${escapeHtml(item.name)}"><i style="background:${item.color}"></i><strong>${escapeHtml(item.name)}</strong><em>${lifetimeValue(lifetimeData.metric, item.total)}</em></button>`).join("")}</div><div id="upa-lifetime-chart" class="upa-lifetime-chart" role="img" aria-label="Cumulative ${escapeHtml(lifetimeData.metric.label.toLowerCase())} by package"></div></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-calendar" id="upa-view-calendar"><div class="upa-section-title"><div><small>SEASONALITY &amp; OUTLIERS</small><h2>Daily activity calendar</h2><p>Compare daily intensity across years and spot recurring patterns at a glance.</p></div><div class="upa-section-tools"><span>${calendarData.years.length} ${calendarData.years.length === 1 ? "year" : "years"}</span>${chartActions("calendar")}</div></div><div class="upa-insight-toolbar"><label class="upa-inline-select">Show<select id="upa-calendar-metric"><option value="sales" ${prefs.calendarMetric === "sales" ? "selected" : ""}>Gross revenue</option><option value="salesQty" ${prefs.calendarMetric === "salesQty" ? "selected" : ""}>Purchases and claims</option><option value="pageViews" ${prefs.calendarMetric === "pageViews" ? "selected" : ""}>Pageviews</option><option value="downloads" ${prefs.calendarMetric === "downloads" ? "selected" : ""}>Downloads</option></select></label><div class="upa-insight-facts"><span><small>Total</small><strong>${calendarData.metric.currency ? money(calendarData.total) : number(calendarData.total)}</strong></span><span><small>Peak day</small><strong>${calendarData.peak ? escapeHtml(calendarData.peak[0]) : "—"}</strong></span><span><small>Peak value</small><strong>${calendarData.peak ? (calendarData.metric.currency ? money(calendarData.peak[1]) : number(calendarData.peak[1])) : "—"}</strong></span></div></div><div id="upa-calendar-chart" class="upa-calendar-chart" role="img" aria-label="Calendar heatmap with one row per year"></div></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-sankey" id="upa-view-sankey"><div class="upa-section-title"><div><small>REVENUE COMPOSITION</small><h2>Where revenue comes from</h2></div><div class="upa-section-tools"><span>${sankeyData.activePackages.length} shown</span>${chartActions("sankey")}</div></div><div class="upa-insight-toolbar upa-sankey-toolbar"><div class="upa-sankey-controls"><label class="upa-inline-select">Group by<select id="upa-sankey-group"><option value="none" ${sankeyData.groupBy === "none" ? "selected" : ""}>None</option><option value="category" ${sankeyData.groupBy === "category" ? "selected" : ""} ${sankeyData.categoryAvailable ? "" : "disabled"}>${sankeyData.categoryAvailable ? "Category" : "Category unavailable"}</option></select></label><details class="upa-package-filter"><summary><span>Packages</span><strong>${sankeyData.explicitKeys.length ? `${sankeyData.explicitKeys.length} selected` : "Top 8 by revenue"}</strong></summary><div class="upa-package-filter-panel"><div class="upa-package-filter-head"><span>Choose packages to compare</span><button data-action="sankey-top">Use top 8</button></div><div class="upa-package-checklist">${sankeyData.options.map(item => `<label><input type="checkbox" data-sankey-package="${escapeHtml(item.key)}" ${sankeyData.activePackages.some(active => active.key === item.key) ? "checked" : ""}><span><strong>${escapeHtml(item.name)}</strong><small>${money(item.gross)}</small></span></label>`).join("")}</div></div></details></div><div class="upa-insight-facts"><span><small>Revenue shown</small><strong>${money(sankeyData.total)}</strong></span>${sankeyData.groupBy === "category" ? `<span><small>Categories</small><strong>${number(sankeyData.categories)}</strong></span>` : ""}<span><small>Packages</small><strong>${number(sankeyData.activePackages.length)}</strong></span></div></div><div id="upa-sankey-chart" class="upa-sankey-chart" style="height:${sankeyHeight}px" role="img" aria-label="Gross revenue split by package${sankeyData.groupBy === "category" ? " and category" : ""}"></div></section>` : `<section class="upa-welcome"><div class="upa-welcome-copy"><small>YOUR COMPLETE PICTURE</small><h2>Go beyond the<br>one-year window.</h2><p>Bring your available sales, downloads, revenue, pageviews, and conversion history into one configurable workspace.</p>${syncJob?.active ? '<div class="upa-welcome-running"><i></i><span>Your history is being prepared. You can leave this page open and follow the progress above.</span></div>' : '<button class="upa-primary upa-large" data-action="sync-all">Sync full history</button>'}</div><div class="upa-welcome-visual" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span>Lifetime</span></div></section>`}</main>
        </section>
      </div>
      <div class="upa-toast" role="status" aria-live="polite"></div>
    </aside>`;
    if (hasData && isOpen) {
      if (section === "dashboard") { renderRevenueMixChart(revenueMixData); renderOverviewChart(overviewChartData); }
      if (section === "analytics" && view === "revenue") for (const chart of performanceCharts) renderPerformanceChart(chart);
      if (section === "analytics" && view === "lifetime") renderLifetimeChart(lifetimeData);
      if (section === "analytics" && view === "calendar") renderCalendarChart(calendarData);
      if (section === "analytics" && view === "sankey") renderSankeyChart(sankeyData);
    }
  }

  function scheduleRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } }
  function toast(message, type = "success") { const node = document.querySelector("#upa-root .upa-toast"); if (!node) return; node.textContent = message; node.dataset.type = type; node.classList.add("upa-show"); setTimeout(() => node.classList.remove("upa-show"), 3600); }
  function download(name, contents) { const url = URL.createObjectURL(new Blob([contents], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  function openGroupEditor(id = "") {
    groupEditor = { id };
    render();
    requestAnimationFrame(() => document.querySelector("#upa-group-name")?.focus());
  }

  async function saveGroupFromEditor() {
    const publisherId = publisherIdentity.id, generation = workspaceGeneration;
    const existing = groupEditor?.id ? packageGroups.find(group => group.id === groupEditor.id) : null;
    if (groupEditor?.id && !existing) { groupEditor = null; render(); return; }
    const name = compact(document.querySelector("#upa-group-name")?.value).slice(0, 40);
    if (!name) { toast("Enter a group name.", "error"); document.querySelector("#upa-group-name")?.focus(); return; }
    if (name.toLocaleLowerCase() === "all assets") { toast("All assets is the built-in catalog group. Choose another name.", "error"); return; }
    if (packageGroups.some(group => group.id !== existing?.id && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { toast("A group with this name already exists.", "error"); return; }
    const availableIds = new Set([...document.querySelectorAll("#upa-root [data-group-package]")].map(input => input.dataset.groupPackage));
    const unavailableIds = document.querySelector("#upa-remove-unavailable")?.checked ? [] : (existing?.packageIds || []).filter(id => !availableIds.has(id));
    const packageIds = [...new Set([...document.querySelectorAll("#upa-root [data-group-package]:checked")].map(input => input.dataset.groupPackage).concat(unavailableIds))];
    if (!packageIds.length) { toast("Choose at least one asset for this group.", "error"); return; }
    const membershipKey = [...packageIds].sort().join("\u0000");
    if (packageGroups.some(group => group.id !== existing?.id && [...group.packageIds].sort().join("\u0000") === membershipKey)) { toast("Another group already contains exactly these assets.", "error"); return; }
    const now = new Date().toISOString();
    const saved = { id: existing?.id || crypto.randomUUID(), name, packageIds, createdAt: existing?.createdAt || now, updatedAt: now };
    packageGroups = existing ? packageGroups.map(group => group.id === existing.id ? saved : group) : [...packageGroups, saved];
    await savePackageGroups();
    if (!ownsWorkspace(publisherId, generation)) return;
    groupEditor = null;
    render();
    toast(existing ? "Package group updated." : "Package group created.");
  }

  function bindEvents() {
    document.addEventListener("click", async event => {
      if (!event.target.closest("#upa-root")) return;
      if (!event.target.closest(".upa-package-filter")) document.querySelectorAll("#upa-root .upa-package-filter[open]").forEach(filter => { filter.open = false; });
      const outsideAccountMenu = accountMenuOpen && !event.target.closest(".upa-publisher-account");
      if (outsideAccountMenu) accountMenuOpen = false;
      if (isRangePopoverOpen && !event.target.closest(".upa-range-picker")) {
        isRangePopoverOpen = false; isCustomRangeEditorOpen = false;
        document.querySelector("#upa-root .upa-range-popover")?.remove();
        document.querySelector("#upa-root .upa-range-trigger")?.setAttribute("aria-expanded", "false");
      }
      if (isPerformanceScopeMenuOpen && !event.target.closest(".upa-performance-scope-picker")) {
        isPerformanceScopeMenuOpen = false;
        document.querySelector("#upa-root .upa-performance-scope-menu")?.remove();
        document.querySelector("#upa-root .upa-performance-scope-trigger")?.setAttribute("aria-expanded", "false");
      }
      const action = event.target.closest("[data-action]")?.dataset.action;
      const themeButton = event.target.closest("[data-theme]");
      if (themeButton) {
        prefs.theme = ["system", "light", "dark"].includes(themeButton.dataset.theme) ? themeButton.dataset.theme : "system";
        await savePrefs(); render(); return;
      }
      if (action === "retry-publisher") {
        publisherIdentityState = "loading"; render();
        try { await activatePublisher(await fetchPublisherIdentity(true), { initial: true }); }
        catch (error) { publisherIdentityState = "error"; console.warn("Publisher Analytics+ could not identify the active publisher:", error.message); render(); }
        return;
      }
      if (publisherIdentityState !== "ready" && action && !["toggle-account", "exit-analytics"].includes(action)) return;
      if (action === "performance-scope-toggle") { isPerformanceScopeMenuOpen = !isPerformanceScopeMenuOpen; render(); return; }
      const performanceScopeButton = event.target.closest("[data-performance-scope]");
      if (performanceScopeButton) {
        const scope = performanceScopeButton.dataset.performanceScope, id = scope === "all" ? "all" : performanceScopeButton.dataset.performanceScopeId || "", key = `${scope}:${id}`;
        if (scope === "group" && !packageGroups.some(group => group.id === id)) return;
        if (scope === "asset" && !id) return;
        let scopes = sanitizedPerformanceScopes(prefs.performanceScopes), existingIndex = scopes.findIndex(item => `${item.type}:${item.id}` === key);
        if (existingIndex >= 0) scopes.splice(existingIndex, 1);
        else {
          if (key !== "all:all" && scopes.length === 1 && scopes[0].type === "all") scopes = [];
          scopes.push({ type: scope, id });
        }
        prefs.performanceScopes = scopes.length ? scopes : [{ type: "all", id: "all" }];
        const selectedKeys = new Set(prefs.performanceScopes.map(item => `${item.type}:${item.id}`));
        prefs.performanceHiddenScopes = (prefs.performanceHiddenScopes || []).filter(item => selectedKeys.has(item));
        isPerformanceScopeMenuOpen = true;
        await savePrefs(); render();
        requestAnimationFrame(() => [...document.querySelectorAll("#upa-root [data-performance-scope-key]")].find(item => item.dataset.performanceScopeKey === key)?.focus());
        return;
      }
      if (action === "group-cancel") { groupEditor = null; render(); return; }
      if (action === "group-create") { openGroupEditor(); return; }
      if (action === "group-edit") { openGroupEditor(event.target.closest("[data-group-id]")?.dataset.groupId || ""); return; }
      if (action === "group-save") { await saveGroupFromEditor(); return; }
      if (action === "manage-groups") { isPerformanceScopeMenuOpen = false; prefs.section = "groups"; await savePrefs(); render(); return; }
      if (action === "group-back-performance") { groupEditor = null; prefs.section = "analytics"; prefs.view = "revenue"; await savePrefs(); render(); return; }
      if (action === "group-delete") {
        const id = event.target.closest("[data-group-id]")?.dataset.groupId || "", group = packageGroups.find(item => item.id === id);
        if (!group || !window.confirm(`Delete the package group “${group.name}”? Its assets and analytics will not be deleted.`)) return;
        const publisherId = publisherIdentity.id, generation = workspaceGeneration;
        packageGroups = packageGroups.filter(item => item.id !== id); await savePackageGroups();
        if (!ownsWorkspace(publisherId, generation)) return;
        const removedKey = `group:${id}`;
        prefs.performanceScopes = sanitizedPerformanceScopes(prefs.performanceScopes).filter(scope => `${scope.type}:${scope.id}` !== removedKey);
        if (!prefs.performanceScopes.length) prefs.performanceScopes = [{ type: "all", id: "all" }];
        prefs.performanceHiddenScopes = (prefs.performanceHiddenScopes || []).filter(key => key !== removedKey);
        await savePrefs();
        if (groupEditor?.id === id) groupEditor = null;
        render(); toast("Package group deleted."); return;
      }
      if (action === "range-toggle") {
        isRangePopoverOpen = !isRangePopoverOpen; isCustomRangeEditorOpen = false; updateRangePopover(); return;
      }
      const rangeOption = event.target.closest("[data-range-option]")?.dataset.rangeOption;
      if (rangeOption) {
        if (rangeOption === "custom") {
          isRangePopoverOpen = true; isCustomRangeEditorOpen = true; updateRangePopover();
          requestAnimationFrame(() => document.querySelector("#upa-custom-start")?.focus());
          return;
        }
        if (rangeOption === prefs.range) {
          isRangePopoverOpen = false; isCustomRangeEditorOpen = false; updateRangePopover(); return;
        }
        prefs.range = rangeOption; isRangePopoverOpen = false; isCustomRangeEditorOpen = false;
        await savePrefs(); render(); return;
      }
      if (action === "range-back") { isRangePopoverOpen = true; isCustomRangeEditorOpen = false; updateRangePopover(); return; }
      if (action === "range-cancel") { isRangePopoverOpen = false; isCustomRangeEditorOpen = false; updateRangePopover(); return; }
      if (action === "range-apply") {
        let start = document.querySelector("#upa-custom-start")?.value || "", end = document.querySelector("#upa-custom-end")?.value || "";
        const available = availableDateBounds();
        if (!start || !end || !available.start) { toast("Choose both a start and end date.", "error"); return; }
        start = [[start, available.start].sort().at(-1), available.end].sort()[0];
        end = [[end, available.start].sort().at(-1), available.end].sort()[0];
        if (start > end) [start, end] = [end, start];
        prefs.range = "custom"; prefs.start = start; prefs.end = end; isRangePopoverOpen = false; isCustomRangeEditorOpen = false;
        await savePrefs(); render(); return;
      }
      const chartButton = event.target.closest("[data-chart-action]");
      if (chartButton) { await handleChartAction(chartButton.dataset.chartAction, chartButton.dataset.chart); return; }
      const performanceLegendButton = event.target.closest("[data-performance-legend-scope]");
      if (performanceLegendButton) {
        const key = performanceLegendButton.dataset.performanceLegendScope, hidden = new Set(prefs.performanceHiddenScopes || []);
        if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
        prefs.performanceHiddenScopes = [...hidden];
        await savePrefs(); render(); return;
      }
      const lifetimeLegendButton = event.target.closest("[data-lifetime-legend-package]");
      if (lifetimeLegendButton) {
        const key = lifetimeLegendButton.dataset.lifetimeLegendPackage, hidden = new Set(prefs.lifetimeHiddenPackages || []);
        if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
        prefs.lifetimeHiddenPackages = [...hidden];
        await savePrefs(); render(); return;
      }
      const sectionButton = event.target.closest("button[data-section]");
      if (sectionButton) { prefs.section = sectionButton.dataset.section; if (prefs.section !== "groups") groupEditor = null; accountMenuOpen = false; await savePrefs(); render(); return; }
      const viewButton = event.target.closest("button[data-view]");
      if (viewButton) {
        prefs.section = "analytics"; prefs.view = viewButton.dataset.view; groupEditor = null;
        if (prefs.view === "lifetime") { isRangePopoverOpen = false; isCustomRangeEditorOpen = false; }
        await savePrefs(); render(); return;
      }
      if (event.target.closest(".upa-fab")) { isOpen = true; render(); return; }
      if (action === "toggle-account") { accountMenuOpen = !accountMenuOpen; render(); return; }
      if (action === "open-settings") { prefs.section = "settings"; groupEditor = null; accountMenuOpen = false; await savePrefs(); render(); return; }
      if (action === "exit-analytics") { isOpen = false; groupEditor = null; accountMenuOpen = false; render(); return; }
      if (action === "sync-all") await startFullSync();
      if (action === "refresh") await incrementalSync(true);
      if (action === "stop-sync" && syncJob) { syncJob.active = false; syncJob.label = "Sync paused"; await saveJob(); render(); }
      if (action === "continue-sync" && syncJob) { syncJob.active = true; await saveJob(); render(); await runFullSync(publisherIdentity.id, workspaceGeneration); }
      if (action === "lifetime-top") { prefs.lifetimePackages = []; prefs.lifetimeHiddenPackages = []; await savePrefs(); render(); }
      if (action === "sankey-top") { prefs.sankeyPackages = []; await savePrefs(); render(); }
      if (action === "export") { download(`publisher-analytics-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), publisher: { id: publisherIdentity.id, name: publisherIdentity.name }, records }, null, 2)); toast("Your analytics backup is downloading."); }
      if (action === "clear" && window.confirm(`Clear locally synced analytics for ${publisherIdentity.name}? Your preferences and package groups will be kept. This can't be undone.`)) {
        const publisherId = publisherIdentity.id, generation = workspaceGeneration;
        await clearPublisherData(publisherId);
        if (ownsWorkspace(publisherId, generation)) { records = []; syncJob = null; render(); toast("This publisher's local analytics data was cleared."); }
      }
      if (!action && outsideAccountMenu) render();
    });
    document.addEventListener("change", async event => {
      if (event.target.id === "upa-interval") { prefs.interval = event.target.value; await savePrefs(); render(); }
      if (event.target.id === "upa-calendar-metric") { prefs.calendarMetric = event.target.value; await savePrefs(); render(); }
      if (event.target.id === "upa-lifetime-metric") { prefs.lifetimeMetric = LIFETIME_METRICS[event.target.value] ? event.target.value : "revenue"; await savePrefs(); render(); }
      if (event.target.id === "upa-lifetime-style") { prefs.lifetimeStyle = event.target.value === "area" ? "area" : "lines"; if (prefs.lifetimeStyle === "area") prefs.lifetimeAlign = "calendar"; await savePrefs(); render(); }
      if (event.target.id === "upa-lifetime-align") { prefs.lifetimeAlign = event.target.value === "age" ? "age" : "calendar"; if (prefs.lifetimeAlign === "age") prefs.lifetimeStyle = "lines"; await savePrefs(); render(); }
      if (event.target.id === "upa-sankey-group") { prefs.sankeyGroupBy = event.target.value === "category" ? "category" : "none"; await savePrefs(); render(); }
      if (event.target.matches("[data-lifetime-package]")) {
        prefs.lifetimePackages = [...document.querySelectorAll("#upa-root [data-lifetime-package]:checked")].map(input => input.dataset.lifetimePackage);
        if (event.target.checked) prefs.lifetimeHiddenPackages = (prefs.lifetimeHiddenPackages || []).filter(key => key !== event.target.dataset.lifetimePackage);
        await savePrefs(); render(); requestAnimationFrame(() => { const filter = document.querySelector("#upa-root .upa-view-lifetime .upa-package-filter"); if (filter) filter.open = true; });
      }
      if (event.target.matches("[data-sankey-package]")) {
        prefs.sankeyPackages = [...document.querySelectorAll("#upa-root [data-sankey-package]:checked")].map(input => input.dataset.sankeyPackage);
        await savePrefs(); render(); requestAnimationFrame(() => { const filter = document.querySelector("#upa-root .upa-package-filter"); if (filter) filter.open = true; });
      }
    });
    document.addEventListener("keydown", event => {
      if (groupEditor && event.key === "Enter" && event.target.id === "upa-group-name") { event.preventDefault(); saveGroupFromEditor(); return; }
      if (event.key !== "Escape") return;
      if (groupEditor) { groupEditor = null; render(); return; }
      if (isPerformanceScopeMenuOpen) { isPerformanceScopeMenuOpen = false; render(); requestAnimationFrame(() => document.querySelector("#upa-root .upa-performance-scope-trigger")?.focus()); return; }
      if (accountMenuOpen) { accountMenuOpen = false; render(); requestAnimationFrame(() => document.querySelector("#upa-root .upa-account-trigger")?.focus()); return; }
      const openPackageFilter = document.querySelector("#upa-root .upa-package-filter[open]");
      if (openPackageFilter) { openPackageFilter.open = false; openPackageFilter.querySelector("summary")?.focus(); return; }
      if (!isRangePopoverOpen) return;
      isRangePopoverOpen = false; isCustomRangeEditorOpen = false; updateRangePopover();
      requestAnimationFrame(() => document.querySelector("#upa-root .upa-range-trigger")?.focus());
    });
    systemDarkTheme.addEventListener("change", () => { if (prefs.theme === "system") scheduleRender(); });
    extensionApi.runtime.onMessage.addListener(message => {
      if (message?.type !== "UPA_TOGGLE") return;
      isOpen = !isOpen;
      if (!isOpen) { isRangePopoverOpen = false; isCustomRangeEditorOpen = false; isPerformanceScopeMenuOpen = false; accountMenuOpen = false; groupEditor = null; }
      render();
    });
  }

  async function init() {
    try { isOpen = Boolean((await extensionApi.runtime.sendMessage({ type: "UPA_CONSUME_OPEN" }))?.open); }
    catch { /* The in-page launcher remains available if the service worker is unavailable. */ }
    const root = document.createElement("div"); root.id = "upa-root"; document.body.appendChild(root); bindEvents(); render();
    try { await activatePublisher(await fetchPublisherIdentity(), { initial: true }); }
    catch (error) { publisherIdentityState = "error"; console.warn("Publisher Analytics+ could not identify the active publisher:", error.message); render(); }
    setInterval(async () => {
      if (identityRefreshInFlight || document.visibilityState === "hidden") return;
      identityRefreshInFlight = true;
      try {
        const identity = await fetchPublisherIdentity();
        if (identity.id !== publisherIdentity.id) await activatePublisher(identity);
        else if (publisherIdentityState !== "ready" || identity.name !== publisherIdentity.name || identity.icon !== publisherIdentity.icon) { publisherIdentity = identity; publisherIdentityState = "ready"; scheduleRender(); }
      } catch (error) {
        workspaceGeneration += 1;
        publisherIdentity = { id: "", organizationId: "", portalLabel: "", name: "Publisher", icon: "" };
        publisherIdentityState = "error";
        records = [];
        syncJob = null;
        packageGroups = [];
        groupEditor = null;
        isPerformanceScopeMenuOpen = false;
        isRefreshing = false;
        console.warn("Publisher Analytics+ could not refresh the publisher identity:", error.message);
        render();
      }
      finally { identityRefreshInFlight = false; }
    }, 30000);
  }

  init().catch(error => console.error("Publisher Analytics+ failed to initialize:", error));
})();
