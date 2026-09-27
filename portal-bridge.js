(() => {
  "use strict";
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const pending = new Map();

  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== "unity-publisher-analytics-api" || message?.type !== "UPA_API_RESPONSE") return;
    const respond = pending.get(message.requestId);
    if (!respond) return;
    pending.delete(message.requestId);
    respond({ ok: message.ok, status: message.status, data: message.data, error: message.error });
  });

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "UPA_PORTAL_API_BRIDGE" || typeof message.requestId !== "string") return false;
    const { requestId, path, method, body } = message;
    pending.set(requestId, sendResponse);
    window.postMessage({ source: "unity-publisher-analytics", type: "UPA_API_REQUEST", requestId, path, method, body }, location.origin);
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      sendResponse({ ok: false, status: 0, error: "The portal request timed out." });
    }, 45000);
    return true;
  });

  extensionApi.runtime.sendMessage({ type: "UPA_PORTAL_READY" }).catch(() => {});
})();
