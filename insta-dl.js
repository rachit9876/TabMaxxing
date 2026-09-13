// TabMaxxing - Instagram Downloader & 1-Click Live Copier (insta-dl)
(function () {
  "use strict";
  if (window.__INSTA_DL_LOADED) return;
  window.__INSTA_DL_LOADED = true;

  let isEnabled = false;
  let isCopyEnabled = false;

  // Initialize settings
  chrome.storage.local.get({ instaDlEnabled: false, instaDlCopyEnabled: false }, (items) => {
    isEnabled = Boolean(items.instaDlEnabled);
    isCopyEnabled = Boolean(items.instaDlCopyEnabled);
    if (isEnabled) startObserver();
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      if (changes.instaDlEnabled !== undefined) {
        isEnabled = changes.instaDlEnabled.newValue !== false;
        if (isEnabled) {
          startObserver();
          scanPage();
        } else {
          removeAllInjectedUI();
        }
      }
      if (changes.instaDlCopyEnabled !== undefined) {
        isCopyEnabled = changes.instaDlCopyEnabled.newValue !== false;
        scanPage();
      }
    }
  });

  // SVG Icons
  const ICONS = {
    download: `<svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    image: `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
    video: `<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    dropdown: `<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`
  };

  // Toast Notification system
  function showToast(message, type = "success") {
    let toast = document.getElementById("__insta_dl_toast__");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "__insta_dl_toast__";
      document.body.appendChild(toast);
    }
    toast.className = `insta-dl-toast insta-dl-toast-${type} show`;
    toast.innerHTML = `<span>${type === "success" ? "✨" : "ℹ️"}</span> <span>${message}</span>`;
    
    clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  // Extract Highest Resolution Image URL from <img> or srcset
  function getBestImageUrl(imgEl) {
    if (!imgEl) return null;
    const srcset = imgEl.getAttribute("srcset");
    if (srcset) {
      const candidates = srcset.split(",").map(part => {
        const [url, widthStr] = part.trim().split(/\s+/);
        const width = widthStr ? parseInt(widthStr.replace("w", ""), 10) : 0;
        return { url, width };
      });
      candidates.sort((a, b) => b.width - a.width);
      if (candidates.length && candidates[0].url) {
        return candidates[0].url;
      }
    }
    return imgEl.currentSrc || imgEl.src || null;
  }

  // Live Agentic Debug Tunnel & Logger Relay
  function logDebug(...args) {
    console.log("[TabMaxxing InstaDL]", ...args);
    try {
      chrome.runtime.sendMessage({
        action: "AGENTIC_LOG",
        category: "INSTA_DL",
        logs: args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      });
    } catch (e) {}
  }

  // Universal Media URL Sanitizer (decodes escaped slashes, &amp;, \u0026)
  function sanitizeMediaUrl(url) {
    if (!url || typeof url !== "string") return null;
    let clean = url
      .replace(/\\\//g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/&amp;/g, "&")
      .replace(/\\"/g, "")
      .replace(/["'\\].*$/, "")
      .trim();
    if (clean.startsWith("http") && !clean.startsWith("blob:")) {
      return clean;
    }
    return null;
  }

  // Deep Object Scanner to find real CDN MP4 URLs
  function deepFindVideoUrl(obj, depth = 0, seen = new Set()) {
    if (!obj || depth > 8 || seen.has(obj)) return null;
    if (typeof obj === 'string') {
      const clean = sanitizeMediaUrl(obj);
      if (clean && (clean.includes('.mp4') || clean.includes('/v/t50.') || clean.includes('/v/t51.') || (clean.includes('cdninstagram.com') && clean.includes('video')))) {
        return clean;
      }
      return null;
    }
    if (typeof obj !== 'object') return null;
    seen.add(obj);

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = deepFindVideoUrl(item, depth + 1, seen);
        if (found) return found;
      }
      return null;
    }

    if (obj.video_versions && Array.isArray(obj.video_versions) && obj.video_versions[0]?.url) {
      return sanitizeMediaUrl(obj.video_versions[0].url);
    }
    if (obj.video_url && typeof obj.video_url === 'string') {
      return sanitizeMediaUrl(obj.video_url);
    }
    if (obj.browser_native_hd_url && typeof obj.browser_native_hd_url === 'string') {
      return sanitizeMediaUrl(obj.browser_native_hd_url);
    }
    if (obj.browser_native_sd_url && typeof obj.browser_native_sd_url === 'string') {
      return sanitizeMediaUrl(obj.browser_native_sd_url);
    }

    for (const key of Object.keys(obj)) {
      if (key === 'child' || key === 'sibling' || key === 'return' || key === 'stateNode') continue;
      try {
        const found = deepFindVideoUrl(obj[key], depth + 1, seen);
        if (found) return found;
      } catch(e) {}
    }

    return null;
  }

  // Crawl React Fiber Tree for Real CDN Video URL
  function searchFiberForVideoUrl(node, depth = 0) {
    if (!node || depth > 8) return null;
    
    if (node.memoizedProps) {
      const url = deepFindVideoUrl(node.memoizedProps);
      if (url) return url;
    }
    if (node.pendingProps) {
      const url = deepFindVideoUrl(node.pendingProps);
      if (url) return url;
    }
    if (node.memoizedState) {
      const url = deepFindVideoUrl(node.memoizedState);
      if (url) return url;
    }

    if (node.child) {
      const u = searchFiberForVideoUrl(node.child, depth + 1);
      if (u) return u;
    }
    if (node.sibling) {
      const u = searchFiberForVideoUrl(node.sibling, depth + 1);
      if (u) return u;
    }
    return null;
  }

  // Blocklist of non-shortcode URL segments
  const INVALID_SHORTCODES = new Set(["audio", "videos", "channel", "tagged", "guide", "reels", "reel", "explore", "stories", "direct", "accounts", "p", "instagram_user"]);

  function isValidShortcode(code) {
    if (!code || typeof code !== "string") return false;
    const clean = code.trim();
    if (clean.length < 4 || clean.length > 40) return false;
    if (INVALID_SHORTCODES.has(clean.toLowerCase())) return false;
    return true;
  }

  // Search Fiber tree for Shortcode
  function searchFiberForShortcode(node, depth = 0) {
    if (!node || depth > 6) return null;
    const props = node.memoizedProps || node.props;
    if (props) {
      if (isValidShortcode(props.code)) return props.code;
      if (isValidShortcode(props.shortcode)) return props.shortcode;
      if (isValidShortcode(props.videoData?.code)) return props.videoData.code;
      if (isValidShortcode(props.item?.code)) return props.item.code;
      if (isValidShortcode(props.media?.code)) return props.media.code;
    }
    if (node.child) {
      const c = searchFiberForShortcode(node.child, depth + 1);
      if (c) return c;
    }
    if (node.sibling) {
      const s = searchFiberForShortcode(node.sibling, depth + 1);
      if (s) return s;
    }
    return null;
  }

  // Extract shortcode for a specific reel or post container
  function extractReelShortcode(container) {
    if (!container) return null;

    // 1. Look for anchor links inside container: a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]
    const links = container.querySelectorAll('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
      if (match && isValidShortcode(match[1])) {
        return match[1];
      }
    }

    // 2. Check current page pathname
    const urlMatch = window.location.pathname.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
    if (urlMatch && isValidShortcode(urlMatch[1])) {
      return urlMatch[1];
    }

    // 3. React Fiber inspection
    const video = container.querySelector('video') || container;
    if (video) {
      let curr = video;
      let depth = 0;
      while (curr && depth < 6) {
        const reactKey = Object.keys(curr).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"));
        if (reactKey) {
          const code = searchFiberForShortcode(curr[reactKey], 0);
          if (isValidShortcode(code)) return code;
        }
        curr = curr.parentElement;
        depth++;
      }
    }

    return null;
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

  // Extract best progressive video from Instagram API / GraphQL JSON
  function extractVideoFromApiJson(json) {
    if (!json) return null;
    if (json.items && Array.isArray(json.items) && json.items.length) {
      const item = json.items[0];
      if (item.video_versions && Array.isArray(item.video_versions) && item.video_versions.length) {
        const sorted = [...item.video_versions].sort((a, b) => (b.width * b.height) - (a.width * a.height));
        const best = sorted[0]?.url;
        if (best) return sanitizeMediaUrl(best);
      }
      if (item.video_url) return sanitizeMediaUrl(item.video_url);
    }
    const media = json?.data?.xdt_shortcode_media || json?.data?.shortcode_media || json?.graphql?.shortcode_media;
    if (media) {
      if (media.video_versions && Array.isArray(media.video_versions) && media.video_versions.length) {
        const sorted = [...media.video_versions].sort((a, b) => (b.width * b.height) - (a.width * a.height));
        const best = sorted[0]?.url;
        if (best) return sanitizeMediaUrl(best);
      }
      if (media.video_url) return sanitizeMediaUrl(media.video_url);
    }
    return deepFindVideoUrl(json);
  }

  // Search page <script> JSON blocks for matching MP4 URLs (with JSON escape handling & &amp; decoding)
  function searchPageScriptsForVideo(shortcode) {
    const scripts = document.querySelectorAll('script');
    const candidates = [];
    for (const script of scripts) {
      const text = script.textContent;
      if (!text) continue;
      if (text.includes('cdninstagram') || text.includes('fbcdn.net') || (shortcode && text.includes(shortcode))) {
        const matches = text.matchAll(/https?:\\?\/\\?\/[^\s"'<>]*(?:cdninstagram\.com|fbcdn\.net)[^\s"'<>]*?\.mp4[^\s"'<>]*/g);
        for (const m of matches) {
          const clean = sanitizeMediaUrl(m[0]);
          if (clean) {
            const isDash = clean.includes('dash_') || clean.includes('_dash_init');
            candidates.push({ url: clean, isDash });
          }
        }
      }
    }
    const progressive = candidates.find(c => !c.isDash);
    if (progressive) return progressive.url;
    if (candidates.length) return candidates[0].url;
    return null;
  }

  function getCsrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  // Resolve Real CDN MP4 URL (resolves blob: URLs via 8-layer pipeline)
  async function resolveRealVideoUrl(videoEl, shortcode = null) {
    console.log("[TabMaxxing InstaDL] Starting resolution for video:", videoEl, "Shortcode:", shortcode);

    // 1. Direct src if already a valid http(s) MP4 URL
    if (videoEl && videoEl.src && videoEl.src.startsWith("http") && !videoEl.src.startsWith("blob:")) {
      console.log("[TabMaxxing InstaDL] Found direct video src:", videoEl.src);
      return videoEl.src;
    }
    if (videoEl && videoEl.currentSrc && videoEl.currentSrc.startsWith("http") && !videoEl.currentSrc.startsWith("blob:")) {
      console.log("[TabMaxxing InstaDL] Found direct currentSrc:", videoEl.currentSrc);
      return videoEl.currentSrc;
    }
    const source = videoEl ? videoEl.querySelector("source") : null;
    if (source && source.src && source.src.startsWith("http") && !source.src.startsWith("blob:")) {
      console.log("[TabMaxxing InstaDL] Found direct source src:", source.src);
      return source.src;
    }

    // 2. Resolve shortcode if missing
    if (!shortcode && videoEl) {
      const parentContainer = videoEl.closest("div[role='dialog'], div[style*='aspect-ratio'], div[tabindex], div[role='presentation'], article, main") || videoEl.parentElement;
      if (parentContainer) shortcode = extractReelShortcode(parentContainer);
      console.log("[TabMaxxing InstaDL] Auto-extracted shortcode:", shortcode);
    }

    // 3. Query In-Page Authenticated Instagram APIs with session cookies & CSRF using numeric media ID & shortcode
    if (shortcode && shortcode.length > 3 && shortcode !== "reels" && shortcode !== "reel") {
      const csrf = getCsrfToken();
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

      for (const ep of endpoints) {
        try {
          console.log("[TabMaxxing InstaDL] Querying in-page API:", ep);
          const res = await fetch(ep, {
            credentials: "include",
            headers: {
              "x-ig-app-id": "936619743392459",
              "x-asbd-id": "129477",
              "x-csrftoken": csrf,
              "x-requested-with": "XMLHttpRequest"
            }
          });
          if (res.ok) {
            const json = await res.json();
            const extracted = extractVideoFromApiJson(json);
            if (extracted) {
              console.log("[TabMaxxing InstaDL] In-page API resolved video URL:", extracted, "from:", ep);
              return extracted;
            }
          }
        } catch (err) {
          console.warn("[TabMaxxing InstaDL] In-page API fetch failed for:", ep, err);
        }
      }
    }

    // 4. React Fiber Tree Deep Search on video element & parents
    if (videoEl) {
      let curr = videoEl;
      let depth = 0;
      while (curr && depth < 8) {
        const reactKey = Object.keys(curr).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$") || k.startsWith("__reactInternalInstance$"));
        if (reactKey) {
          const fiber = curr[reactKey];
          const foundUrl = searchFiberForVideoUrl(fiber, 0);
          if (foundUrl) {
            console.log("[TabMaxxing InstaDL] React Fiber deep scan found URL:", foundUrl);
            return foundUrl;
          }
        }
        curr = curr.parentElement;
        depth++;
      }
    }

    // 5. Live Captured Media Streams from background network listener
    try {
      const capRes = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "GET_CAPTURED_MEDIA" }, resolve);
      });
      if (capRes && capRes.success && capRes.media && capRes.media.length) {
        const latestMedia = capRes.media[0].url;
        console.log("[TabMaxxing InstaDL] Using live captured media stream:", latestMedia);
        return latestMedia;
      }
    } catch (e) {}

    // 6. Background Service Worker API Fallback
    if (shortcode && shortcode.length > 3 && shortcode !== "reels" && shortcode !== "reel") {
      try {
        console.log("[TabMaxxing InstaDL] Querying background API resolver for shortcode:", shortcode);
        const bgRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: "RESOLVE_REEL_URL", shortcode }, resolve);
        });
        if (bgRes && bgRes.success && bgRes.url) {
          const clean = sanitizeMediaUrl(bgRes.url);
          if (clean) {
            console.log("[TabMaxxing InstaDL] Background API successfully resolved URL:", clean, "from source:", bgRes.source);
            return clean;
          }
        }
      } catch (err) {
        console.warn("[TabMaxxing InstaDL] Error querying background API:", err);
      }
    }

    // 7. Page Scripts JSON Scanner
    const scriptUrl = searchPageScriptsForVideo(shortcode);
    if (scriptUrl) {
      console.log("[TabMaxxing InstaDL] Page script JSON scanner found URL:", scriptUrl);
      return scriptUrl;
    }

    // 8. OpenGraph metadata
    const metaOg = document.querySelector('meta[property="og:video"], meta[property="og:video:secure_url"]');
    if (metaOg && metaOg.content && metaOg.content.startsWith("http") && !metaOg.content.startsWith("blob:")) {
      console.log("[TabMaxxing InstaDL] OpenGraph meta tag found URL:", metaOg.content);
      return metaOg.content;
    }

    console.warn("[TabMaxxing InstaDL] All resolution layers exhausted without finding video URL for:", shortcode);
    return null;
  }

  // Extract Post Shortcode and Username
  function getPostMeta(postEl) {
    let username = "instagram_user";
    let shortcode = Date.now().toString();

    // Check page URL first for direct /reel/ /reels/ /p/ permalinks
    const urlMatch = window.location.pathname.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
    if (urlMatch && isValidShortcode(urlMatch[1])) {
      shortcode = urlMatch[1];
    }

    // Find username from post header
    const userLink = postEl.querySelector('header a[role="link"], a[href^="/"][role="link"]');
    if (userLink) {
      const u = userLink.getAttribute("href")?.replace(/\//g, "").trim();
      if (u) username = u;
    }

    // Find shortcode from post link or time link if not on direct URL
    const timeLink = postEl.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]');
    if (timeLink) {
      const match = timeLink.getAttribute("href")?.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
      if (match && isValidShortcode(match[1])) shortcode = match[1];
    }

    return { username, shortcode };
  }

  // 1-Click Live Clipboard Copier
  async function copyImageToClipboard(imageUrl, optionalVideoEl = null) {
    try {
      showToast("Copying to clipboard...", "info");

      let blob = null;

      // If a video element is passed, capture frame directly via canvas
      if (optionalVideoEl && optionalVideoEl.videoWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = optionalVideoEl.videoWidth;
        canvas.height = optionalVideoEl.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(optionalVideoEl, 0, 0, canvas.width, canvas.height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      } else if (imageUrl) {
        // Fetch image via background to bypass CORS canvas tainting
        const res = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: "FETCH_MEDIA_AS_BASE64", url: imageUrl }, resolve);
        });

        if (res && res.success && res.dataUrl) {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = res.dataUrl;
          });

          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
        } else {
          throw new Error("Unable to fetch image data");
        }
      }

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("Image copied to clipboard! (Ready to paste)", "success");
      } else {
        throw new Error("Blob creation failed");
      }
    } catch (err) {
      console.warn("MediaBlock Pro insta-dl copy error:", err);
      // Fallback: Copy URL text to clipboard
      if (imageUrl) {
        await navigator.clipboard.writeText(imageUrl);
        showToast("Direct Image URL copied!", "success");
      } else {
        showToast("Could not copy image directly", "info");
      }
    }
  }

  // Trigger Download via Page DOM Anchor or Background Worker
  async function triggerDownload(url, filename) {
    if (!url) {
      showToast("No media URL found", "info");
      return;
    }

    showToast("Downloading media... 📥", "info");

    // 1. If it's a blob URL from the current page video/audio, download directly via DOM
    if (url.startsWith("blob:")) {
      try {
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 5000);
        showToast("Download started! 📥", "success");
        return;
      } catch (e) {
        console.warn("DOM blob download failed:", e);
      }
    }

    // 2. Direct background download with in-memory dataURL conversion
    chrome.runtime.sendMessage({
      action: "DOWNLOAD_MEDIA",
      url: url,
      filename: filename
    }, (res) => {
      if (res && res.success) {
        showToast("Download started! 📥", "success");
      } else {
        showToast(res?.error || "Download error", "info");
      }
    });
  }

  // Helper to create Action Bar for Posts
  function createPostActionBar(postEl) {
    const bar = document.createElement("div");
    bar.className = "insta-dl-bar";
    bar.dataset.instaDl = "true";

    const { username, shortcode } = getPostMeta(postEl);

    // Download Button
    const dlBtn = document.createElement("button");
    dlBtn.className = "insta-dl-btn insta-dl-btn-dl";
    dlBtn.innerHTML = `${ICONS.download} <span>Download</span>`;
    dlBtn.title = "Download media in highest resolution";

    dlBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Find active media inside the post
      const video = postEl.querySelector("video");
      const img = postEl.querySelector('article img[src], div[role="button"] img[src], img[srcset]');

      if (video && video.offsetParent !== null) {
        showToast("Resolving video stream...", "info");
        const vidUrl = await resolveRealVideoUrl(video, shortcode);
        if (vidUrl) {
          triggerDownload(vidUrl, `${username}_${shortcode}.mp4`);
          return;
        }
      }

      if (img) {
        const imgUrl = getBestImageUrl(img);
        if (imgUrl) {
          triggerDownload(imgUrl, `${username}_${shortcode}.jpg`);
          return;
        }
      }

      showToast("No downloadable media found in post", "info");
    });

    bar.appendChild(dlBtn);

    // Live Copy Button (if enabled)
    if (isCopyEnabled) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "insta-dl-btn insta-dl-btn-copy";
      copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
      copyBtn.title = "Copy image / frame to clipboard for instant pasting";

      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        const video = postEl.querySelector("video");
        const img = postEl.querySelector('article img[src], div[role="button"] img[src], img[srcset]');

        if (video && video.offsetParent !== null && video.videoWidth > 0) {
          copyImageToClipboard(null, video);
        } else if (img) {
          const imgUrl = getBestImageUrl(img);
          if (imgUrl) {
            copyImageToClipboard(imgUrl);
          }
        } else {
          showToast("No image to copy", "info");
        }
      });

      bar.appendChild(copyBtn);
    }

    return bar;
  }

  // Inject into Feed, Profile, and Standalone Posts (/p/...)
  function processPosts() {
    // Avoid running inside story view
    if (window.location.pathname.includes("/stories/")) return;

    const postContainers = document.querySelectorAll("article:not([data-insta-dl-processed]), main[role='main']:not([data-insta-dl-processed])");
    postContainers.forEach(container => {
      // For main[role="main"], ensure it contains post media
      if (container.tagName.toLowerCase() === "main" && !container.querySelector("article") && !container.querySelector("img, video")) {
        return;
      }

      container.setAttribute("data-insta-dl-processed", "true");

      // Find action buttons container (like, comment, share row)
      const actionSection = container.querySelector("section");
      if (actionSection && !container.querySelector(".insta-dl-bar")) {
        const bar = createPostActionBar(container);
        actionSection.parentNode.insertBefore(bar, actionSection.nextSibling);
      }
    });
  }

  // Inject into Instagram Story Viewer (/stories/...)
  function processStories() {
    if (!window.location.pathname.includes("/stories/")) {
      const existingStoryBar = document.querySelector(".insta-dl-story-bar");
      if (existingStoryBar) existingStoryBar.remove();
      return;
    }

    // Check if story bar already exists in current story slide
    if (document.querySelector(".insta-dl-story-bar")) return;

    // Find active story slide or container
    const storyContainer = document.querySelector('section[role="region"], div[role="dialog"], section, main');
    if (!storyContainer) return;

    // Extract username from URL or header
    let username = "story";
    const pathMatch = window.location.pathname.match(/\/stories\/([^\/?#]+)/);
    if (pathMatch && pathMatch[1]) {
      username = pathMatch[1];
    } else {
      const userEl = document.querySelector('header a[role="link"], header span, section header h2, section a[role="link"]');
      if (userEl && userEl.textContent.trim()) username = userEl.textContent.trim();
    }

    const bar = document.createElement("div");
    bar.className = "insta-dl-story-bar";

    // Download Button
    const dlBtn = document.createElement("button");
    dlBtn.className = "insta-dl-btn insta-dl-btn-dl";
    dlBtn.innerHTML = `${ICONS.download} <span>Download</span>`;
    dlBtn.title = "Download current story item (Photo / Video)";

    dlBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Dynamically locate active visible video or image in story
      const activeVideo = Array.from(document.querySelectorAll("section video, div[role='dialog'] video, video")).find(v => {
        return v.offsetWidth > 150 && v.offsetHeight > 150 && !v.paused;
      }) || document.querySelector("section video, div[role='dialog'] video, video");

      const activeImg = Array.from(document.querySelectorAll("section img, div[role='dialog'] img, img")).find(img => {
        return img.offsetWidth > 150 && img.offsetHeight > 150 && img.src && !img.src.includes("profile_pic");
      });

      // 1. If active playing video
      if (activeVideo && activeVideo.offsetWidth > 150 && !activeVideo.paused) {
        showToast("Resolving story video...", "info");
        const vidUrl = await resolveRealVideoUrl(activeVideo, null);
        if (vidUrl) {
          triggerDownload(vidUrl, `${username}_story_${Date.now()}.mp4`);
          return;
        }
      }

      // 2. If static photo story
      if (activeImg) {
        const imgUrl = getBestImageUrl(activeImg);
        if (imgUrl) {
          triggerDownload(imgUrl, `${username}_story_${Date.now()}.jpg`);
          return;
        }
      }

      // 3. Fallback to video
      if (activeVideo) {
        showToast("Resolving story video...", "info");
        const vidUrl = await resolveRealVideoUrl(activeVideo, null);
        if (vidUrl) {
          triggerDownload(vidUrl, `${username}_story_${Date.now()}.mp4`);
          return;
        }
      }

      showToast("No active story media found", "info");
    });

    bar.appendChild(dlBtn);

    // Live Copy Button for Stories
    if (isCopyEnabled) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "insta-dl-btn insta-dl-btn-copy";
      copyBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
      copyBtn.title = "Copy story photo/frame to clipboard";

      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        const activeImg = Array.from(document.querySelectorAll("section img, div[role='dialog'] img, img")).find(img => {
          return img.offsetWidth > 150 && img.offsetHeight > 150 && img.src && !img.src.includes("profile_pic");
        });

        const activeVideo = document.querySelector("section video, div[role='dialog'] video, video");

        if (activeImg) {
          const imgUrl = getBestImageUrl(activeImg);
          if (imgUrl) {
            copyImageToClipboard(imgUrl);
            return;
          }
        }

        if (activeVideo && activeVideo.videoWidth > 0) {
          copyImageToClipboard(null, activeVideo);
          return;
        }

        showToast("No story image found to copy", "info");
      });

      bar.appendChild(copyBtn);
    }

    // Try injecting into story header or overlay top-right
    const storyHeader = document.querySelector('section header, div[role="dialog"] header, section > div > div > header');
    if (storyHeader) {
      storyHeader.insertBefore(bar, storyHeader.firstChild);
    } else {
      bar.style.position = "fixed";
      bar.style.top = "16px";
      bar.style.right = "80px";
      bar.style.zIndex = "999999";
      document.body.appendChild(bar);
    }
  }

  // Inject into Direct Reel URLs (/reel/...), Scrolling Reels Feed (/reels/), and Video Modals
  function processReels() {
    if (window.location.pathname.includes("/stories/")) return;

    const allVideos = Array.from(document.querySelectorAll("video")).filter(v => {
      return v.offsetWidth > 150 && v.offsetHeight > 150;
    });

    allVideos.forEach(video => {
      // Find the main reel card container
      const reelCard = video.closest("div[role='dialog'], div[style*='aspect-ratio'], div[tabindex], div[role='presentation'], article, main") || video.parentElement;
      if (!reelCard || reelCard.querySelector(".insta-dl-bar, .insta-dl-reel-bar")) return;

      // Extract exact shortcode for this specific reel card
      const shortcode = extractReelShortcode(reelCard) || "reel";

      // 1. Check if this reel card has a side action column (Like, Comment, Share button column)
      const actionBtn = reelCard.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"], svg[aria-label="Comment"], svg[aria-label="Share Post"], svg[aria-label="Save"]');
      const actionColumn = actionBtn ? actionBtn.closest('div[style*="flex-direction: column"], div > div > div > div, div[role="presentation"]') : null;

      if (actionColumn && !actionColumn.querySelector(".insta-dl-reel-bar")) {
        // Inject dedicated per-reel sidebar button
        const reelBar = document.createElement("div");
        reelBar.className = "insta-dl-reel-bar";

        const dlBtn = document.createElement("button");
        dlBtn.className = "insta-dl-reel-circle-btn";
        dlBtn.innerHTML = ICONS.download;
        dlBtn.title = "Download Reel (Full HD + Audio)";
        dlBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          e.preventDefault();
          showToast("Resolving reel video... 📥", "info");
          const vidUrl = await resolveRealVideoUrl(video, shortcode);
          if (vidUrl) {
            triggerDownload(vidUrl, `${shortcode}_${Date.now()}.mp4`);
          } else {
            showToast("Buffering reel stream, please click again in a moment", "info");
          }
        });

        const dlLabel = document.createElement("span");
        dlLabel.className = "insta-dl-reel-label";
        dlLabel.textContent = "Download";

        reelBar.appendChild(dlBtn);
        reelBar.appendChild(dlLabel);

        if (isCopyEnabled) {
          const copyBtn = document.createElement("button");
          copyBtn.className = "insta-dl-reel-circle-btn insta-dl-copy-btn";
          copyBtn.innerHTML = ICONS.copy;
          copyBtn.title = "Copy active frame to clipboard";
          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            copyImageToClipboard(null, video);
          });

          const copyLabel = document.createElement("span");
          copyLabel.className = "insta-dl-reel-label";
          copyLabel.textContent = "Frame";

          reelBar.appendChild(copyBtn);
          reelBar.appendChild(copyLabel);
        }

        actionColumn.appendChild(reelBar);
      } else {
        // Fallback: Floating overlay on the top-right of the video card
        const bar = document.createElement("div");
        bar.className = "insta-dl-bar insta-dl-overlay";

        const dlBtn = document.createElement("button");
        dlBtn.className = "insta-dl-btn insta-dl-btn-dl";
        dlBtn.innerHTML = `${ICONS.download} <span>Reel</span>`;
        dlBtn.title = "Download Reel video";
        dlBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          showToast("Resolving reel video... 📥", "info");
          const vidUrl = await resolveRealVideoUrl(video, shortcode);
          if (vidUrl) {
            triggerDownload(vidUrl, `${shortcode}_${Date.now()}.mp4`);
          } else {
            showToast("Buffering reel stream, please try in a moment", "info");
          }
        });
        bar.appendChild(dlBtn);

        if (isCopyEnabled) {
          const copyBtn = document.createElement("button");
          copyBtn.className = "insta-dl-btn insta-dl-btn-copy";
          copyBtn.innerHTML = `${ICONS.copy} <span>Frame</span>`;
          copyBtn.title = "Copy active video frame to clipboard";
          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            copyImageToClipboard(null, video);
          });
          bar.appendChild(copyBtn);
        }

        if (window.getComputedStyle(reelCard).position === "static") {
          reelCard.style.position = "relative";
        }
        reelCard.appendChild(bar);
      }
    });
  }

  function removeAllInjectedUI() {
    document.querySelectorAll(".insta-dl-bar, .insta-dl-story-bar").forEach(el => el.remove());
    document.querySelectorAll("[data-insta-dl-processed]").forEach(el => el.removeAttribute("data-insta-dl-processed"));
  }

  function scanPage() {
    if (!isEnabled) return;
    processPosts();
    processStories();
    processReels();
  }

  // Debounced Mutation Observer & URL Change Poller for SPAs
  let scanTimer = null;
  let observer = null;
  let lastUrl = window.location.href;

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scanPage, 120);
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Handle Instagram SPA URL changes
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(scanPage, 100);
      }
    }, 500);

    scanPage();
  }

})();

