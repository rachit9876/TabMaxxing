// TabMaxxing - Background Service Worker
const DEFAULTS = {
  mediaBlockEnabled: false, mediaInvertEnabled: false, mediaBlurEnabled: false,
  mediaHoverEnabled: false, mediaUniformEnabled: false, forceRightClickEnabled: false,
  stableVolumeEnabled: false, monoAudioEnabled: false, smoothVolumeEnabled: false, darkModeEnabled: false, targetImgEnabled: true, targetVidEnabled: true,
  blurIntensity: 25, blurMode: "blur", audioEqMode: "stable", audioLufs: "-12",
  shortcutAction: "toggle_blur", browserLockEnabled: false, browserLockPassword: "", urlHistory: [],
  textSpoofingEnabled: false, textSpoofingSeed: "mediablock",
  domainLockEnabled: false, lockedDomains: [],
  mediaDlEnabled: false,
  adBlockMode: 0 // 0 = Off, 1 = Basic (DNR), 2 = Optimal (DNR + Specific Cosmetic), 3 = Complete (Optimal + Generic Cosmetic)
  // NOTE: mediaBucket is deliberately NOT part of DEFAULTS / GET_ALL_STATE.
  // It can grow to hundreds of MB of base64 payloads; the popup reads it
  // separately (chrome.storage.local.get) only when the bucket gallery opens.
};

// Search engine endpoints for context menu and snippet area visual search.
// Google Lens requires the "uploadbyurl" deep link; "upload?url=" only opens
// the generic upload page without searching the provided URL.
const ENGINES = {
  google: { name: "Google", url: "https://lens.google.com/uploadbyurl?url=" },
  yandex: { name: "Yandex", url: "https://yandex.com/images/search?rpt=imageview&url=" },
  tineye: { name: "TinEye", url: "https://www.tineye.com/search/?url=" }
};

let latestCapturePayload = null;

// Persist the capture payload so the viewer can still read it after the MV3
// service worker has been terminated and restarted (storage.session survives
// SW restarts and is cleared when the browser closes). The capture viewer is
// an extension page (trusted context), so the default access level applies.
const CAPTURE_PAYLOAD_KEY = "latestCapturePayload";

async function saveCapturePayload(payload) {
  latestCapturePayload = payload;
  try {
    if (chrome.storage.session) {
      await chrome.storage.session.set({ [CAPTURE_PAYLOAD_KEY]: payload });
    }
  } catch (err) {
    // Payload can exceed the session quota on very long pages; the in-memory
    // copy above still covers the normal "viewer opens right away" flow.
    agenticLog("CAPTURE", "storage.session write failed (payload too large?), relying on in-memory copy", String(err));
  }
}

async function loadCapturePayload() {
  try {
    if (chrome.storage.session) {
      const res = await chrome.storage.session.get(CAPTURE_PAYLOAD_KEY);
      if (res && res[CAPTURE_PAYLOAD_KEY]) return res[CAPTURE_PAYLOAD_KEY];
    }
  } catch (_) {}
  return latestCapturePayload;
}

// Global Agentic Live Debug Tunnel & Logger
const AGENTIC_LOGS = [];
let agenticLogFlushTimer = null;
function agenticLog(category, ...args) {
  const entry = `[${new Date().toISOString()}] [${category}] ${args.map(a => {
    if (a instanceof Error) return `${a.message}\n${a.stack}`;
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch (_) { return String(a); }
    }
    return String(a);
  }).join(' ')}`;
  AGENTIC_LOGS.unshift(entry);
  if (AGENTIC_LOGS.length > 250) AGENTIC_LOGS.pop();
  // Debounced persistence: busy pages can emit dozens of errors per second and
  // writing chrome.storage on each one starves the storage backend.
  if (agenticLogFlushTimer) return;
  agenticLogFlushTimer = setTimeout(() => {
    agenticLogFlushTimer = null;
    chrome.storage.local.set({ agenticDebugLogs: AGENTIC_LOGS }).catch(() => {});
  }, 1000);
}

self.addEventListener('error', (e) => {
  agenticLog('SW_UNCAUGHT_ERROR', e.message || 'Unknown Service Worker Error', e.filename, e.lineno, e.colno, e.error);
});

self.addEventListener('unhandledrejection', (e) => {
  agenticLog('SW_UNHANDLED_REJECTION', e.reason?.message || String(e.reason), e.reason?.stack || '');
});

async function hashPassword(password) {
  if (!password) return "";
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function init() {
  // Legacy migration: adBlockEnabled (boolean) -> adBlockMode (number).
  // Must inspect raw storage WITHOUT defaults, otherwise adBlockMode always
  // looks present (as the default 0) and the migration never runs.
  // The legacy key is intentionally NOT deleted afterwards: deleting it would
  // emit a second storage-changed event (adBlockEnabled -> undefined) that the
  // cosmetic engine would misread as "mode 0". Since every reader prefers the
  // numeric adBlockMode, the stale boolean simply becomes inert.
  try {
    const stored = await chrome.storage.local.get(null);
    const patch = {};
    if (typeof stored.adBlockMode !== "number" && "adBlockEnabled" in stored) {
      patch.adBlockMode = stored.adBlockEnabled ? 1 : 0;
    }
    if (typeof stored.adBlockMode !== "number" && !("adBlockEnabled" in stored)) {
      patch.adBlockMode = 0;
    }
    if (Object.keys(patch).length) {
      await chrome.storage.local.set(patch);
    }
  } catch (_) {}
  await updateDNR();
  await updateBadge();
}

init();

const ADBLOCK_RULESETS = [
  "ublock-filters",
  "easylist",
  "easyprivacy",
  "pgl",
  "ublock-badware",
  "urlhaus-full"
];

async function updateDNR() {
  try {
    const data = await chrome.storage.local.get(['mediaBlockEnabled', 'targetImgEnabled', 'targetVidEnabled', 'adBlockMode', 'adBlockEnabled']);
    const blockOn = Boolean(data.mediaBlockEnabled);
    const mode = typeof data.adBlockMode === 'number' ? data.adBlockMode : (data.adBlockEnabled ? 1 : 0);
    const adBlockOn = mode >= 1;
    
    const enableRulesetIds = [];
    if (adBlockOn) {
      enableRulesetIds.push(...ADBLOCK_RULESETS);
    }
    if (blockOn && data.targetImgEnabled !== false) enableRulesetIds.push("block_images");
    if (blockOn && data.targetVidEnabled !== false) enableRulesetIds.push("block_videos");
    
    const allRegistered = [...ADBLOCK_RULESETS, "block_images", "block_videos"];
    const disableRulesetIds = allRegistered.filter(id => !enableRulesetIds.includes(id));
    
    await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds, disableRulesetIds });
  } catch (error) {
    console.error("TabMaxxing: DNR Update Failed", error);
  }
}

async function updateBadge() {
  try {
    const data = await chrome.storage.local.get(['browserLockEnabled', 'adBlockMode', 'adBlockEnabled', 'mediaBlockEnabled', 'mediaBlurEnabled', 'mediaInvertEnabled', 'mediaUniformEnabled', 'textSpoofingEnabled', 'darkModeEnabled', 'stableVolumeEnabled', 'monoAudioEnabled', 'smoothVolumeEnabled', 'forceRightClickEnabled', 'mediaHoverEnabled']);
    
    if (data.browserLockEnabled) {
      // Chrome badges do not render color emoji reliably; use plain text.
      chrome.action.setBadgeText({ text: "LOCK" });
      chrome.action.setBadgeBackgroundColor({ color: [220, 38, 38, 255] });
      return;
    }

    const activeEmojis = [];
    const mode = typeof data.adBlockMode === 'number' ? data.adBlockMode : (data.adBlockEnabled ? 1 : 0);
    
    if (mode >= 1) activeEmojis.push("🛡️");
    if (data.mediaBlockEnabled) activeEmojis.push("🛑");
    if (data.mediaBlurEnabled) activeEmojis.push("💧");
    if (data.mediaInvertEnabled) activeEmojis.push("☯️");
    if (data.mediaUniformEnabled) activeEmojis.push("🔲");
    if (data.textSpoofingEnabled) activeEmojis.push("Tx");
    
    if (data.darkModeEnabled) activeEmojis.push("🌙");
    if (data.stableVolumeEnabled) activeEmojis.push("🔊");
    if (data.monoAudioEnabled) activeEmojis.push("🎧");
    if (data.smoothVolumeEnabled) activeEmojis.push("📈");
    if (data.forceRightClickEnabled) activeEmojis.push("🔓");
    if (data.mediaHoverEnabled) activeEmojis.push("👁️");

    const text = activeEmojis.slice(0, 4).join("");

    chrome.action.setBadgeText({ text: text || "" });
    chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
    
  } catch (error) {
    console.error("TabMaxxing: Badge Update Failed", error);
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.mediaBlockEnabled || changes.targetImgEnabled || changes.targetVidEnabled || changes.adBlockMode || changes.adBlockEnabled) {
      updateDNR();
    }
    updateBadge();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Wrap sendResponse so a closed message port (popup closed, tab navigated)
  // never throws "Attempting to use a disconnected port object".
  const safeSendResponse = (payload) => {
    try { sendResponse(payload); } catch (_) {}
  };

  // Cross-origin image fetcher (bypasses page CORS to fetch full-resolution assets)
  if (message.action === "FETCH_IMAGE_BASE64") {
    if (!message.url) {
      safeSendResponse({ success: false, error: "No URL provided" });
      return false;
    }
    (async () => {
      try {
        let res = await fetch(message.url, { method: "GET", cache: "force-cache" });
        if (!res.ok) res = await fetch(message.url, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => safeSendResponse({ success: true, base64: reader.result, type: blob.type });
        reader.onerror = () => safeSendResponse({ success: false, error: "Read failed" });
        reader.readAsDataURL(blob);
      } catch (err) {
        safeSendResponse({ success: false, error: String(err) });
      }
    })();
    return true;
  }

  // Log Media Item to Persistent Client-Side Bucket
  if (message.action === "LOG_MEDIA_TO_BUCKET") {
    (async () => {
      try {
        const item = message.media;
        if (!item) {
          safeSendResponse({ success: false, error: "No media provided" });
          return;
        }
        const store = await chrome.storage.local.get({ mediaBucket: [] });
        let bucket = Array.isArray(store.mediaBucket) ? store.mediaBucket : [];

        // Deduplicate by URL, or by (length + tail) signature of the payload.
        // Comparing the HEAD of two base64 strings is unreliable: all images
        // from the same encoder share identical JPEG headers, which produced
        // false "Already in Bucket" hits on unrelated photos.
        const isDuplicate = bucket.some(b => {
          if (b.url && item.url && b.url === item.url) return true;
          if (b.base64 && item.base64 && b.base64.length === item.base64.length) {
            return b.base64.slice(-160) === item.base64.slice(-160);
          }
          return false;
        });
        if (isDuplicate) {
          safeSendResponse({ success: true, status: "exists", count: bucket.length });
          return;
        }

        bucket.unshift({
          id: `mb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          url: item.url || "",
          base64: item.base64 || "",
          width: item.width || 0,
          height: item.height || 0,
          alt: item.alt || "Logged Image",
          pageUrl: item.pageUrl || "",
          date: Date.now()
        });

        // Cap bucket size at 80 items so storage doesn't exceed quota
        if (bucket.length > 80) bucket = bucket.slice(0, 80);
        await chrome.storage.local.set({ mediaBucket: bucket });
        safeSendResponse({ success: true, count: bucket.length });
      } catch (e) {
        safeSendResponse({ success: false, error: String(e) });
      }
    })();
    return true;
  }

  // Live Debug Logging Relay from Content Scripts
  if (message.action === "AGENTIC_LOG") {
    agenticLog(message.category || "CONTENT", ...(message.logs || []));
    safeSendResponse({ success: true });
    return true;
  }

  // Clear both the in-memory ring buffer and the persisted copy. Clearing only
  // chrome.storage from the options page would be undone by the next debounced
  // flush, which always re-writes the full in-memory AGENTIC_LOGS array.
  if (message.action === "CLEAR_AGENTIC_LOGS") {
    AGENTIC_LOGS.length = 0;
    if (agenticLogFlushTimer) {
      clearTimeout(agenticLogFlushTimer);
      agenticLogFlushTimer = null;
    }
    chrome.storage.local.set({ agenticDebugLogs: [] }).catch(() => {});
    safeSendResponse({ success: true });
    return true;
  }

  // Universal Media Downloader API. Serves the content-script hover overlay
  // and the popup bucket gallery.
  if (message.action === "DOWNLOAD_MEDIA") {
    // Filenames arrive from content scripts; strip any path components and
    // characters that are illegal in download paths before handing them to
    // the downloads API.
    const sanitizeFilename = (name) => {
      const base = String(name || "tabmaxxing_media").split(/[\\/]/).pop() || "tabmaxxing_media";
      const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
      return cleaned || "tabmaxxing_media";
    };
    const filename = sanitizeFilename(message.filename || "tabmaxxing_media.jpg");
    let rawUrl = message.url || "";
    const cleanUrl = rawUrl.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/["'\\].*$/, '').trim();

    agenticLog("DOWNLOAD", "Initiating download for:", cleanUrl, "Filename:", filename);

    const startDownload = (downloadUrl) => {
      chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        conflictAction: "uniquify",
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          agenticLog("DOWNLOAD_ERROR", chrome.runtime.lastError.message);
          safeSendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          agenticLog("DOWNLOAD_SUCCESS", "Started Download ID:", downloadId);
          safeSendResponse({ success: true, downloadId });
        }
      });
    };

    // data: URLs larger than ~2MB are rejected by the downloads API. The usual
    // workaround (blob: URL) is unavailable because URL.createObjectURL does
    // not exist in MV3 service workers, so attempt it only when the API is
    // present and otherwise fall back to the raw data: URL.
    if (cleanUrl.startsWith("data:")) {
      (async () => {
        let downloadUrl = cleanUrl;
        let blobUrl = null;
        try {
          if (typeof URL.createObjectURL === "function") {
            const blob = await (await fetch(cleanUrl)).blob();
            blobUrl = URL.createObjectURL(blob);
            downloadUrl = blobUrl;
          }
        } catch (err) {
          agenticLog("DOWNLOAD", "Blob conversion unavailable, using data URL directly", String(err));
          downloadUrl = cleanUrl;
        }
        chrome.downloads.download({
          url: downloadUrl,
          filename: filename,
          conflictAction: "uniquify",
          saveAs: false
        }, (downloadId) => {
          if (blobUrl) setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (_) {} }, 120000);
          if (chrome.runtime.lastError) {
            agenticLog("DOWNLOAD_ERROR", chrome.runtime.lastError.message);
            safeSendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            agenticLog("DOWNLOAD_SUCCESS", "Data URL download ID:", downloadId);
            safeSendResponse({ success: true, downloadId });
          }
        });
      })();
      return true;
    }

    // Direct native browser download for signed CDN URLs
    startDownload(cleanUrl);
    return true;
  }

  // Capture visible viewport (used by area snipping tool and full-page slice stitcher)
  if (message.action === "capture_visible_tab" || message.action === "CAPTURE_VISIBLE_TAB_SLICE") {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      .then(dataUrl => safeSendResponse({ dataUrl }))
      .catch(err => safeSendResponse({ error: err ? err.message : "Capture failed" }));
    return true;
  }

  // Launch Full-Page Capture Viewer
  if (message.action === "OPEN_CAPTURE_VIEWER") {
    saveCapturePayload(message.payload).finally(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL("capture-viewer.html") });
    });
    safeSendResponse({ success: true });
    return true;
  }

  // Retrieve Stitched Capture Payload (works even after the SW was restarted)
  if (message.action === "GET_LATEST_CAPTURE_PAYLOAD") {
    loadCapturePayload().then(payload => safeSendResponse({ payload: payload || null }));
    return true;
  }

  // Visual Image Search API Engine
  if (message.action === "search_image") {
    searchImage(message.imgUrl, sender.tab, "all"); 
    safeSendResponse({ success: true });
    return true;
  }

  if (message.type === "GET_ALL_STATE") {
    chrome.storage.local.get(DEFAULTS).then(s => safeSendResponse(s)).catch(() => safeSendResponse(DEFAULTS));
    return true;
  }

  if (message.type === "UPDATE_SETTING") {
    if (message.key === 'browserLockPassword') {
      hashPassword(message.value).then(hashed => {
        chrome.storage.local.set({ browserLockPassword: hashed }).then(() => safeSendResponse({ success: true }));
      });
      return true;
    }
    chrome.storage.local.set({ [message.key]: message.value }).then(() => safeSendResponse({ success: true }));
    return true;
  }

  if (message.type === "SHORTEN_URL") {
    shortenUrlAPI(message.url).then(r => safeSendResponse(r)).catch(err => safeSendResponse({ status: 500, message: err.toString() }));
    return true;
  }

  if (message.type === "UNLOCK_ATTEMPT") {
    Promise.all([hashPassword(message.password), chrome.storage.local.get(['browserLockPassword'])]).then(([hashedInput, local]) => {
      if (hashedInput === local.browserLockPassword && local.browserLockPassword !== "") {
        if (!message.isDomainUnlock) {
           chrome.storage.local.set({ browserLockEnabled: false }).then(() => safeSendResponse({ success: true }));
        } else {
           safeSendResponse({ success: true });
        }
      } else { 
        safeSendResponse({ success: false }); 
      }
    });
    return true;
  }
  
  if (message.type === "CLEAR_HISTORY") {
    chrome.storage.local.set({ urlHistory: [] }).then(() => safeSendResponse({ success: true }));
    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "custom-shortcut") {
    const data = await chrome.storage.local.get(DEFAULTS);
    const action = data.shortcutAction || "toggle_blur";

    if (action === "open_settings") {
      chrome.runtime.openOptionsPage();
      return;
    }

    const actionMap = {
      "toggle_block": "mediaBlockEnabled", "toggle_blur": "mediaBlurEnabled",
      "toggle_invert": "mediaInvertEnabled", "toggle_uniform": "mediaUniformEnabled",
      "toggle_hover": "mediaHoverEnabled", "toggle_rightclick": "forceRightClickEnabled",
      "toggle_stablevolume": "stableVolumeEnabled", "toggle_monoaudio": "monoAudioEnabled",
      "toggle_smoothvolume": "smoothVolumeEnabled",
      "toggle_darkmode": "darkModeEnabled", "toggle_textspoof": "textSpoofingEnabled",
      "toggle_mediadl": "mediaDlEnabled"
    };

    const key = actionMap[action];
    if (!key) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        let res = null;
        try {
          res = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TAB_SCOPE" });
        } catch (_) {
          // Content script may not be loaded or restricted URL; ignore and fall back to global
        }

        if (res && res.isScoped) {
          const nextState = res.localState && res.localState[key] !== undefined ? !res.localState[key] : !data[key];
          try {
            await chrome.tabs.sendMessage(tab.id, { type: "UPDATE_PAGE_TAB_SETTING", key, value: nextState });
          } catch (_) {}
          return;
        }
      }
    } catch (_) {}

    // Global toggle fallback
    const nextVal = !Boolean(data[key]);
    await chrome.storage.local.set({ [key]: nextVal });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // Rebuild menus from scratch: re-creating an existing id throws
  // "Cannot create item with duplicate id" on every extension reload/update.
  chrome.contextMenus.removeAll(() => {
    // Full Page Capture Context Menu
    chrome.contextMenus.create({ id: "capture_full_page", title: "📸 Capture Full Page Screenshot", contexts: ["page"] });

    // Shortener Context Menus
    chrome.contextMenus.create({ id: "shorten_page", title: "Copy Short URL (Current Page)", contexts: ["page"] });
    chrome.contextMenus.create({ id: "shorten_media", title: "Copy Short URL (This Media)", contexts: ["image", "video", "audio"] });
    chrome.contextMenus.create({ id: "shorten_link", title: "Copy Short URL (This Link)", contexts: ["link"] });

    // QR Context Menus
    chrome.contextMenus.create({ id: "qr_page", title: "Get QR Code (Current Page)", contexts: ["page"] });
    chrome.contextMenus.create({ id: "qr_media", title: "Get QR Code (This Media)", contexts: ["image", "video", "audio"] });
    chrome.contextMenus.create({ id: "qr_link", title: "Get QR Code (This Link)", contexts: ["link"] });

    // Search by Image Context Menus
    chrome.contextMenus.create({ id: "sbi-parent", title: "Search by Image", contexts: ["image"] });
    for (const [id, engine] of Object.entries(ENGINES)) {
      chrome.contextMenus.create({ id: `sbi-${id}`, parentId: "sbi-parent", title: engine.name, contexts: ["image"] });
    }
    chrome.contextMenus.create({ id: "sbi-separator", parentId: "sbi-parent", type: "separator", contexts: ["image"] });
    chrome.contextMenus.create({ id: "sbi-all", parentId: "sbi-parent", title: "Search All", contexts: ["image"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Handle Full Page Capture
  if (info.menuItemId === "capture_full_page" && tab?.id) {
    if (!tab.url || !tab.url.startsWith("http")) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => alert("Full page capture is available on standard HTTP/HTTPS pages.") });
      return;
    }
    // Inject overlay CSS first (the popup path does the same); capture.js also
    // links capture.css via web_accessible_resources as a belt-and-braces fix.
    chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["capture.css"] })
      .catch(() => {})
      .finally(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["capture.js"]
        });
      });
    return;
  }

  // Handle Search by Image
  if (info.menuItemId.toString().startsWith("sbi-")) {
    if (info.menuItemId === "sbi-parent" || info.menuItemId === "sbi-separator") return;
    searchImage(info.srcUrl, tab, info.menuItemId.replace("sbi-", ""));
    return;
  }

  // Handle QR Code
  if (info.menuItemId.toString().startsWith("qr_")) {
    const targetUrl = info.menuItemId === "qr_page" ? info.pageUrl : info.menuItemId === "qr_media" ? info.srcUrl : info.linkUrl;
    if (targetUrl && tab?.id) {
      if (!targetUrl.startsWith('http')) {
        chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => alert("Cannot generate QR for a non-HTTP/HTTPS URI.") });
        return; 
      }
      showQrOverlay(targetUrl, tab.id);
    }
    return;
  }

  // Handle URL Shortener
  const targetUrl = info.menuItemId === "shorten_page" ? info.pageUrl : info.menuItemId === "shorten_media" ? info.srcUrl : info.linkUrl;
  if (targetUrl && tab?.id) {
    if (!targetUrl.startsWith('http')) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => alert("Cannot shorten a non-HTTP/HTTPS URI.") });
      return; 
    }
    generateAndCopyShortUrl(targetUrl, tab.id);
  }
});

function showQrOverlay(targetUrl, tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    args: [targetUrl],
    func: (url) => {
      if (document.getElementById('mb-qr-overlay')) return;
      const overlay = document.createElement('div');
      overlay.id = 'mb-qr-overlay';
      overlay.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15,15,17,0.9) !important; z-index: 2147483647 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; font-family: sans-serif !important; color: #f0f0f5 !important;';
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url) + '&bgcolor=FFFFFF&color=000000';
      
      const safeUrl = url.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      overlay.innerHTML = '<div style="background: #1a1a1f; padding: 24px; border-radius: 16px; border: 1px solid #2a2a32; text-align: center; position: relative; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">' +
           '<button id="mb-qr-close" style="position: absolute; top: 12px; right: 16px; background: transparent; border: none; color: #7a7a8a; cursor: pointer; font-size: 20px; transition: color 0.2s;">✕</button>' +
           '<h3 style="margin-top: 0; margin-bottom: 20px; font-size: 18px; color: #f0f0f5; font-weight: normal;">Scan QR Code</h3>' +
           '<img src="' + qrUrl + '" alt="QR Code" style="width: 250px; height: 250px; border-radius: 8px; background: #fff; padding: 12px; display: block; margin: 0 auto;">' +
           '<div style="margin-top: 16px; font-size: 11px; color: #3b82f6; word-break: break-all; max-width: 250px; margin-left: auto; margin-right: auto;">' + safeUrl + '</div>' +
        '</div>';
      
      document.body.appendChild(overlay);
      
      const closeOverlay = () => overlay.remove();
      overlay.querySelector('#mb-qr-close').addEventListener('click', closeOverlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
    }
  });
}

// --- URL SHORTENER LOGIC ---
// Uses the free is.gd API, which requires no account or API key. The previous
// implementation called a third-party endpoint with a hardcoded API key that
// no longer resolves to a real service, so shortening always failed.
async function shortenUrlAPI(longUrl) {
  const params = new URLSearchParams({ format: 'json', url: longUrl });
  const response = await fetch(`https://is.gd/create.php?${params.toString()}`);
  if (!response.ok) {
    return { status: response.status, message: `Shortener HTTP ${response.status}` };
  }
  const data = await response.json();
  if (data && data.shorturl) {
    return { status: 200, shorturl: data.shorturl };
  }
  return {
    status: (data && data.errorcode) || 500,
    message: (data && data.errormessage) || 'Shortener returned no URL'
  };
}

async function generateAndCopyShortUrl(longUrl, tabId) {
  chrome.action.setBadgeText({ text: "..." });
  chrome.action.setBadgeBackgroundColor({ color: [245, 158, 11, 255] }); 

  try {
    const data = await shortenUrlAPI(longUrl);
    if (data.status === 200) {
      const historyItem = { original: longUrl, short: data.shorturl, date: Date.now() };
      const res = await chrome.storage.local.get(['urlHistory']);
      let history = res.urlHistory || [];
      history.unshift(historyItem);
      if (history.length > 20) history = history.slice(0, 20);
      await chrome.storage.local.set({ urlHistory: history });

      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (shortText) => navigator.clipboard.writeText(shortText).catch(() => {}),
        args: [data.shorturl]
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Fetch Error:', error);
  } finally {
    updateBadge();
  }
}

// Handles image searching for both external URLs and Base64 cropped screenshots
function searchImage(imgUrl, tab, engineId) {
  if (!imgUrl) return;

  if (imgUrl.startsWith('data:')) {
    handleBase64Upload(imgUrl, tab, engineId);
    return;
  }

  const encodedUrl = encodeURIComponent(imgUrl);
  const tabIndex = typeof tab?.index === 'number' ? tab.index : 0;

  if (engineId === "all") {
    Object.values(ENGINES).forEach((engine, i) => {
      chrome.tabs.create({ url: engine.url + encodedUrl, index: tabIndex + 1 + i, active: i === 0 });
    });
  } else if (ENGINES[engineId]) {
    chrome.tabs.create({ url: ENGINES[engineId].url + encodedUrl, index: tabIndex + 1 });
  }
}

async function handleBase64Upload(base64, tab, engineId) {
  let targetTab = tab;
  if (!targetTab || !targetTab.id) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = activeTab;
  }
  if (!targetTab || !targetTab.id) return;

  const tabIndex = typeof targetTab.index === 'number' ? targetTab.index : 0;

  if (engineId === 'google' || engineId === 'all') {
    chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      args: [base64],
      func: (b64) => {
        fetch(b64)
          .then(r => r.blob())
          .then(blob => {
            const form = document.createElement('form');
            form.action = 'https://lens.google.com/v3/upload';
            form.method = 'POST';
            form.enctype = 'multipart/form-data';
            form.target = '_blank';

            const dt = new DataTransfer();
            dt.items.add(new File([blob], "image.jpg", { type: "image/jpeg" }));

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.name = 'encoded_image';
            fileInput.files = dt.files;
            form.appendChild(fileInput);

            const epInput = document.createElement('input');
            epInput.type = 'hidden';
            epInput.name = 'ep';
            epInput.value = 'ccb';
            form.appendChild(epInput);

            const hlInput = document.createElement('input');
            hlInput.type = 'hidden';
            hlInput.name = 'hl';
            hlInput.value = 'en';
            form.appendChild(hlInput);

            document.body.appendChild(form);
            form.submit();
            setTimeout(() => form.remove(), 1000);
          })
          .catch(err => console.error("TabMaxxing: Google Lens upload failed", err));
      }
    }).catch(err => console.error("TabMaxxing: Script execution failed", err));
  }

  if (engineId === 'yandex' || engineId === 'all') {
    try {
      const res = await fetch(base64);
      const blob = await res.blob();
      const fd = new FormData();
      fd.append('upfile', blob, 'image.jpg');
      
      const apiReq = await fetch('https://yandex.com/images/touch/search?rpt=imageview&format=json&request={"blocks":[{"block":"cbir-uploader__get-cbir-id"}]}', {
        method: 'POST',
        body: fd
      });
      const apiRes = await apiReq.json();
      const cbirId = apiRes?.blocks?.[0]?.params?.cbirId;
      if (cbirId) {
        chrome.tabs.create({ url: `https://yandex.com/images/search?rpt=imageview&cbir_id=${cbirId}`, index: tabIndex + 2 });
      }
    } catch (e) {
      console.error("Yandex Base64 upload failed", e);
    }
  }

  if (engineId === 'tineye' || engineId === 'all') {
    chrome.tabs.create({ url: 'https://tineye.com/', index: tabIndex + 3 }, (newTab) => {
      if (!newTab?.id) return;
      const listener = (tabId, info) => {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.scripting.executeScript({
            target: { tabId: newTab.id },
            args: [base64],
            func: (b64) => {
              fetch(b64).then(r => r.blob()).then(blob => {
                const dt = new DataTransfer();
                dt.items.add(new File([blob], "image.jpg", { type: blob.type || "image/jpeg" }));
                const input = document.querySelector("input#upload-box") || document.querySelector('input[type="file"]');
                if (input) {
                  input.files = dt.files;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }
              });
            }
          });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }
}