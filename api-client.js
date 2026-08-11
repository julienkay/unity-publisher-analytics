(() => {
  "use strict";
  if (window.__upaApiClientInstalled) return;
  window.__upaApiClientInstalled = true;

  function cookieValue(name) {
    const prefix = `${encodeURIComponent(name)}=`;
    const match = document.cookie.split(";").map(item => item.trim()).find(item => item.startsWith(prefix));
    if (!match) return "";
    try { return decodeURIComponent(match.slice(prefix.length)); } catch { return match.slice(prefix.length); }
  }

  function allowedRequest(path, method, body) {
    let url;
    try { url = new URL(path, location.origin); } catch { return false; }
    if (url.origin !== location.origin) return false;
    if (url.pathname === "/publisher-v2-api/proxy" && method === "GET") {
      return ["/management/once-published-packages", "/management/categories"].includes(url.searchParams.get("path")) && url.searchParams.get("type") === "array";
    }
    if (url.pathname === "/publisher-v2-api/management/packages" && method === "POST") {
      const keys = Object.keys(body || {}), allowedKeys = ["limit", "offset", "order_by", "order"];
      return body && typeof body === "object" && keys.every(key => allowedKeys.includes(key))
        && /^\d+$/.test(body.limit || "") && Number(body.limit) > 0 && Number(body.limit) <= 200
        && (body.offset === undefined || /^\d+$/.test(body.offset))
        && body.order_by === "name" && body.order === "asc";
    }
    if (/^\/publisher-v2-api\/monthly-(sales|downloads)$/.test(url.pathname) && method === "GET") return /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "");
    if (url.pathname === "/publisher-v2-api/publisher-revenues" && method === "GET") return true;
    if (url.pathname === "/publisher-v2-api/dashboard/daily" && method === "POST") {
      return body && typeof body === "object" && typeof body.start_date === "string" && typeof body.end_date === "string" && Array.isArray(body.package_ids) && body.package_ids.length <= 1 && body.package_ids.every(value => typeof value === "string" && /^\d+$/.test(value));
    }
    return false;
  }

  window.addEventListener("message", async event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== "unity-publisher-analytics" || message?.type !== "UPA_API_REQUEST") return;
    const { requestId, path, method = "GET", body } = message;
    if (typeof requestId !== "string" || !allowedRequest(path, method, body)) return;
    try {
      const options = { method, credentials: "include", headers: {
        "Content-Type": "application/json",
        "X-Csrf-Token": cookieValue("_csrf"),
        "X-Source": "publisher-portal"
      } };
      if (body !== undefined) options.body = JSON.stringify(body);
      const response = await fetch(path, options);
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      window.postMessage({ source: "unity-publisher-analytics-api", type: "UPA_API_RESPONSE", requestId, ok: response.ok, status: response.status, data }, location.origin);
    } catch (error) {
      window.postMessage({ source: "unity-publisher-analytics-api", type: "UPA_API_RESPONSE", requestId, ok: false, status: 0, error: error.message }, location.origin);
    }
  });
})();
