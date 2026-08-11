const DB_NAME = "unity-publisher-analytics-api";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("records")) {
        const records = db.createObjectStore("records", { keyPath: "id" });
        records.createIndex("type", "type", { unique: false });
        records.createIndex("period", "period", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
  switch (message.type) {
    case "UPA_DB_GET_ALL":
      return transaction("records", "readonly", store => store.getAll());
    case "UPA_DB_PUT_MANY":
      return transaction("records", "readwrite", store => {
        for (const record of message.records || []) store.put(record);
        return { result: (message.records || []).length };
      });
    case "UPA_DB_CLEAR":
      await transaction("records", "readwrite", store => store.clear());
      await transaction("meta", "readwrite", store => store.clear());
      return true;
    case "UPA_DB_GET_META": {
      const value = await transaction("meta", "readonly", store => store.get(message.key));
      return value?.value;
    }
    case "UPA_DB_SET_META":
      return transaction("meta", "readwrite", store => store.put({ key: message.key, value: message.value }));
    default:
      throw new Error(`Unknown database operation: ${message.type}`);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type?.startsWith("UPA_DB_")) return false;
  handleDatabaseMessage(message)
    .then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !tab.url?.startsWith("https://publisher.unity.com/")) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: "UPA_TOGGLE" }); } catch { /* Reload the portal once after installing. */ }
});
