// TabMaxxing - Background Service Worker
const DEFAULTS = {
  mediaBlockEnabled: false, mediaInvertEnabled: false, mediaBlurEnabled: false,
  mediaHoverEnabled: false, mediaUniformEnabled: false, forceRightClickEnabled: false,
  stableVolumeEnabled: false, monoAudioEnabled: false, smoothVolumeEnabled: false, darkModeEnabled: false, targetImgEnabled: true, targetVidEnabled: true,
  blurIntensity: 25, blurMode: "blur", audioEqMode: "stable", audioLufs: "-12",
  shortcutAction: "toggle_blur", browserLockEnabled: false, browserLockPassword: "", urlHistory: [],
  textSpoofingEnabled: false, textSpoofingSeed: "mediablock",
  domainLockEnabled: false, lockedDomains: [],
  instaDlEnabled: false, instaDlCopyEnabled: false,
  adBlockMode: 0 // 0 = Off, 1 = Basic (DNR), 2 = Optimal (DNR + Specific Cosmetic), 3 = Complete (Optimal + Generic Cosmetic)
};

// Search engine endpoints for context menu and snippet area visual search
const ENGINES = {
  google: { name: "Google", url: "https://lens.google.com/upload?url=" },
  yandex: { name: "Yandex", url: "https://yandex.com/images/search?rpt=imageview&url=" },
  tineye: { name: "TinEye", url: "https://www.tineye.com/search/?url=" }
};

let latestCapturePayload = null;

// Global Agentic Live Debug Tunnel & Logger
const AGENTIC_LOGS = [];
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
  chrome.storage.local.set({ agenticDebugLogs: AGENTIC_LOGS });
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
  const data = await chrome.storage.local.get(DEFAULTS);
  // Migrate legacy adBlockEnabled if present
  if (typeof data.adBlockMode !== 'number') {
    data.adBlockMode = data.adBlockEnabled ? 1 : 0;
  }
  await chrome.storage.local.set(data);
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
      chrome.action.setBadgeText({ text: "🔒" });
      chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] }); 
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

    chrome.action.setBadgeText({ text });
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

// Real-time Instagram MP4 stream interceptor cache
const instagramVideoCache = new Map();

if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.url && (details.url.includes(".mp4") || details.url.includes("bytestart") || details.url.includes("/v/t50.") || details.url.includes("/v/t51.")) && (details.url.includes("cdninstagram.com") || details.url.includes("fbcdn.net"))) {
        let cleanUrl = details.url.replace(/&bytestart=\d+&byteend=\d+/, "").replace(/\?bytestart=\d+&byteend=\d+&?/, "?");
        if (details.tabId >= 0) {
          if (!instagramVideoCache.has(details.tabId)) {
            instagramVideoCache.set(details.tabId, []);
          }
          const list = instagramVideoCache.get(details.tabId);
          if (!list.includes(cleanUrl)) {
            list.unshift(cleanUrl);
            if (list.length > 40) list.pop();
          }
        }
      }
    },
    { urls: ["*://*.cdninstagram.com/*", "*://*.fbcdn.net/*"] }
  );

  chrome.tabs.onRemoved.addListener((tabId) => {
    instagramVideoCache.delete(tabId);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Query cached live video streams for current tab
  if (message.action === "GET_CACHED_VIDEO_URL") {
    const tabId = sender.tab?.id;
    const list = tabId ? instagramVideoCache.get(tabId) || [] : [];
    sendResponse({ success: true, urls: list, latest: list[0] || null });
    return true;
  }

  // Shortcode to Numeric Media ID conversion
  function shortcodeToMediaId(shortcode) {
    if (!shortcode || typeof shortcode !== 'string') return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = 0n;
    for (let i = 0; i < shortcode.length; i++) {
      const char = shortcode[i];
      const val = BigInt(alphabet.indexOf(char));
      if (val < 0n) return null;
      id = id * 64n + val;
    }
    return id.toString();
  }

  // Live Captured Media Streams cache per tab
  const RECENT_TAB_MEDIA = new Map();

  try {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        if (!details.url || details.tabId < 0) return;
        const url = details.url;
        if ((url.includes('.mp4') || url.includes('/v/t50.') || url.includes('/v/t51.')) && 
            (url.includes('fbcdn.net') || url.includes('cdninstagram.com'))) {
          if (!url.includes('_dash_init') && !url.includes('dash_init')) {
            const clean = url.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/["'\\].*$/, '').trim();
            if (!RECENT_TAB_MEDIA.has(details.tabId)) {
              RECENT_TAB_MEDIA.set(details.tabId, []);
            }
            const mediaList = RECENT_TAB_MEDIA.get(details.tabId);
            if (!mediaList.some(m => m.url === clean)) {
              mediaList.unshift({ url: clean, time: Date.now() });
              if (mediaList.length > 50) mediaList.pop();
            }
          }
        }
      },
      { urls: ["*://*.cdninstagram.com/*", "*://*.fbcdn.net/*", "*://*.instagram.com/*"] }
    );

    chrome.tabs.onRemoved.addListener((tabId) => {
      RECENT_TAB_MEDIA.delete(tabId);
    });
  } catch (e) {
    console.warn("webRequest listener setup error:", e);
  }

  // Query Instagram Web APIs with service worker privileges
  if (message.action === "RESOLVE_REEL_URL") {
    const shortcode = message.shortcode;
    const mediaId = shortcodeToMediaId(shortcode);
    const endpoints = [];

    if (mediaId) {
      endpoints.push(`https://www.instagram.com/api/v1/media/${mediaId}/info/`);
      endpoints.push(`https://i.instagram.com/api/v1/media/${mediaId}/info/`);
    }
    endpoints.push(`https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`);
    endpoints.push(`https://www.instagram.com/graphql/query/?doc_id=25531498899829322&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`);
    endpoints.push(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`);
    endpoints.push(`https://www.instagram.com/reel/${shortcode}/?__a=1&__d=dis`);

    (async () => {
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            headers: {
              "x-ig-app-id": "936619743392459",
              "x-asbd-id": "129477",
              "x-requested-with": "XMLHttpRequest"
            }
          });
          if (res.ok) {
            const json = await res.json();
            const item = json?.items?.[0] || json?.data?.xdt_shortcode_media || json?.data?.shortcode_media || json?.graphql?.shortcode_media;
            if (item) {
              if (item.video_versions && Array.isArray(item.video_versions) && item.video_versions.length) {
                const sorted = [...item.video_versions].sort((a, b) => (b.width * b.height) - (a.width * a.height));
                const best = sorted[0]?.url;
                if (best) {
                  sendResponse({ success: true, url: best, source: ep });
                  return;
                }
              }
              if (item.video_url && item.video_url.startsWith("http")) {
                sendResponse({ success: true, url: item.video_url, source: ep });
                return;
              }
            }
          }
        } catch(e) {}
      }
      sendResponse({ success: false, error: "No video stream resolved from background APIs" });
    })();
    return true;
  }

  // Retrieve captured media streams for the active tab
  if (message.action === "GET_CAPTURED_MEDIA") {
    const tabId = sender.tab?.id;
    const list = (tabId && RECENT_TAB_MEDIA.get(tabId)) || [];
    sendResponse({ success: true, media: list });
    return true;
  }

  // Live Debug Logging Relay from Content Scripts
  if (message.action === "AGENTIC_LOG") {
    agenticLog(message.category || "CONTENT", ...(message.logs || []));
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "GET_AGENTIC_LOGS") {
    sendResponse({ success: true, logs: AGENTIC_LOGS });
    return true;
  }

  // Direct Instagram / Media Downloader API
  if (message.action === "DOWNLOAD_MEDIA") {
    let filename = message.filename || "instagram_media.mp4";
    let rawUrl = message.url || "";
    const cleanUrl = rawUrl.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/["'\\].*$/, '').trim();

    agenticLog("DOWNLOAD", "Initiating download for:", cleanUrl, "Filename:", filename);

    // If data URL, download directly
    if (cleanUrl.startsWith("data:")) {
      chrome.downloads.download({
        url: cleanUrl,
        filename: filename,
        conflictAction: "uniquify",
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          agenticLog("DOWNLOAD_ERROR", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          agenticLog("DOWNLOAD_SUCCESS", "Download ID:", downloadId);
          sendResponse({ success: true, downloadId });
        }
      });
      return true;
    }

    // Direct native browser download for signed CDN URLs
    chrome.downloads.download({
      url: cleanUrl,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        agenticLog("DOWNLOAD_ERROR", chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        agenticLog("DOWNLOAD_SUCCESS", "Started Download ID:", downloadId);
        sendResponse({ success: true, downloadId });
      }
    });
    return true;
  }

  // Cross-origin image fetcher for Live Clipboard Copier
  if (message.action === "FETCH_MEDIA_AS_BASE64") {
    fetch(message.url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ success: true, dataUrl: reader.result, type: blob.type });
        reader.onerror = () => sendResponse({ success: false, error: "Reader error" });
        reader.readAsDataURL(blob);
      })
      .catch(err => sendResponse({ success: false, error: err.toString() }));
    return true;
  }

  // Capture visible viewport for area snipping tool
  if (message.action === "capture_visible_tab") {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(err => sendResponse({ error: err ? err.message : "Capture failed" }));
    return true;
  }

  // Full-Page Scrolling Slice Capture
  if (message.action === "CAPTURE_VISIBLE_TAB_SLICE") {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(err => sendResponse({ error: err ? err.message : "Slice capture failed" }));
    return true;
  }

  // Launch Full-Page Capture Viewer
  if (message.action === "OPEN_CAPTURE_VIEWER") {
    latestCapturePayload = message.payload;
    chrome.tabs.create({ url: chrome.runtime.getURL("capture-viewer.html") });
    sendResponse({ success: true });
    return true;
  }

  // Retrieve Stitched Capture Payload
  if (message.action === "GET_LATEST_CAPTURE_PAYLOAD") {
    sendResponse({ payload: latestCapturePayload });
    return true;
  }

  // Trigger Full-Page Capture on Tab
  if (message.action === "START_FULL_PAGE_CAPTURE") {
    const tabId = message.tabId || sender.tab?.id;
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["capture.js"]
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // Visual Image Search API Engine
  if (message.action === "search_image") {
    searchImage(message.imgUrl, sender.tab, "all"); 
    return true;
  }

  if (message.type === "GET_ALL_STATE") {
    chrome.storage.local.get(DEFAULTS).then(sendResponse);
    return true;
  }

  if (message.type === "UPDATE_SETTING") {
    if (message.key === 'browserLockPassword') {
      hashPassword(message.value).then(hashed => {
        chrome.storage.local.set({ browserLockPassword: hashed }).then(() => sendResponse({ success: true }));
      });
      return true;
    }
    chrome.storage.local.set({ [message.key]: message.value }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "RESET_DEFAULTS") {
    chrome.storage.local.set(DEFAULTS).then(() => sendResponse(DEFAULTS));
    return true;
  }

  if (message.type === "SHORTEN_URL") {
    shortenUrlAPI(message.url).then(sendResponse).catch(err => sendResponse({ status: 500, message: err.toString() }));
    return true;
  }

  if (message.type === "CHECK_LOCK") {
    chrome.storage.local.get(['browserLockEnabled']).then((local) => sendResponse({ locked: local.browserLockEnabled }));
    return true;
  }

  if (message.type === "UNLOCK_ATTEMPT") {
    Promise.all([hashPassword(message.password), chrome.storage.local.get(['browserLockPassword'])]).then(([hashedInput, local]) => {
      if (hashedInput === local.browserLockPassword && local.browserLockPassword !== "") {
        if (!message.isDomainUnlock) {
           chrome.storage.local.set({ browserLockEnabled: false }).then(() => sendResponse({ success: true }));
        } else {
           sendResponse({ success: true });
        }
      } else { 
        sendResponse({ success: false }); 
      }
    });
    return true;
  }
  
  if (message.type === "CLEAR_HISTORY") {
    chrome.storage.local.set({ urlHistory: [] }).then(() => sendResponse({ success: true }));
    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "custom-shortcut") {
    const data = await chrome.storage.local.get(DEFAULTS);
    const action = data.shortcutAction;

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
      "toggle_darkmode": "darkModeEnabled", "toggle_textspoof": "textSpoofingEnabled"
    };

    const key = actionMap[action];
    if (!key) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PAGE_TAB_SCOPE" }, async (res) => {
          if (!chrome.runtime.lastError && res && res.isScoped) {
            const nextState = res.localState[key] !== undefined ? !res.localState[key] : !data[key];
            chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_PAGE_TAB_SETTING", key, value: nextState });
          } else {
            await chrome.storage.local.set({ [key]: !data[key] });
          }
        });
      } else {
        chrome.storage.local.set({ [key]: !data[key] });
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Handle Full Page Capture
  if (info.menuItemId === "capture_full_page" && tab?.id) {
    if (!tab.url || !tab.url.startsWith("http")) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => alert("Full page capture is available on standard HTTP/HTTPS pages.") });
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["capture.js"]
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
async function shortenUrlAPI(longUrl) {
  const apiKey = 'fcdc158ebe36c6c0408bcb6c7e9a2fde';
  const params = new URLSearchParams({ key: apiKey, url: longUrl, analytics: 'true', filterbots: 'false' });
  const response = await fetch(`https://xgd.io/V1/shorten?${params.toString()}`);
  return await response.json();
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
          .catch(err => console.error("MediaBlock Pro: Google Lens upload failed", err));
      }
    }).catch(err => console.error("MediaBlock Pro: Script execution failed", err));
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