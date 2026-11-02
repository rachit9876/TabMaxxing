/**
 * TabMaxxing - Universal Media DL & Sensory Bucket Logger
 * High-performance hover detector, srcset resolution, and client-side logging.
 */
(() => {
  "use strict";

  if (window.__TABMAX_MEDIA_DL_LOADED) return;
  window.__TABMAX_MEDIA_DL_LOADED = true;

  let isEnabled = false;

  chrome.storage.local.get({ mediaDlEnabled: false }, (items) => {
    isEnabled = Boolean(items.mediaDlEnabled);
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.mediaDlEnabled !== undefined) {
      isEnabled = Boolean(changes.mediaDlEnabled.newValue);
      if (!isEnabled) hideToolbar();
    }
  });

  let hoverEl = null;
  let hoverTimer = null;
  let hideTimer = null;
  let shownToolbar = null;
  const toolbars = new WeakMap();

  // Per-tab scoping ("THIS TAB" mode): content.js relays tab-scoped
  // mediaDlEnabled updates through this event because chrome.storage only
  // holds the global value.
  window.addEventListener("__tabmax_mediadl_state", (e) => {
    isEnabled = Boolean(e.detail);
    if (!isEnabled) hideToolbar();
  });

  // Ensure layer is attached once document.body or documentElement is ready
  const layer = document.createElement("div");
  layer.className = "tabmax-dl-layer";
  layer.setAttribute("aria-hidden", "true");

  function attachLayer() {
    if (!layer.isConnected) {
      const root = document.body || document.documentElement;
      if (root) root.appendChild(layer);
    }
  }

  if (document.body || document.documentElement) {
    attachLayer();
  } else {
    document.addEventListener("DOMContentLoaded", attachLayer);
  }

  const shadowRoot = layer.attachShadow({ mode: "open" });
  const styleEl = document.createElement("link");
  styleEl.rel = "stylesheet";
  styleEl.href = chrome.runtime.getURL("media-dl.css");
  shadowRoot.appendChild(styleEl);

  const ICON_BUCKET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>`;
  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const SVG_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const SVG_INFO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  const SVG_CROSS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  function sendMessageWithTimeout(msg, timeoutMs = 45000) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ success: false, error: "Request timed out" });
      }, timeoutMs);
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: "Empty response" });
          }
        });
      } catch (e) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ success: false, error: String(e) });
        }
      }
    });
  }

  let activeToast = null;
  let activeToastTimer = null;

  function showToast(htmlContent, type = "normal", duration = 3000) {
    if (activeToast) {
      clearTimeout(activeToastTimer);
      activeToast.remove();
      activeToast = null;
    }

    const toast = document.createElement("div");
    toast.className = `tabmax-dl-toast ${type}`;
    toast.innerHTML = htmlContent;
    shadowRoot.appendChild(toast);
    activeToast = toast;

    activeToastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => {
        if (activeToast === toast) activeToast = null;
        toast.remove();
      }, 250);
    }, duration);
  }

  // Error text can originate from fetched URLs / runtime errors; it must
  // never be interpolated into innerHTML unescaped.
  function escapeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function createToolbar(el) {
    const tb = document.createElement("div");
    tb.className = "tabmax-dl-overlay";
    tb.innerHTML = `
      <div class="tabmax-dl-actions">
        <button class="tabmax-dl-btn tabmax-dl-log" title="Log image to Media Bucket">
          ${ICON_BUCKET}<span>Bucket</span>
        </button>
        <button class="tabmax-dl-btn tabmax-dl-download" title="Quick download image file">
          ${ICON_DOWNLOAD}<span>Download</span>
        </button>
      </div>
    `;
    tb._target = el;

    tb.querySelector(".tabmax-dl-log").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      logMediaToBucket(tb);
    });

    tb.querySelector(".tabmax-dl-download").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      quickDownloadMedia(tb);
    });

    tb.addEventListener("mouseenter", () => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    });
    tb.addEventListener("mouseleave", () => scheduleHide());

    shadowRoot.appendChild(tb);
    return tb;
  }

  function toolbarFor(el) {
    let tb = toolbars.get(el);
    if (!tb || !tb.isConnected) {
      tb = createToolbar(el);
      toolbars.set(el, tb);
    }
    return tb;
  }

  function showToolbar(el) {
    if (!isEnabled) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) return;

    attachLayer();
    const tb = toolbarFor(el);

    // The layer may sit at a non-zero document offset (e.g. appended under a
    // positioned <body> with margins). Position the toolbar relative to the
    // layer's actual origin so it stays glued to the target element.
    const layerRect = layer.getBoundingClientRect();
    const originX = layerRect.left + window.scrollX;
    const originY = layerRect.top + window.scrollY;

    tb.style.visibility = "hidden";
    tb.classList.add("visible");

    let top = rect.top + window.scrollY - originY + (rect.height * 0.75) - (tb.offsetHeight / 2);
    let left = rect.left + window.scrollX - originX + (rect.width / 2) - (tb.offsetWidth / 2);

    const viewTop = window.scrollY + 10;
    if (top < viewTop) top = viewTop;
    const maxTop = window.scrollY + window.innerHeight - tb.offsetHeight - 10;
    if (top > maxTop) top = Math.max(viewTop, maxTop);
    left = Math.max(window.scrollX + 8 - originX, Math.min(window.scrollX + window.innerWidth - tb.offsetWidth - 8 - originX, left));

    tb.style.top = `${Math.round(top)}px`;
    tb.style.left = `${Math.round(left)}px`;
    tb.style.visibility = "";

    if (shownToolbar && shownToolbar !== tb) shownToolbar.classList.remove("visible");
    shownToolbar = tb;
  }

  function hideToolbar() {
    if (shownToolbar) {
      shownToolbar.classList.remove("visible");
      shownToolbar = null;
    }
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    hoverEl = null;
  }

  function scheduleHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      hideTimer = null;
      hideToolbar();
    }, 280);
  }

  // --- Highest-Resolution Scraper Helpers ---
  function pickLargestFromSrcset(img) {
    const srcset = img.getAttribute && img.getAttribute("srcset");
    if (!srcset) return null;
    let bestUrl = null;
    let bestScore = -1;
    for (const entry of srcset.split(",")) {
      const parts = entry.trim().split(/\s+/);
      if (!parts[0]) continue;
      const url = parts[0];
      const d = parts[1] || "";
      let score = 1;
      if (d.endsWith("w")) {
        score = parseFloat(d) || 0;
      } else if (d.endsWith("x")) {
        score = (parseFloat(d) || 1) * (img.naturalWidth || img.width || 0) * 10;
      }
      if (score > bestScore) {
        bestScore = score;
        bestUrl = url;
      }
    }
    return bestUrl;
  }

  function getBase64FromVideoFrame(video) {
    try {
      if (!video) return null;
      let w = video.videoWidth || video.clientWidth;
      let h = video.videoHeight || video.clientHeight;
      if (!w || !h) return null;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.92);
    } catch (_) {
      return null;
    }
  }

  function getBase64FromImage(img) {
    try {
      if (!img.complete) return null;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) return null;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.95);
    } catch (_) {
      return null;
    }
  }

  function resolveImageSource(el) {
    if (!el) return null;
    if (el.tagName === "IMG") {
      return pickLargestFromSrcset(el)
          || el.currentSrc
          || el.src
          || el.getAttribute("data-src")
          || el.getAttribute("data-original");
    }
    if (el.tagName === "VIDEO" || el.hasAttribute("poster")) {
      const poster = el.getAttribute("poster") || el.poster;
      if (poster) return poster;
    }
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg.includes("url(")) {
      const m = bg.match(/url\((['"]?)([^'")]+)\1\)/);
      if (m) return m[2];
    }
    const innerImg = el.querySelector && el.querySelector("img");
    if (innerImg) {
      return pickLargestFromSrcset(innerImg)
          || innerImg.currentSrc
          || innerImg.src;
    }
    const innerVideo = el.querySelector && el.querySelector("video[poster]");
    if (innerVideo) return innerVideo.getAttribute("poster") || innerVideo.poster;
    return null;
  }

  async function fetchViaBackground(url) {
    if (!url || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
    const res = await sendMessageWithTimeout({ action: "FETCH_IMAGE_BASE64", url }, 20000);
    if (res && res.success && res.base64) return res.base64;
    return null;
  }

  async function resolveFullMedia(tb) {
    const el = tb._target;
    if (!el) return null;

    const imgEl = el.tagName === "IMG" ? el : (el.querySelector && el.querySelector("img"));
    const videoEl = el.tagName === "VIDEO" ? el : (el.querySelector && el.querySelector("video"));

    let bestUrl = null;
    let base64 = null;
    let width = 0;
    let height = 0;
    let kind = "image";

    if (imgEl) {
      bestUrl = pickLargestFromSrcset(imgEl) || imgEl.currentSrc || imgEl.src;
      width = imgEl.naturalWidth || imgEl.clientWidth;
      height = imgEl.naturalHeight || imgEl.clientHeight;
      if (bestUrl) {
        base64 = await fetchViaBackground(bestUrl);
      }
      if (!base64) {
        base64 = getBase64FromImage(imgEl);
      }
    } else if (videoEl) {
      kind = "video";
      width = videoEl.videoWidth || videoEl.clientWidth;
      height = videoEl.videoHeight || videoEl.clientHeight;
      base64 = getBase64FromVideoFrame(videoEl);
      bestUrl = videoEl.getAttribute("poster") || videoEl.poster || videoEl.src;
      if (!base64 && bestUrl) {
        base64 = await fetchViaBackground(bestUrl);
      }
    } else {
      bestUrl = resolveImageSource(el);
      if (bestUrl) {
        base64 = await fetchViaBackground(bestUrl);
      }
      width = el.clientWidth;
      height = el.clientHeight;
    }

    const alt = (imgEl && imgEl.alt) || (el && el.alt) || document.title || "media";

    return {
      kind,
      url: bestUrl || "",
      base64: base64 || bestUrl,
      width: width || 0,
      height: height || 0,
      alt: alt.substring(0, 80),
      pageUrl: window.location.href,
      timestamp: Date.now()
    };
  }

  // --- Actions ---
  async function logMediaToBucket(tb) {
    showToast("Resolving media...", "normal", 3000);
    const media = await resolveFullMedia(tb);
    if (!media || (!media.base64 && !media.url)) {
      showToast(`${SVG_CROSS}<span>Cannot extract image</span>`, "error");
      return;
    }

    const res = await sendMessageWithTimeout({ action: "LOG_MEDIA_TO_BUCKET", media });
    if (res && res.success) {
      if (res.status === "exists") {
        showToast(`${SVG_INFO}<span>Already in Media Bucket</span>`, "exists");
      } else {
        showToast(`${SVG_CHECK}<span>Added to Bucket (${res.count || 1})</span>`, "success");
      }
    } else {
      showToast(`${SVG_CROSS}<span>Failed to log: ${escapeText(res?.error || "Error")}</span>`, "error");
    }
  }

  // Derive a sensible file extension from the data-URL mime or the URL path.
  function guessExtension(media) {
    const payload = String(media.base64 || "");
    let m = payload.match(/^data:image\/(png|jpeg|jpg|webp|gif|bmp|avif)/i);
    if (m) return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
    try {
      const u = new URL(media.url || payload);
      m = u.pathname.match(/\.(png|jpe?g|webp|gif|bmp|avif)$/i);
      if (m) return m[1].toLowerCase().replace("jpeg", "jpg");
    } catch (_) {}
    return "jpg";
  }

  // data: URLs longer than ~2MB are rejected by the downloads API (URL length
  // cap) and MV3 service workers cannot create blob: URLs, so large payloads
  // are converted and downloaded from the page context, where createObjectURL
  // is available.
  async function downloadDataUrlLocally(dataUrl, filename) {
    const blob = await (await fetch(dataUrl)).blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.style.display = "none";
    shadowRoot.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (_) {} }, 60000);
  }

  async function quickDownloadMedia(tb) {
    showToast("Preparing download...", "normal", 3000);
    const media = await resolveFullMedia(tb);
    if (!media || (!media.base64 && !media.url)) {
      showToast(`${SVG_CROSS}<span>Cannot extract image</span>`, "error");
      return;
    }

    const ext = guessExtension(media);
    const filename = `tabmaxxing_${Date.now()}.${ext}`;
    const url = String(media.url || "");
    const isHttp = /^https?:/i.test(url);
    // Only true data: URLs count as payloads; the "base64" field may hold a
    // plain URL as a fallback from resolveFullMedia.
    const dataUrl = typeof media.base64 === "string" && media.base64.startsWith("data:") ? media.base64 : null;

    const reportSuccess = () => showToast(`${SVG_CHECK}<span>Download started!</span>`, "success");

    // Images: prefer the direct http(s) URL — chrome.downloads fetches it
    // natively with no size limit and full fidelity. Videos keep the captured
    // frame as the primary payload so an .mp4 stream is never saved as .jpg.
    if (isHttp && media.kind !== "video") {
      const res = await sendMessageWithTimeout({ action: "DOWNLOAD_MEDIA", url, filename });
      if (res && res.success) {
        reportSuccess();
        return;
      }
      // Dead link / auth wall — fall through to the fetched payload.
    }

    if (dataUrl) {
      if (dataUrl.length > 1800000) {
        try {
          await downloadDataUrlLocally(dataUrl, filename);
          reportSuccess();
          return;
        } catch (_) { /* fall back to the background attempt */ }
      }
      const res = await sendMessageWithTimeout({ action: "DOWNLOAD_MEDIA", url: dataUrl, filename });
      if (res && res.success) {
        reportSuccess();
        return;
      }
    }

    // Video frames may only have a poster URL to fall back on.
    if (isHttp && media.kind === "video") {
      const res = await sendMessageWithTimeout({ action: "DOWNLOAD_MEDIA", url, filename });
      if (res && res.success) {
        reportSuccess();
        return;
      }
    }

    showToast(`${SVG_CROSS}<span>Download failed</span>`, "error");
  }

  // Quick Alt+L shortcut to log hovered image
  document.addEventListener("keydown", (e) => {
    if (!isEnabled) return;
    if (e.isComposing) return;
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== "l" && e.key !== "L" && e.code !== "KeyL") return;
    // Never hijack typing in form fields or editable regions.
    const t = e.target;
    if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
    const target = hoverEl || (shownToolbar && shownToolbar._target);
    if (target && target.isConnected) {
      e.preventDefault();
      showToolbar(target);
      const tb = toolbarFor(target);
      logMediaToBucket(tb);
    }
  });

  const HOVER_SEL = "img, video[poster], video, [style*='background-image'], [role='img']";

  document.addEventListener("mouseover", (e) => {
    if (!isEnabled) return;
    let target = e.target.closest && e.target.closest(HOVER_SEL);

    if (!target && e.clientX !== undefined && e.clientY !== undefined) {
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      for (const n of stack) {
        if (n && n.matches && n.matches(HOVER_SEL)) {
          target = n;
          break;
        }
      }
    }

    if (!target) return;
    if (target.closest(".tabmax-dl-layer")) return;

    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (hoverEl === target) return;

    hoverEl = target;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (hoverEl === target && target.isConnected) {
        showToolbar(target);
      }
    }, 180);
  }, { passive: true });

  document.addEventListener("mouseout", (e) => {
    const related = e.relatedTarget;
    if (related && related.nodeType === 1) {
      if (layer.contains(related)) return;
      if (related.closest && (related.closest(".tabmax-dl-overlay") || related.closest(".tabmax-dl-layer"))) return;
    }
    scheduleHide();
  }, { passive: true });

})();
