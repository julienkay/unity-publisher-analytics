const extensionApi = globalThis.browser ?? globalThis.chrome;
const DB_NAME = "unity-publisher-analytics-api";
const DB_VERSION = 3;
const ANALYTICS_META_KEYS = ["apiSyncV1"];
const PUBLISHER_PORTAL_URL = "https://publisher.unity.com/";
const PACKAGE_ICON_CDN_HOST = "assetstorev1-prd-cdn.unity3d.com";
const PACKAGE_ICON_MAX_BYTES = 2 * 1024 * 1024;
const PACKAGE_ICON_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const publisherIconCacheEpoch = new Map();
const OPEN_REQUEST_PREFIX = "upaOpenOnLoad:";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = request.result;
      // The pre-release v1 schema had no trustworthy owner, so discard it once.
      if (event.oldVersion > 0 && event.oldVersion < 2) {
        if (db.objectStoreNames.contains("records")) db.deleteObjectStore("records");
        if (db.objectStoreNames.contains("meta")) db.deleteObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("records")) {
        const records = db.createObjectStore("records", { keyPath: "id" });
        records.createIndex("publisherId", "publisherId", { unique: false });
        records.createIndex("type", "type", { unique: false });
        records.createIndex("period", "period", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        const meta = db.createObjectStore("meta", { keyPath: "id" });
        meta.createIndex("publisherId", "publisherId", { unique: false });
      }
      if (!db.objectStoreNames.contains("icons")) {
        const icons = db.createObjectStore("icons", { keyPath: "id" });
        icons.createIndex("publisherId", "publisherId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function publisherIdFrom(message) {
  const publisherId = String(message?.publisherId || "").trim();
  if (!publisherId) throw new Error("A publisher identity is required for local data access.");
  return publisherId;
}

function metaId(publisherId, key) {
  return JSON.stringify([publisherId, String(key || "")]);
}

function packageIconId(publisherId, packageId) {
  return JSON.stringify([publisherId, packageId]);
}

function validPackageIconUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === PACKAGE_ICON_CDN_HOST && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

function packageIconDataUrl(buffer, contentType) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function cachePackageIcons(message, publisherId) {
  const epoch = publisherIconCacheEpoch.get(publisherId) || 0;
  const requested = new Map();
  for (const item of Array.isArray(message.items) ? message.items.slice(0, 30) : []) {
    const packageId = String(item?.packageId || "").trim(), url = validPackageIconUrl(item?.url);
    if (packageId && url) requested.set(packageId, url);
  }
  if (!requested.size) return [];

  const db = await openDatabase();
  let cached;
  try {
    cached = await new Promise((resolve, reject) => {
      const tx = db.transaction("icons", "readonly"), store = tx.objectStore("icons"), values = new Map();
      for (const [packageId, url] of requested) {
        const request = store.get(packageIconId(publisherId, packageId));
        request.onsuccess = () => values.set(packageId, request.result?.url === url ? request.result : null);
      }
      tx.oncomplete = () => resolve(values);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Icon cache read aborted."));
    });
  } finally { db.close(); }

  const output = await Promise.all([...requested].map(async ([packageId, url]) => {
    const existing = cached.get(packageId);
    if (existing?.dataUrl) return { packageId, url, dataUrl: existing.dataUrl };
    try {
      const response = await fetch(url, { credentials: "omit", redirect: "error", cache: "default" });
      if (!response.ok) throw new Error(`Icon request returned ${response.status}.`);
      const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!PACKAGE_ICON_CONTENT_TYPES.has(contentType)) throw new Error("The icon response was not a supported image.");
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength || buffer.byteLength > PACKAGE_ICON_MAX_BYTES) throw new Error("The icon response size was invalid.");
      return { packageId, url, dataUrl: packageIconDataUrl(buffer, contentType) };
    } catch {
      return existing?.url === url && existing.dataUrl ? { packageId, url, dataUrl: existing.dataUrl } : null;
    }
  }));
  const rows = output.filter(Boolean).map(item => ({
    id: packageIconId(publisherId, item.packageId), publisherId, packageId: item.packageId,
    url: item.url, dataUrl: item.dataUrl, capturedAt: new Date().toISOString()
  }));
  if (!rows.length || (publisherIconCacheEpoch.get(publisherId) || 0) !== epoch) return [];
  await transaction("icons", "readwrite", store => {
    for (const row of rows) store.put(row);
    return { result: rows.length };
  });
  if (message.returnDataUrls === false) return [];
  return rows.map(({ packageId, url, dataUrl }) => ({ packageId, url, dataUrl }));
}

function deletePublisherRows(store, publisherId) {
  const request = store.index("publisherId").openKeyCursor(IDBKeyRange.only(publisherId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    store.delete(cursor.primaryKey);
    cursor.continue();
  };
  return request;
}

async function transaction(storeName, mode, operation) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = operation(store);
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Database transaction aborted."));
    });
  } finally {
    db.close();
  }
}

async function handleDatabaseMessage(message) {
  const publisherId = publisherIdFrom(message);
  switch (message.type) {
    case "UPA_DB_PUT_MANY":
      return transaction("records", "readwrite", store => {
        for (const record of message.records || []) {
          if (record?.publisherId !== publisherId) throw new Error("A record does not belong to the active publisher.");
          store.put(record);
        }
        return { result: (message.records || []).length };
      });
    case "UPA_DB_CLEAR":
      publisherIconCacheEpoch.set(publisherId, (publisherIconCacheEpoch.get(publisherId) || 0) + 1);
      await transaction("records", "readwrite", store => deletePublisherRows(store, publisherId));
      await transaction("icons", "readwrite", store => deletePublisherRows(store, publisherId));
      await transaction("meta", "readwrite", store => {
        for (const key of ANALYTICS_META_KEYS) store.delete(metaId(publisherId, key));
      });
      return true;
    case "UPA_DB_CACHE_PACKAGE_ICONS":
      return cachePackageIcons(message, publisherId);
    case "UPA_DB_GET_META": {
      const value = await transaction("meta", "readonly", store => store.get(metaId(publisherId, message.key)));
      return value?.value;
    }
    case "UPA_DB_SET_META":
      return transaction("meta", "readwrite", store => store.put({ id: metaId(publisherId, message.key), publisherId, key: message.key, value: message.value }));
    default:
      throw new Error(`Unknown database operation: ${message.type}`);
  }
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "UPA_OPEN_ANALYTICS_FROM_PORTAL") {
    const tabId = sender.tab?.id;
    if (!tabId || !sender.tab.url || new URL(sender.tab.url).origin !== "https://publisher.unity.com") return false;
    extensionApi.tabs.create({ url: extensionApi.runtime.getURL(`analytics.html?portalTabId=${tabId}`) })
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "UPA_PORTAL_READY") {
    const tabId = sender.tab?.id;
    if (!tabId) return false;
    const key = `${OPEN_REQUEST_PREFIX}${tabId}`;
    extensionApi.storage.session.get(key).then(async values => {
      if (values[key] !== true) return;
      await extensionApi.storage.session.remove(key);
      await extensionApi.tabs.create({ url: extensionApi.runtime.getURL(`analytics.html?portalTabId=${tabId}`) });
    }).catch(() => {});
    return false;
  }
  if (message?.type === "UPA_PORTAL_API") {
    const extensionRoot = extensionApi.runtime.getURL("");
    if (!sender.url?.startsWith(extensionRoot)) { sendResponse({ ok: false, status: 0, error: "Invalid analytics page." }); return false; }
    const portalTabId = Number(message.portalTabId);
    extensionApi.tabs.get(portalTabId).then(tab => {
      if (!tab?.url || new URL(tab.url).origin !== "https://publisher.unity.com") throw new Error("Open Publisher Portal in a signed-in tab to make requests.");
      return extensionApi.tabs.sendMessage(portalTabId, {
        type: "UPA_PORTAL_API_BRIDGE", requestId: message.requestId, path: message.path,
        method: message.method, body: message.body
      });
    }).then(sendResponse).catch(error => sendResponse({ ok: false, status: 0, error: error.message }));
    return true;
  }
  if (message?.type === "UPA_FOCUS_PORTAL") {
    const extensionRoot = extensionApi.runtime.getURL("");
    if (!sender.url?.startsWith(extensionRoot)) return false;
    extensionApi.tabs.update(Number(message.portalTabId), { active: true }).then(tab => extensionApi.windows.update(tab.windowId, { focused: true })).catch(() => {});
    return false;
  }
  if (message?.type === "UPA_CONSUME_OPEN") {
    const key = `${OPEN_REQUEST_PREFIX}${sender.tab?.id}`;
    extensionApi.storage.session.get(key)
      .then(values => extensionApi.storage.session.remove(key).then(() => sendResponse({ open: values[key] === true })))
      .catch(() => sendResponse({ open: false }));
    return true;
  }
  if (!message?.type?.startsWith("UPA_DB_")) return false;
  handleDatabaseMessage(message)
    .then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

extensionApi.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  if (tab.url?.startsWith(PUBLISHER_PORTAL_URL)) {
    await extensionApi.tabs.create({ url: extensionApi.runtime.getURL(`analytics.html?portalTabId=${tab.id}`) });
    return;
  }
  const portalTab = await extensionApi.tabs.create({ url: "about:blank" });
  if (!portalTab.id) return;
  const key = `${OPEN_REQUEST_PREFIX}${portalTab.id}`;
  await extensionApi.storage.session.set({ [key]: true });
  try { await extensionApi.tabs.update(portalTab.id, { url: PUBLISHER_PORTAL_URL }); }
  catch (error) { await extensionApi.storage.session.remove(key); throw error; }
});
