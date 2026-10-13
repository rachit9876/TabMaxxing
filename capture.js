// TabMaxxing - Full Page Capture Content Orchestrator
(function () {
  "use strict";

  if (window.__TABMAX_CAPTURE_RUNNING) return;
  window.__TABMAX_CAPTURE_RUNNING = true;

  // Hard safety cap: pages longer than this would take minutes and produce a
  // canvas Chrome cannot allocate anyway (max 16384px per side / ~268M px area).
  const MAX_CHUNKS = 100;

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function createProgressOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "__tabmax_capture_overlay__";
    overlay.className = "tabmax-capture-overlay";
    overlay.innerHTML = `
      <div class="tabmax-capture-spinner"></div>
      <span id="__tabmax_capture_status__">Capturing page... 0%</span>
      <div class="tabmax-capture-bar-wrap">
        <div class="tabmax-capture-bar-fill" id="__tabmax_capture_fill__"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function updateProgress(percent) {
    const status = document.getElementById("__tabmax_capture_status__");
    const fill = document.getElementById("__tabmax_capture_fill__");
    const p = Math.min(100, Math.max(0, Math.round(percent)));
    if (status) status.textContent = `Capturing page... ${p}%`;
    if (fill) fill.style.width = `${p}%`;
  }

  async function captureFullPage() {
    const originalScrollY = window.scrollY;
    const originalScrollX = window.scrollX;
    const originalScrollBehavior = document.documentElement.style.scrollBehavior;

    // Inject capture styles if not present (CSS is also pre-injected by the
    // popup / context-menu handler; the <link> requires capture.css to be in
    // web_accessible_resources, which the fixed manifest now provides).
    if (!document.getElementById("__tabmax_capture_css__")) {
      const link = document.createElement("link");
      link.id = "__tabmax_capture_css__";
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL("capture.css");
      (document.head || document.documentElement).appendChild(link);
    }

    const overlay = createProgressOverlay();

    // Hide scrollbars during capture
    document.documentElement.classList.add("tabmax-hide-scrollbars");
    document.body.classList.add("tabmax-hide-scrollbars");

    // Disable smooth scrolling: sites with `scroll-behavior: smooth` animate
    // scrollTo() over hundreds of ms, so the 140ms wait would capture a
    // half-scrolled viewport and corrupt the stitch.
    document.documentElement.style.scrollBehavior = "auto";

    // Find fixed/sticky elements to avoid duplication during scrolling
    const fixedElements = Array.from(document.querySelectorAll("*")).filter(el => {
      if (el === overlay || el.contains(overlay)) return false;
      const pos = window.getComputedStyle(el).position;
      return (pos === "fixed" || pos === "sticky") && el.offsetHeight > 0 && el.offsetHeight < window.innerHeight * 0.75;
    });

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const totalHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );

    const dpr = window.devicePixelRatio || 1;
    const chunks = [];
    let currentY = 0;
    let chunkIndex = 0;

    function restorePageState() {
      fixedElements.forEach(el => el.classList.remove("tabmax-hide-sticky"));
      document.documentElement.classList.remove("tabmax-hide-scrollbars");
      document.body.classList.remove("tabmax-hide-scrollbars");
      document.documentElement.style.scrollBehavior = originalScrollBehavior;
      window.scrollTo(originalScrollX, originalScrollY);
    }

    try {
      while (currentY < totalHeight) {
        if (chunkIndex >= MAX_CHUNKS) {
          throw new Error(`Page is too long to capture (${MAX_CHUNKS} viewport limit reached).`);
        }

        // Scroll to position
        window.scrollTo(0, currentY);

        // Hide sticky/fixed headers on subsequent chunks
        if (chunkIndex > 0) {
          fixedElements.forEach(el => el.classList.add("tabmax-hide-sticky"));
        }

        // Wait for render/repaint
        await sleep(140);

        // Actual scroll position after browser clamping
        const actualY = window.scrollY;

        // Skip duplicate slice when the page bottom was already reached
        if (chunks.length && actualY <= chunks[chunks.length - 1].y) {
          break;
        }

        // Temporarily hide the progress overlay so it is NOT captured in the screenshot
        overlay.style.display = "none";

        // Capture visible slice via background service worker
        const res = await new Promise(resolve => {
          try {
            chrome.runtime.sendMessage({ action: "CAPTURE_VISIBLE_TAB_SLICE" }, (response) => {
              void chrome.runtime.lastError; // suppress unchecked-error spam
              resolve(response);
            });
          } catch (err) {
            resolve(null);
          }
        });

        // Restore overlay immediately for user progress visibility
        overlay.style.display = "flex";

        if (!res || !res.dataUrl) {
          throw new Error(res?.error || "Capture slice failed (the active tab may restrict screenshots).");
        }

        const isLastChunk = (actualY + viewportHeight >= totalHeight) || (currentY + viewportHeight >= totalHeight);

        chunks.push({
          dataUrl: res.dataUrl,
          y: actualY,
          chunkHeight: viewportHeight,
          isLast: isLastChunk
        });

        updateProgress(((currentY + viewportHeight) / totalHeight) * 100);

        if (isLastChunk) break;

        // Advance to next viewport
        currentY += viewportHeight;
        chunkIndex++;
      }

      updateProgress(100);
      await sleep(100);

      // Restore DOM state
      restorePageState();
      overlay.remove();
      window.__TABMAX_CAPTURE_RUNNING = false;

      // Send to background to stitch and launch Viewer
      chrome.runtime.sendMessage({
        action: "OPEN_CAPTURE_VIEWER",
        payload: {
          chunks,
          viewportWidth,
          viewportHeight,
          totalHeight: Math.max(totalHeight, currentY + viewportHeight),
          dpr,
          title: document.title || "Webpage Capture",
          url: window.location.href
        }
      });

    } catch (err) {
      console.error("TabMaxxing Capture Error:", err);
      restorePageState();
      if (overlay) overlay.remove();
      window.__TABMAX_CAPTURE_RUNNING = false;
      alert(`TabMaxxing Full Page Capture: ${err.message || "Failed to capture page."}`);
    }
  }

  captureFullPage();
})();
