  const DAILY_METRICS = {
    carted: { id: "carted", label: "Carted", field: "carted", description: "Times a package was added to a cart." },
    quickLooks: { id: "quickLooks", label: "Quick looks", field: "quickLooks", description: "Quick looks recorded for a package." },
    revenuePerPageview: { id: "revenuePerPageview", label: "Revenue / pageview", field: "revenuePerPageview", description: "Gross revenue divided by pageviews.", ratio: true }
  };
  const LIFETIME_METRICS = {
    revenue: { id: "revenue", label: "Gross revenue", noun: "revenue", rankingLabel: "revenue", field: "gross", source: "sales", currency: true, description: "Revenue before refunds, chargebacks, and Unity's revenue share.", ageLabel: "Since first sale", ageDescription: "first sale", emptyLabel: "No package revenue is available yet." },
    sales: { id: "sales", label: "Sales", noun: "sales", rankingLabel: "sales", field: "qty", source: "sales", currency: false, description: "Paid units only. Free claims are not included.", ageLabel: "Since first sale", ageDescription: "first sale", emptyLabel: "No package sales are available yet." },
    salesClaims: { id: "salesClaims", label: "Sales & Claims", noun: "sales and claims", rankingLabel: "sales and claims", field: "salesQty", source: "daily", currency: false, description: "Paid units and free claims combined.", ageLabel: "Since first sale or claim", ageDescription: "first sale or claim", emptyLabel: "No package sales or claims are available yet." },
    downloads: { id: "downloads", label: "Downloads", noun: "downloads", rankingLabel: "downloads", field: "downloads", source: "downloads", currency: false, description: "Downloads of package files.", ageLabel: "Since first download", ageDescription: "first download", emptyLabel: "No package downloads are available yet." },
    pageviews: { id: "pageviews", label: "Pageviews", noun: "pageviews", rankingLabel: "pageviews", field: "pageViews", source: "daily", currency: false, description: "Views of your Asset Store package pages.", ageLabel: "Since first pageview", ageDescription: "first pageview", emptyLabel: "No package pageviews are available yet." },
    ...Object.fromEntries(Object.values(DAILY_METRICS).filter(metric => !metric.ratio).map(metric => [metric.id, { ...metric, noun: metric.label.toLowerCase(), rankingLabel: metric.label.toLowerCase(), source: "daily", currency: false, ageLabel: "Since first activity", ageDescription: "first activity", emptyLabel: `No package ${metric.label.toLowerCase()} are available yet.` }]))
  };
  const PERFORMANCE_METRICS = [
    { id: "revenue", label: "Gross revenue", eyebrow: "EARNINGS", field: "sales", currency: true, accent: "#6c5ce7", emptyLabel: "No gross revenue is available for this selection." },
    { id: "salesClaims", label: "Sales & Claims", eyebrow: "ACQUISITIONS", field: "salesQty", currency: false, accent: "#3ca56f", emptyLabel: "No sales or claims are available for this selection." },
    { id: "pageviews", label: "Pageviews", eyebrow: "ATTENTION", field: "pageViews", currency: false, accent: "#21a7bd", emptyLabel: "No pageviews are available for this selection." },
    { id: "downloads", label: "Downloads", eyebrow: "USAGE", field: "downloads", currency: false, accent: "#d99721", emptyLabel: "No downloads are available for this selection." },
    ...Object.values(DAILY_METRICS).map((metric, index) => ({ ...metric, eyebrow: "ENGAGEMENT", currency: Boolean(metric.ratio), accent: ["#d45c70", "#aa69c7", "#5c78c9"][index], emptyLabel: `No ${metric.label.toLowerCase()} are available for this selection.` }))
  ];
  const lifetimeMetricDefinition = id => LIFETIME_METRICS[id] || LIFETIME_METRICS.revenue;
  const lifetimeValue = (metric, value) => metricValue(metric, value);
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

  let indexedRecordsSource = null;
  let indexedRecordsByType = new Map();
  let indexedRecordsByTypeAndScope = new Map();
  let indexedSortedTypes = new Set();
  let indexedDateBounds = { start: "", end: "" };
  let indexedLatestCapturedAt = "";

  function ensureRecordIndexes() {
    if (indexedRecordsSource === records) return;
    indexedRecordsSource = records;
    indexedRecordsByType = new Map();
    indexedRecordsByTypeAndScope = new Map();
    indexedSortedTypes = new Set();
    let start = "", end = "";
    indexedLatestCapturedAt = "";
    for (const item of records) {
      const typeRows = indexedRecordsByType.get(item.type) || [];
      typeRows.push(item);
      indexedRecordsByType.set(item.type, typeRows);
      const scopeKey = `${item.type}\u0000${item.scope || ""}`;
      const scopedRows = indexedRecordsByTypeAndScope.get(scopeKey) || [];
      scopedRows.push(item);
      indexedRecordsByTypeAndScope.set(scopeKey, scopedRows);
      if (item.capturedAt > indexedLatestCapturedAt) indexedLatestCapturedAt = item.capturedAt;
      if (item.type === "daily" && item.scope === "all" && item.date) {
        if (!start || item.date < start) start = item.date;
        if (!end || item.date > end) end = item.date;
      }
    }
    const sortByDate = (a, b) => {
      const left = String(a.date || ""), right = String(b.date || "");
      return left < right ? -1 : left > right ? 1 : 0;
    };
    for (const type of ["daily", "sales"]) {
      const rows = indexedRecordsByType.get(type);
      if (rows) { rows.sort(sortByDate); indexedSortedTypes.add(type); }
    }
    indexedDateBounds = { start, end };
  }

  function indexedRecords(type, scope) {
    ensureRecordIndexes();
    if (type === undefined) return records;
    return scope === undefined ? (indexedRecordsByType.get(type) || []) : (indexedRecordsByTypeAndScope.get(`${type}\u0000${scope || ""}`) || []);
  }

  function latestRecordCapturedAt() { ensureRecordIndexes(); return indexedLatestCapturedAt; }

  function availableDateBounds() {
    ensureRecordIndexes();
    return indexedDateBounds;
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
    const rows = indexedRecords(type);
    if (!indexedSortedTypes.has(type)) {
      rows.sort((a, b) => {
        const left = String(a.date || ""), right = String(b.date || "");
        return left < right ? -1 : left > right ? 1 : 0;
      });
      indexedSortedTypes.add(type);
    }
    if (!bounds.start || !rows.length) return rows.slice();
    const lowerBound = (target, strict) => {
      let low = 0, high = rows.length;
      while (low < high) {
        const middle = (low + high) >>> 1, date = String(rows[middle].date || "");
        if (strict ? date <= target : date < target) low = middle + 1;
        else high = middle;
      }
      return low;
    };
    return rows.slice(lowerBound(bounds.start, false), lowerBound(bounds.end, true));
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
      const id = item.packageId || item.package, current = packages.get(id) || { id, name: item.package, icon: item.icon || "", sales: 0, salesQty: 0, paidQty: 0, freeQty: 0, pageViews: 0, downloads: 0, wishlisted: 0 };
      if (!current.icon && item.icon) current.icon = item.icon;
      current.sales += item.sales; current.salesQty += item.salesQty; current.paidQty += item.paidQty; current.freeQty += item.freeQty;
      current.pageViews += item.pageViews; current.downloads += item.downloads; current.wishlisted += item.wishlisted; current.carted = (current.carted || 0) + item.carted; current.quickLooks = (current.quickLooks || 0) + item.quickLooks;
      packages.set(id, current);
    }
    return [...packages.values()].map(item => ({ ...item, conversion: item.salesQty / (item.pageViews || 1) * 100, revenuePerPageview: item.pageViews ? item.sales / item.pageViews : 0 })).sort((a, b) => b.sales - a.sales);
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

  function bucketEnd(value, interval) {
    const start = bucketStart(value, interval);
    if (interval === "day") return start;
    if (interval === "week") return addDays(start, 6);
    if (interval === "month") return addDays(`${addMonths(start.slice(0, 7), 1)}-01`, -1);
    if (interval === "quarter") return addDays(`${addMonths(start.slice(0, 7), 3)}-01`, -1);
    return `${start.slice(0, 4)}-12-31`;
  }

  function nextBucket(value, interval) {
    if (interval === "day") return addDays(value, 1);
    if (interval === "week") return addDays(value, 7);
    if (interval === "month") return `${addMonths(value.slice(0, 7), 1)}-01`;
    if (interval === "quarter") return `${addMonths(value.slice(0, 7), 3)}-01`;
    return `${Number(value.slice(0, 4)) + 1}-01-01`;
  }

  function bucketSequence(startDate, endDate, interval) {
    const result = []; let bucket = bucketStart(startDate, interval), finalBucket = bucketStart(endDate, interval);
    while (bucket <= finalBucket) { result.push(bucket); bucket = nextBucket(bucket, interval); }
    return result;
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
      if (key) packages.set(key, { key, name: item.name || `Package ${key}`, icon: item.icon || "", revenue: 0 });
    }
    for (const item of allItems) {
      const key = String(item.packageId || "");
      if (!key) continue;
      const current = packages.get(key) || { key, name: item.package || `Package ${key}`, icon: item.icon || "", revenue: 0 };
      if (item.package) current.name = item.package;
      if (!current.icon && item.icon) current.icon = item.icon;
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
        const bucket = buckets.get(key) || { value: 0, revenue: 0, pageViews: 0 };
        if (metric.ratio) { bucket.revenue += toNumber(row.sales); bucket.pageViews += toNumber(row.pageViews); }
        else bucket.value += toNumber(row[metric.field]);
        buckets.set(key, bucket);
      }
      const points = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, bucket]) => [Date.parse(`${date}T00:00:00Z`), metric.ratio ? (bucket.pageViews ? bucket.revenue / bucket.pageViews : 0) : bucket.value]);
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
      const value = toNumber(item[metric.field]);
      if (metric.ratio) {
        const month = current.monthly.get(period) || { value: 0, revenue: 0, pageViews: 0 };
        month.revenue += toNumber(item.sales); month.pageViews += toNumber(item.pageViews); current.monthly.set(period, month);
      } else current.monthly.set(period, (current.monthly.get(period) || 0) + value);
      current.total += value; packages.set(key, current);
    }
    if (metric.ratio) for (const item of packages.values()) {
      const values = [...item.monthly.values()];
      const revenue = values.reduce((sum, value) => sum + value.revenue, 0), pageViews = values.reduce((sum, value) => sum + value.pageViews, 0);
      item.total = pageViews ? revenue / pageViews : 0;
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
      let cumulative = 0, cumulativeViews = 0, points = [];
      if (startPeriod && latestPeriod) {
        points = monthSequence(`${startPeriod}-01`, `${latestPeriod}-01`).map((period, index) => {
          const monthly = item.monthly.get(period) || (metric.ratio ? { revenue: 0, pageViews: 0 } : 0);
          if (metric.ratio) { cumulative += monthly.revenue; cumulativeViews += monthly.pageViews; return [align === "age" ? index : Date.parse(`${period}-01T00:00:00Z`), cumulativeViews ? cumulative / cumulativeViews : 0]; }
          cumulative += monthly;
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
  function overviewViewModel(items, bounds) {
    const interval = automaticInterval(bounds), buckets = new Map();
    for (const item of items) {
      const key = bucketStart(item.date, interval), bucket = buckets.get(key) || { date: key, revenue: 0, pageViews: 0, downloads: 0 };
      bucket.revenue += item.sales; bucket.pageViews += item.pageViews; bucket.downloads += item.downloads; buckets.set(key, bucket);
    }
    return { interval, points: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  }

  function packageTrendViewModel(items, interval, series, currency = false) {
    const buckets = new Map();
    for (const item of items) {
      const date = bucketStart(item.date, interval), bucket = buckets.get(date) || { date };
      for (const entry of series) bucket[entry.field] = (bucket[entry.field] || 0) + toNumber(item[entry.field]);
      buckets.set(date, bucket);
    }
    const points = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
    return { interval, points, series, currency };
  }

  function packageRevenueGrowthViewModel(items, bounds, interval) {
    const datedItems = items.filter(item => item.date).sort((a, b) => a.date.localeCompare(b.date));
    if (!datedItems.length) return { revenuePoints: [], growthPoints: [], latestGrowth: null, hasGrowthHistory: false, domainStart: "", domainEnd: "" };
    const firstDate = datedItems[0].date, latestDate = datedItems.at(-1).date;
    const domainStart = [bounds.start, firstDate].sort().at(-1), domainEnd = [bounds.end, latestDate].sort()[0];
    if (domainStart > domainEnd) return { revenuePoints: [], growthPoints: [], latestGrowth: null, hasGrowthHistory: false, domainStart: "", domainEnd: "" };
    const revenueBetween = (start, end) => datedItems.reduce((sum, item) => item.date >= start && item.date <= end ? sum + toNumber(item.sales) : sum, 0);
    const growthAt = start => {
      const date = bucketEnd(start, interval);
      if (date > latestDate) return { bucket: start, date, trailingRevenue: null, growth: null, growthState: "partial" };
      const currentStart = addDays(addYears(date, -1), 1), previousEnd = addDays(currentStart, -1), previousStart = addDays(addYears(previousEnd, -1), 1);
      if (firstDate > previousStart) return { bucket: start, date, trailingRevenue: null, growth: null, growthState: "insufficient" };
      const trailingRevenue = revenueBetween(currentStart, date), previousRevenue = revenueBetween(previousStart, previousEnd);
      if (previousRevenue > 0) return { bucket: start, date, trailingRevenue, growth: (trailingRevenue - previousRevenue) / previousRevenue * 100, growthState: "available" };
      if (trailingRevenue > 0) return { bucket: start, date, trailingRevenue, growth: null, growthState: "new" };
      return { bucket: start, date, trailingRevenue, growth: 0, growthState: "available" };
    };
    const revenueBuckets = new Map();
    for (const item of datedItems.filter(item => item.date >= bounds.start && item.date <= bounds.end)) {
      const bucket = bucketStart(item.date, interval), current = revenueBuckets.get(bucket) || { bucket, revenue: 0, latestDate: item.date };
      current.revenue += toNumber(item.sales); current.latestDate = [current.latestDate, item.date].sort().at(-1); revenueBuckets.set(bucket, current);
    }
    let cumulativeRevenue = 0;
    const revenuePoints = [...revenueBuckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).map(point => {
      cumulativeRevenue += point.revenue;
      const end = bucketEnd(point.bucket, interval), completeInRange = point.bucket >= bounds.start && end <= bounds.end && end <= latestDate;
      return { ...point, date: completeInRange ? end : point.latestDate, cumulativeRevenue };
    });
    const revenueByBucket = new Map(revenuePoints.map(point => [point.bucket, point]));
    const growthPoints = bucketSequence(domainStart, domainEnd, interval).map(start => {
      const end = bucketEnd(start, interval), completeInRange = start >= bounds.start && end <= bounds.end && end <= latestDate;
      if (completeInRange) return growthAt(start);
      return { bucket: start, date: revenueByBucket.get(start)?.date || [end, bounds.end, latestDate].sort()[0], trailingRevenue: null, growth: null, growthState: "partial" };
    });
    const growthHistory = bucketSequence(firstDate, [bounds.end, latestDate].sort()[0], interval).map(growthAt).filter(point => point.growthState === "available" || point.growthState === "new");
    return { revenuePoints, growthPoints, latestGrowth: growthHistory.at(-1) || null, hasGrowthHistory: growthHistory.length > 0, domainStart, domainEnd };
  }

  function packageRevenueHeatmapViewModel(items) {
    const months = new Map();
    const datedItems = items.filter(item => item.date).sort((a, b) => a.date.localeCompare(b.date));
    for (const item of datedItems) {
      const month = item.date.slice(0, 7);
      months.set(month, (months.get(month) || 0) + toNumber(item.sales));
    }
    const years = [...new Set([...months.keys()].map(month => month.slice(0, 4)))].sort().reverse();
    return { months, years, maximum: Math.max(0, ...months.values()), historyStart: datedItems[0]?.date || "", historyEnd: datedItems.at(-1)?.date || "" };
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
  function calendarViewModel(items, metricKey) {
    const metric = calendarMetric(metricKey), byDate = new Map();
    for (const item of items) {
      const value = byDate.get(item.date) || { value: 0, revenue: 0, pageViews: 0 };
      if (metric.ratio) { value.revenue += toNumber(item.sales); value.pageViews += toNumber(item.pageViews); }
      else value.value += toNumber(item[metric.key]);
      byDate.set(item.date, value);
    }
    const points = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => [date, metric.ratio ? (value.pageViews ? value.revenue / value.pageViews : 0) : value.value]);
    const years = [...new Set(points.map(([date]) => date.slice(0, 4)))];
    const values = points.map(([, value]) => value).filter(value => value > 0).sort((a, b) => a - b);
    const scaleMax = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * .95))] : 1;
    const peak = points.reduce((best, point) => !best || point[1] > best[1] ? point : best, null);
    const totals = [...byDate.values()].reduce((sum, value) => ({ revenue: sum.revenue + value.revenue, pageViews: sum.pageViews + value.pageViews, value: sum.value + value.value }), { revenue: 0, pageViews: 0, value: 0 });
    return { metric, points, years, scaleMax: Math.max(scaleMax, 1), peak, total: metric.ratio ? (totals.pageViews ? totals.revenue / totals.pageViews : 0) : totals.value };
  }

  function assetHeatmapViewModel(items, packageOptions, metricKey) {
    const metric = calendarMetric(metricKey), dates = [...new Set(items.map(item => item.date).filter(Boolean))].sort();
    const assetsByKey = new Map(packageOptions.map(item => [item.key, { key: item.key, name: item.name, total: 0, revenue: 0, pageViews: 0 }]));
    const valuesByCell = new Map();
    for (const item of items) {
      const key = String(item.packageId || item.package || "unknown"), value = Math.max(0, toNumber(item[metric.key]));
      if (!assetsByKey.has(key)) assetsByKey.set(key, { key, name: item.package || `Package ${key}`, total: 0, revenue: 0, pageViews: 0 });
      const asset = assetsByKey.get(key);
      if (metric.ratio) { asset.revenue += toNumber(item.sales); asset.pageViews += toNumber(item.pageViews); }
      else asset.total += value;
      const cellKey = `${key}\u0000${item.date}`;
      const cell = valuesByCell.get(cellKey) || { value: 0, revenue: 0, pageViews: 0 };
      if (metric.ratio) { cell.revenue += toNumber(item.sales); cell.pageViews += toNumber(item.pageViews); }
      else cell.value += value;
      valuesByCell.set(cellKey, cell);
    }
    if (metric.ratio) for (const asset of assetsByKey.values()) asset.total = asset.pageViews ? asset.revenue / asset.pageViews : 0;
    if (metric.ratio) for (const [key, cell] of valuesByCell) valuesByCell.set(key, cell.pageViews ? cell.revenue / cell.pageViews : 0);
    else for (const [key, cell] of valuesByCell) valuesByCell.set(key, cell.value);
    const assets = [...assetsByKey.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const positiveValues = [...valuesByCell.values()].filter(value => value > 0).sort((a, b) => a - b);
    const scaleValue = positiveValues.length ? positiveValues[Math.min(positiveValues.length - 1, Math.floor(positiveValues.length * .97))] : 1;
    const points = [], assetNames = new Map(assets.map(item => [item.key, item.name]));
    let peak = null;
    for (const [cellKey, value] of valuesByCell) {
      const separator = cellKey.indexOf("\u0000"), key = cellKey.slice(0, separator), date = cellKey.slice(separator + 1);
      points.push([date, key, Math.sqrt(value), value]);
      if (!peak || value > peak.value) peak = { key, name: assetNames.get(key) || key, date, value };
    }
    return {
      metric, dates, assets, points, peak,
      total: assets.reduce((sum, asset) => sum + asset.total, 0),
      scaleMax: Math.max(1, Math.sqrt(scaleValue)),
      initialStart: dates[0] || "",
      initialEnd: dates.at(-1) || ""
    };
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
