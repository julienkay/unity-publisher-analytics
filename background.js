const DB_NAME = "unity-publisher-analytics-api";
const DB_VERSION = 2;
const ANALYTICS_META_KEYS = ["apiSyncV1"];
const PUBLISHER_PORTAL_URL = "https://publisher.unity.com/";
const OPEN_REQUEST_PREFIX = "upaOpenOnLoad:";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Pre-release schema: old records have no trustworthy owner, so they cannot be migrated.
      if (db.objectStoreNames.contains("records")) db.deleteObjectStore("records");
      if (db.objectStoreNames.contains("meta")) db.deleteObjectStore("meta");
      const records = db.createObjectStore("records", { keyPath: "id" });
      records.createIndex("publisherId", "publisherId", { unique: false });
      records.createIndex("type", "type", { unique: false });
      records.createIndex("period", "period", { unique: false });
      const meta = db.createObjectStore("meta", { keyPath: "id" });
      meta.createIndex("publisherId", "publisherId", { unique: false });
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
    case "UPA_DB_GET_ALL":
      return transaction("records", "readonly", store => store.index("publisherId").getAll(publisherId));
    case "UPA_DB_PUT_MANY":
      return transaction("records", "readwrite", store => {
        for (const record of message.records || []) {
          if (record?.publisherId !== publisherId) throw new Error("A record does not belong to the active publisher.");
          store.put(record);
        }
        return { result: (message.records || []).length };
      });
    case "UPA_DB_CLEAR":
      await transaction("records", "readwrite", store => deletePublisherRows(store, publisherId));
      await transaction("meta", "readwrite", store => {
        for (const key of ANALYTICS_META_KEYS) store.delete(metaId(publisherId, key));
      });
      return true;
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "UPA_CONSUME_OPEN") {
    const key = `${OPEN_REQUEST_PREFIX}${sender.tab?.id}`;
    chrome.storage.session.get(key)
      .then(values => chrome.storage.session.remove(key).then(() => sendResponse({ open: values[key] === true })))
      .catch(() => sendResponse({ open: false }));
    return true;
  }
  if (!message?.type?.startsWith("UPA_DB_")) return false;
  handleDatabaseMessage(message)
    .then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  if (tab.url?.startsWith(PUBLISHER_PORTAL_URL)) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "UPA_TOGGLE" }); } catch { /* Reload the portal once after installing. */ }
    return;
  }
  const portalTab = await chrome.tabs.create({ url: "about:blank" });
  if (!portalTab.id) return;
  const key = `${OPEN_REQUEST_PREFIX}${portalTab.id}`;
  await chrome.storage.session.set({ [key]: true });
  try { await chrome.tabs.update(portalTab.id, { url: PUBLISHER_PORTAL_URL }); }
  catch (error) { await chrome.storage.session.remove(key); throw error; }
});
