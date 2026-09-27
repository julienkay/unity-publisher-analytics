(() => {
  "use strict";
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const pending = new Map();

  function profileValue(doc, labelText) {
    const compact = value => String(value ?? "").trim().replace(/\s+/g, " ");
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

  function publisherProfile(doc) {
    const image = doc.querySelector('img[alt="Profile picture"]');
    const name = profileValue(doc, "Profile name"), icon = image?.currentSrc || image?.src || "";
    return name || icon ? { name, icon } : null;
  }

  async function readPublisherProfile() {
    if (location.pathname === "/account/profile") {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const profile = publisherProfile(document);
        if (profile) return profile;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      return null;
    }
    const frame = document.createElement("iframe");
    frame.src = "/account/profile";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(frame);
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
        try {
          const profile = frame.contentDocument && publisherProfile(frame.contentDocument);
          if (profile) return profile;
        } catch { return null; }
      }
      return null;
    } finally { frame.remove(); }
  }

  const ensureLauncher = () => {
    if (!document.documentElement || document.getElementById("upa-portal-launcher")) return;
    const launcher = document.createElement("button");
    launcher.id = "upa-portal-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open Publisher Analytics+");
    launcher.title = "Publisher Analytics+";
    launcher.innerHTML = `<img src="${extensionApi.runtime.getURL("icons/publisher-analytics-128.png")}" alt="">`;
    launcher.addEventListener("click", () => {
      extensionApi.runtime.sendMessage({ type: "UPA_OPEN_ANALYTICS_FROM_PORTAL" }).catch(() => {});
    });
    document.documentElement.appendChild(launcher);
  };
  ensureLauncher();
  new MutationObserver(ensureLauncher).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== "unity-publisher-analytics-api" || message?.type !== "UPA_API_RESPONSE") return;
    const respond = pending.get(message.requestId);
    if (!respond) return;
    pending.delete(message.requestId);
    respond({ ok: message.ok, status: message.status, data: message.data, error: message.error });
  });

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "UPA_PORTAL_PROFILE_BRIDGE") {
      readPublisherProfile()
        .then(profile => sendResponse({ ok: true, profile }))
        .catch(() => sendResponse({ ok: true, profile: null }));
      return true;
    }
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
