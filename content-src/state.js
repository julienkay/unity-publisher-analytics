  const PREFS_KEY_PREFIX = "unityPublisherAnalyticsPrefsV2";
  const PUBLISHER_KEY_PREFIX = "unityPublisherAnalyticsPublisherV2";
  const GROUPS_KEY_PREFIX = "unityPublisherAnalyticsPackageGroupsV1";
  const SYNC_KEY = "apiSyncV1";
  const DAILY_API_MIN_DATE = "2019-01-01";
  const DAILY_API_WINDOW_DAYS = 365;
  const standalone = /^(chrome|moz)-extension:$/.test(location.protocol);
  const portalTabId = Number(new URLSearchParams(location.search).get("portalTabId")) || 0;
  const RANGE_OPTIONS = [
    { id: "all", label: "All time" }, { id: "7d", label: "Last 7 days" }, { id: "30d", label: "Last 30 days" }, { id: "3", label: "Last 3 months" },
    { id: "6", label: "Last 6 months" }, { id: "12", label: "Last 1 year" }, { id: "36", label: "Last 3 years" }, { id: "60", label: "Last 5 years" },
    { id: "mtd", label: "Month to date" }, { id: "ytd", label: "Year to date" }
  ];
  const DASHBOARD_PACKAGE_COLUMNS = ["sales", "revenue", "monthlyAverage", "growth", "conversion", "pageViews", "downloads", "carted", "quickLooks", "revenuePerPageview", "reviews", "reviewsPerSales"];
  const DEFAULT_DASHBOARD_PACKAGE_COLUMNS = DASHBOARD_PACKAGE_COLUMNS.filter(key => !["reviews", "reviewsPerSales", "carted", "quickLooks", "revenuePerPageview"].includes(key));
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
  let prefs = { section: "dashboard", view: "revenue", packageId: "", packageRevenueMode: "cumulative", range: "all", interval: "auto", start: "", end: "", theme: "system", performanceLayout: "grid", performanceScopes: [{ type: "all", id: "all" }], performanceHiddenScopes: [], dashboardPackageColumns: DEFAULT_DASHBOARD_PACKAGE_COLUMNS, dashboardPackageReviewsDefaultOffApplied: true, calendarMetric: "sales", calendarStyle: "calendar", lifetimeMetric: "revenue", lifetimeStyle: "area", lifetimeAlign: "calendar", lifetimeStackDefaultApplied: true, lifetimePackages: [], lifetimeHiddenPackages: [], sankeyPackages: [], sankeyGroupBy: "category", sankeyCategoryDefaultApplied: true };
  let packageGroups = [];
  let groupEditor = null;
  let syncJob = null;
  let isRefreshing = false;
  let isOpen = false;
  let accountMenuOpen = false;
  let publisherIdentity = { id: "", organizationId: "", portalLabel: "", name: "Publisher", icon: "" };
  let publisherIdentityState = "loading";
  let workspaceStage = "identity";
  let workspaceFailure = null;
  let workspaceLoading = false;
  let workspaceRecordsLoaded = 0;
  let publisherConfirmed = false;
  const diagnosticEvents = [];
  let workspaceGeneration = 0;
  let renderQueued = false;
  let isRangePopoverOpen = false;
  let isCustomRangeEditorOpen = false;
  let isPerformanceScopeMenuOpen = false;
  let isDashboardPackageSettingsOpen = false;
  let dashboardPackageRows = [];
  let dashboardChartModels = null;
  let analyticsChartModels = null;
  const chartInstances = new Map();
  const chartResizeObservers = new Map();
  const chartShareMetadata = new Map();
  const pendingApiRequests = new Map();
  const packageIconDataUrls = new Map();
  const packageIconRequests = new Set();
  const packageIconRetryAt = new Map();
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
  const metricValue = (metric, value) => metric.currency ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: metric.ratio ? 2 : 0, maximumFractionDigits: metric.ratio ? 2 : 0 }).format(Number(value) || 0) : number(value);
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
