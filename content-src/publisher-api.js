  async function apiJson(path, options = {}) {
    const requestId = crypto.randomUUID(), method = options.method || "GET";
    return new Promise((resolve, reject) => {
      const endpoint = Object.entries(API).find(([, value]) => typeof value === "string" && value === path)?.[0]
        || (/monthly-sales/.test(path) ? "sales" : /monthly-downloads/.test(path) ? "downloads" : "unknown");
      const generation = workspaceGeneration, startedAt = Date.now();
      const timeout = setTimeout(() => {
        pendingApiRequests.delete(requestId);
        if (generation === workspaceGeneration) recordDiagnostic({ kind: "request", endpoint, method, outcome: "timeout", durationMs: Date.now() - startedAt });
        reject(Object.assign(new Error(`Publisher API timed out for ${path.split("?")[0]}.`), { code: "timeout" }));
      }, 45000);
      pendingApiRequests.set(requestId, { resolve, reject, timeout, path, endpoint, method, generation, startedAt });
      if (standalone) {
        extensionApi.runtime.sendMessage({ type: "UPA_PORTAL_API", portalTabId, requestId, path, method, body: options.body })
          .then(response => completeApiResponse({ ...response, requestId }))
          .catch(error => completeApiResponse({ requestId, ok: false, status: 0, error: error.message }));
      } else {
        window.postMessage({ source: "unity-publisher-analytics", type: "UPA_API_REQUEST", requestId, path, method, body: options.body }, location.origin);
      }
    });
  }

  function completeApiResponse(message) {
    const pending = pendingApiRequests.get(message.requestId); if (!pending) return;
    pendingApiRequests.delete(message.requestId); clearTimeout(pending.timeout);
    const shape = Array.isArray(message.data) ? "array" : message.data === null ? "null" : typeof message.data;
    if (pending.generation === workspaceGeneration) recordDiagnostic({ kind: "request", endpoint: pending.endpoint, method: pending.method,
      status: Number(message.status) || 0, outcome: message.ok ? "success" : "failure", durationMs: Date.now() - pending.startedAt, shape,
      ...(pending.endpoint === "user" ? { publisherIdPresent: Boolean(compact(message.data?.publisherId)) } : {}) });
    if (message.ok) pending.resolve(message.data);
    else {
      const detail = typeof message.data === "string" ? compact(message.data).slice(0, 180) : message.data?.message || message.error || "";
      pending.reject(Object.assign(new Error(`Publisher API returned ${message.status || "a network error"} for ${pending.path.split("?")[0]}${detail ? `: ${detail}` : ""}.`), { code: message.status ? "http" : "network" }));
    }
  }

  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== "unity-publisher-analytics-api" || message?.type !== "UPA_API_RESPONSE") return;
    completeApiResponse(message);
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
    const categoriesByIdentifier = new Map(), categoriesByName = new Map(), reviewCountsByPackage = new Map(), iconsByPackage = new Map(), limit = 200;
    let offset = 0;
    while (true) {
      const body = { limit: String(limit), order_by: "name", order: "asc" };
      if (offset) body.offset = String(offset);
      const response = await apiJson(API.packageMetadata, { method: "POST", body });
      const rows = valueFrom(response, ["package_versions", "packageVersions"]);
      if (!Array.isArray(rows) || !rows.length) break;
      for (const item of rows) {
        const packageId = String(valueFrom(item, ["package_id", "packageId"]) || ""), rawRatingCount = valueFrom(item, ["count_ratings"]), ratingCount = Number(rawRatingCount);
        const versionId = String(valueFrom(item, ["id"]) || ""), icon = response.package_key_images?.[versionId]?.icon;
        if (packageId && compact(valueFrom(item, ["status"])).toLowerCase() === "published" && typeof icon === "string" && icon.trim()) {
          const existing = iconsByPackage.get(packageId);
          if (!existing || String(valueFrom(item, ["modified", "status_updated"]) || "") > existing.modified) {
            iconsByPackage.set(packageId, { icon: icon.trim(), modified: String(valueFrom(item, ["modified", "status_updated"]) || "") });
          }
        }
        if (packageId && compact(valueFrom(item, ["status"])).toLowerCase() === "published" && rawRatingCount !== null && rawRatingCount !== undefined && rawRatingCount !== "" && Number.isSafeInteger(ratingCount) && ratingCount >= 0) {
          const existing = reviewCountsByPackage.get(packageId);
          reviewCountsByPackage.set(packageId, existing === undefined ? ratingCount : Math.max(existing, ratingCount));
        }
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
    return { categoriesByIdentifier, categoriesByName, reviewCountsByPackage, iconsByPackage };
  }

  async function fetchPackages() {
    const [raw, categoryRows, metadata] = await Promise.all([apiJson(API.packages), apiJson(API.categories), fetchPackageCategoryMetadata()]);
    const categories = new Map((Array.isArray(categoryRows) ? categoryRows : []).map(item => [String(valueFrom(item, ["id", "category_id", "categoryId"]) || ""), compact(valueFrom(item, ["assetstore_name", "assetstoreName", "name", "title", "category_name", "categoryName"]))]).filter(([id, name]) => id && name));
    return (Array.isArray(raw) ? raw : []).map(item => {
      const id = String(valueFrom(item, ["package_id", "packageId", "id"]) || "");
      const name = valueFrom(item, ["name", "title", "package_name"]) || `Package ${id}`;
      const metadataCategory = metadata.categoriesByIdentifier.get(id) || metadata.categoriesByName.get(compact(name).toLocaleLowerCase());
      const categoryId = String(valueFrom(item, ["category_id", "categoryId"]) || metadataCategory?.id || "");
      return { id, name, categoryId, category: categories.get(categoryId) || packageCategory(item) || metadataCategory?.name || "", firstPublished: parseDate(valueFrom(item, ["first_published_at", "first_published_time", "firstPublishedTime", "first_published"])), reviewCount: metadata.reviewCountsByPackage.get(id) ?? null, icon: metadata.iconsByPackage.get(id)?.icon || "" };
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
