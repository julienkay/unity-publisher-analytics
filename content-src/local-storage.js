  async function database(message) {
    const generation = workspaceGeneration;
    try {
      const response = await extensionApi.runtime.sendMessage(message);
      if (!response?.ok) throw new Error(response?.error || "The local analytics database is unavailable.");
      return response.result;
    } catch (error) {
      if (generation === workspaceGeneration) recordDiagnostic({ kind: "storage", operation: message.type, ...failureDetails(error) });
      throw error;
    }
  }

  async function getAll(publisherId = publisherIdentity.id) {
    const tracePerformance = globalThis.__UPA_PERF_TRACE === true;
    const loadStartedAt = tracePerformance ? performance.now() : 0;
    const generation = workspaceGeneration;
    const rows = standalone ? await readPublisherRecords(publisherId) : await database({ type: "UPA_DB_GET_RECORDS_PAGE", publisherId }).then(page => page.rows);
    if (!ownsWorkspace(publisherId, generation)) throw new Error("The publisher workspace changed while records were loading.");
    workspaceRecordsLoaded = rows.length;
    recordDiagnostic({ kind: "storage", operation: "load-records", count: rows.length });
    if (tracePerformance) console.info("[UPA performance] record load", { totalMs: performance.now() - loadStartedAt, records: rows.length });
    return rows;
  }
  async function readPublisherRecords(publisherId) {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("unity-publisher-analytics-api");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readonly");
        const request = tx.objectStore("records").index("publisherId").getAll(IDBKeyRange.only(publisherId));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.onabort = () => reject(tx.error || new Error("The saved record read was aborted."));
      });
    } finally { db.close(); }
  }
  const putMany = (rows, publisherId = publisherIdentity.id) => rows.length ? database({ type: "UPA_DB_PUT_MANY", publisherId, records: rows }) : Promise.resolve(0);
  const getMeta = (key, publisherId = publisherIdentity.id) => database({ type: "UPA_DB_GET_META", publisherId, key });
  const setMeta = (key, value, publisherId = publisherIdentity.id) => database({ type: "UPA_DB_SET_META", publisherId, key, value });
  const clearPublisherData = async (publisherId = publisherIdentity.id) => {
    const result = await database({ type: "UPA_DB_CLEAR", publisherId });
    if (publisherId === publisherIdentity.id) {
      packageIconDataUrls.clear();
      for (const key of packageIconRetryAt.keys()) if (key.startsWith(`${publisherId}\u0000`)) packageIconRetryAt.delete(key);
    }
    return result;
  };

  function cachedIconKey(packageId, url, publisherId = publisherIdentity.id) { return `${publisherId}\u0000${packageId}\u0000${url}`; }

  function packageIconUrl(value) {
    const icon = typeof value === "string" ? value.trim() : "";
    try {
      const parsed = new URL(icon.startsWith("//") ? `https:${icon}` : icon, location.href);
      if (parsed.protocol === "https:" && parsed.hostname === "assetstorev1-prd-cdn.unity3d.com") return { url: parsed.href, cacheable: true };
      if (location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(location.hostname) && parsed.origin === location.origin && parsed.pathname.startsWith("/scripts/marketing-assets/package-icons/")) {
        return { url: parsed.href, cacheable: false };
      }
    } catch { /* A malformed or untrusted URL uses the letter fallback. */ }
    return null;
  }

  function hydrateVisiblePackageIcons() {
    if (!publisherIdentity.id) return;
    const generation = workspaceGeneration;
    const pending = new Map();
    for (const wrapper of document.querySelectorAll("#upa-root .upa-package-icon-pending[data-package-icon-id][data-package-icon-url]")) {
      const packageId = wrapper.dataset.packageIconId, url = wrapper.dataset.packageIconUrl, key = cachedIconKey(packageId, url);
      if (packageIconDataUrls.has(key) || packageIconRequests.has(key) || (packageIconRetryAt.get(key) || 0) > Date.now()) continue;
      pending.set(packageId, { url, key });
    }
    if (!pending.size) return;
    for (const { key } of pending.values()) { packageIconRequests.add(key); packageIconRetryAt.set(key, Date.now() + 60000); }
    const publisherId = publisherIdentity.id;
    database({ type: "UPA_DB_CACHE_PACKAGE_ICONS", publisherId, items: [...pending].map(([packageId, item]) => ({ packageId, url: item.url })) })
      .then(icons => {
        if (!ownsWorkspace(publisherId, generation)) return;
        for (const icon of icons || []) {
          const item = pending.get(icon.packageId);
          if (!item || item.url !== icon.url || typeof icon.dataUrl !== "string" || !icon.dataUrl.startsWith("data:image/")) continue;
          packageIconDataUrls.set(item.key, icon.dataUrl);
          packageIconRetryAt.delete(item.key);
          for (const wrapper of document.querySelectorAll("#upa-root .upa-package-icon-pending[data-package-icon-id][data-package-icon-url]")) {
            if (wrapper.dataset.packageIconId !== icon.packageId || wrapper.dataset.packageIconUrl !== icon.url) continue;
            const image = document.createElement("img");
            image.alt = ""; image.loading = "lazy"; image.src = icon.dataUrl;
            wrapper.replaceChildren(image); wrapper.classList.remove("upa-package-icon-pending"); wrapper.classList.add("upa-package-icon-wrap");
          }
        }
      })
      .catch(() => { /* Missing or unavailable icons keep the letter fallback. */ })
      .finally(() => {
        for (const { key } of pending.values()) packageIconRequests.delete(key);
        if (publisherIdentity.id === publisherId) hydrateVisiblePackageIcons();
      });
  }

  async function cacheDiscoveredPackageIcons(packages, publisherId, generation) {
    const items = (packages || []).map(item => ({ packageId: String(item.id || "").trim(), url: packageIconUrl(item.icon) }))
      .filter(item => item.packageId && item.url?.cacheable).map(item => ({ packageId: item.packageId, url: item.url.url }));
    for (let offset = 0; offset < items.length; offset += 30) {
      if (!ownsWorkspace(publisherId, generation)) return;
      const batch = items.slice(offset, offset + 30).map(item => ({ ...item, key: cachedIconKey(item.packageId, item.url, publisherId) })).filter(item => {
        const key = item.key;
        if (packageIconDataUrls.has(key) || packageIconRequests.has(key) || (packageIconRetryAt.get(key) || 0) > Date.now()) return false;
        packageIconRequests.add(key);
        return true;
      });
      if (!batch.length) continue;
      let cached = false;
      try {
        await database({ type: "UPA_DB_CACHE_PACKAGE_ICONS", publisherId, items: batch, returnDataUrls: false });
        cached = true;
        if (!ownsWorkspace(publisherId, generation)) return;
      } catch { /* Icon caching is optional; each package keeps its letter fallback. */ }
      finally {
        for (const item of batch) {
          packageIconRequests.delete(item.key);
          if (!cached) packageIconRetryAt.set(item.key, Date.now() + 60000);
        }
        if (publisherIdentity.id === publisherId) hydrateVisiblePackageIcons();
      }
    }
  }
