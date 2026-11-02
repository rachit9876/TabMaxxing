// TabMaxxing - Full Page Capture Viewer Script
(function () {
  "use strict";

  const canvas = document.getElementById("captureCanvas");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("canvasContainer");
  const loadingWrap = document.getElementById("loadingWrap");
  const metaLabel = document.getElementById("pageMetaLabel");
  const toast = document.getElementById("viewerToast");
  const toastMsg = document.getElementById("viewerToastMsg");

  // Crop Elements
  const cropOverlay = document.getElementById("cropOverlay");
  const cropBox = document.getElementById("cropBox");
  const cropDimBadge = document.getElementById("cropDimBadge");
  const cropToggleBtn = document.getElementById("cropToggleBtn");
  const undoCropBtn = document.getElementById("undoCropBtn");
  const applyCropBtn = document.getElementById("applyCropBtn");
  const cancelCropBtn = document.getElementById("cancelCropBtn");

  // Chrome hard canvas limits: 16384px per side and ~268M px total area.
  // Exceeding either silently yields a blank/broken canvas.
  const MAX_CANVAS_SIDE = 16384;
  const MAX_CANVAS_AREA = 268435456;

  let currentZoom = 1;
  let isFitMode = true;
  let pageTitle = "Webpage_Capture";
  let pageUrl = "";

  // Stitch state kept for Undo (re-stitch from chunks instead of hoarding a
  // multi-gigabyte getImageData() copy of the canvas in memory).
  let originalPayload = null;
  let effectiveDpr = 1;

  // Crop State
  let isCropping = false;
  let isDrawingCrop = false;
  let isDraggingCrop = false;
  let activeResizeHandle = null;
  let cropStart = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let cropRect = { x: 0, y: 0, w: 0, h: 0 };
  let initialCropRect = { x: 0, y: 0, w: 0, h: 0 };

  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Clamp the drawing scale so the final canvas always fits inside Chrome's
  // canvas limits. Very long pages are downscaled instead of crashing.
  function computeEffectiveDpr(dpr, viewportWidth, totalHeight) {
    const w = Math.max(1, viewportWidth);
    const h = Math.max(1, totalHeight);
    let scale = dpr > 0 ? dpr : 1;
    scale = Math.min(scale, MAX_CANVAS_SIDE / w, MAX_CANVAS_SIDE / h);
    scale = Math.min(scale, Math.sqrt(MAX_CANVAS_AREA / (w * h)));
    // Never upscale beyond the capture resolution, and keep a sane minimum.
    return Math.max(0.1, Math.min(scale, dpr > 0 ? dpr : 1));
  }

  async function stitchCanvas(payload) {
    try {
      const { chunks, viewportWidth, viewportHeight, totalHeight, dpr, title, url } = payload;
      pageTitle = (title || "capture").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
      pageUrl = url || "";

      originalPayload = payload;
      effectiveDpr = computeEffectiveDpr(dpr, viewportWidth, totalHeight);

      // Set Canvas Dimensions
      canvas.width = Math.round(viewportWidth * effectiveDpr);
      canvas.height = Math.round(Math.max(totalHeight, viewportHeight) * effectiveDpr);

      await drawChunks(payload);

      loadingWrap.style.display = "none";
      container.style.display = "block";

      updateMetaLabel();
      applyZoom();
    } catch (err) {
      console.error("TabMaxxing Stitch Error:", err);
      loadingWrap.innerHTML = `<span style="color: #ef4444;">Failed to stitch canvas: ${err.message}</span>`;
    }
  }

  async function drawChunks(payload) {
    const { chunks, viewportWidth, viewportHeight } = payload;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const img = await loadImage(chunk.dataUrl);
      const destY = Math.round(chunk.y * effectiveDpr);
      const destW = Math.round(viewportWidth * effectiveDpr);
      const destH = Math.round(viewportHeight * effectiveDpr);
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, destY, destW, destH);
    }
  }

  function updateMetaLabel() {
    const detail = effectiveDpr < (originalPayload?.dpr || effectiveDpr)
      ? ` • scaled to fit ${effectiveDpr.toFixed(2)}x`
      : "";
    metaLabel.textContent = `${canvas.width} × ${canvas.height} px • ${pageTitle}${detail}`;
  }

  function applyZoom() {
    const zoomLabel = document.getElementById("zoomValLabel");
    if (isFitMode) {
      container.style.maxWidth = "920px";
      container.style.width = "100%";
      container.style.transform = "none";
      zoomLabel.textContent = "Fit";
    } else {
      container.style.maxWidth = "none";
      container.style.width = `${canvas.width}px`;
      container.style.transform = `scale(${currentZoom})`;
      zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
    }
  }

  // Zoom Button Handlers
  document.getElementById("zoomInBtn").addEventListener("click", () => {
    isFitMode = false;
    currentZoom = Math.min(2.5, currentZoom + 0.15);
    applyZoom();
  });

  document.getElementById("zoomOutBtn").addEventListener("click", () => {
    isFitMode = false;
    currentZoom = Math.max(0.2, currentZoom - 0.15);
    applyZoom();
  });

  document.getElementById("zoomValLabel").addEventListener("click", () => {
    isFitMode = !isFitMode;
    if (!isFitMode) currentZoom = 1;
    applyZoom();
  });

  // 1-Click Copy Image to Clipboard
  document.getElementById("copyClipboardBtn").addEventListener("click", () => {
    showToast("Copying image to clipboard...");
    // Errors thrown inside the async toBlob callback are not caught by a
    // try/catch around the call itself, so the handler must live inside.
    canvas.toBlob(async (blob) => {
      try {
        if (!blob) throw new Error("Canvas to blob failed");
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("Copied image to clipboard! (Ready to paste)");
      } catch (err) {
        console.error("Clipboard write failed:", err);
        showToast("Clipboard copy failed");
      }
    }, "image/png");
  });

  // Download High-Res PNG
  document.getElementById("downloadPngBtn").addEventListener("click", () => {
    try {
      showToast("Preparing PNG download...");
      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `TabMaxxing_${pageTitle}_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        showToast("Download started! 📥");
      }, "image/png");
    } catch (err) {
      console.error("Download failed:", err);
    }
  });

  // Export as PDF
  document.getElementById("exportPdfBtn").addEventListener("click", () => {
    window.print();
  });

  // --- Interactive Crop Tool Logic ---
  function toggleCropMode(enabled) {
    isCropping = enabled;
    cropOverlay.style.display = enabled ? "block" : "none";
    cropBox.style.display = "none";
    cropToggleBtn.classList.toggle("btn-primary", enabled);

    if (enabled) {
      showToast("Drag on the image to select a crop area ✂️");
    }
  }

  cropToggleBtn.addEventListener("click", () => {
    toggleCropMode(!isCropping);
  });

  cancelCropBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCropMode(false);
  });

  function updateCropBoxUI(rect, overlayRect) {
    cropBox.style.display = "block";
    cropBox.style.left = `${rect.x}px`;
    cropBox.style.top = `${rect.y}px`;
    cropBox.style.width = `${rect.w}px`;
    cropBox.style.height = `${rect.h}px`;

    cropRect = { ...rect };

    // Calculate real canvas pixel dimensions
    const scaleX = canvas.width / overlayRect.width;
    const scaleY = canvas.height / overlayRect.height;
    const realW = Math.round(rect.w * scaleX);
    const realH = Math.round(rect.h * scaleY);

    cropDimBadge.textContent = `${realW} × ${realH} px`;
  }

  cropOverlay.addEventListener("mousedown", (e) => {
    const handleEl = e.target.closest(".crop-handle");
    const actionsPill = e.target.closest(".crop-actions-pill");
    const insideBox = e.target.closest("#cropBox");

    if (actionsPill) return; // Buttons handle their own clicks

    const rect = cropOverlay.getBoundingClientRect();

    if (handleEl) {
      // Resize handle clicked
      e.stopPropagation();
      e.preventDefault();
      activeResizeHandle = handleEl.classList.contains("handle-tl") ? "tl"
        : handleEl.classList.contains("handle-tr") ? "tr"
        : handleEl.classList.contains("handle-bl") ? "bl"
        : "br";
      cropStart.x = e.clientX;
      cropStart.y = e.clientY;
      initialCropRect = { ...cropRect };
      return;
    }

    if (insideBox) {
      // Dragging entire crop box
      e.stopPropagation();
      e.preventDefault();
      isDraggingCrop = true;
      dragOffset.x = (e.clientX - rect.left) - cropRect.x;
      dragOffset.y = (e.clientY - rect.top) - cropRect.y;
      return;
    }

    // New crop drawing
    cropStart.x = e.clientX - rect.left;
    cropStart.y = e.clientY - rect.top;
    isDrawingCrop = true;
    cropBox.style.display = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isCropping) return;
    const rect = cropOverlay.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    if (activeResizeHandle) {
      // Resizing from corners. The moving edge is clamped BEFORE the new
      // width/height are derived from it — clamping afterwards shifts the
      // opposite (fixed) edge and lets the box grow past the image bounds.
      const dx = e.clientX - cropStart.x;
      const dy = e.clientY - cropStart.y;
      let { x, y, w, h } = initialCropRect;

      if (activeResizeHandle === "tl") {
        const newX = Math.max(0, Math.min(x + dx, x + w - 20));
        const newY = Math.max(0, Math.min(y + dy, y + h - 20));
        w = (x + w) - newX;
        h = (y + h) - newY;
        x = newX;
        y = newY;
      } else if (activeResizeHandle === "tr") {
        const newY = Math.max(0, Math.min(y + dy, y + h - 20));
        w = Math.max(20, Math.min(rect.width - x, w + dx));
        h = (y + h) - newY;
        y = newY;
      } else if (activeResizeHandle === "bl") {
        const newX = Math.max(0, Math.min(x + dx, x + w - 20));
        w = (x + w) - newX;
        h = Math.max(20, Math.min(rect.height - y, h + dy));
        x = newX;
      } else if (activeResizeHandle === "br") {
        w = Math.max(20, Math.min(rect.width - x, w + dx));
        h = Math.max(20, Math.min(rect.height - y, h + dy));
      }

      updateCropBoxUI({ x, y, w, h }, rect);
      return;
    }

    if (isDraggingCrop) {
      // Moving the crop box
      const newX = Math.max(0, Math.min(rect.width - cropRect.w, (e.clientX - rect.left) - dragOffset.x));
      const newY = Math.max(0, Math.min(rect.height - cropRect.h, (e.clientY - rect.top) - dragOffset.y));
      updateCropBoxUI({ x: newX, y: newY, w: cropRect.w, h: cropRect.h }, rect);
      return;
    }

    if (isDrawingCrop) {
      const left = Math.min(cropStart.x, currentX);
      const top = Math.min(cropStart.y, currentY);
      const width = Math.abs(currentX - cropStart.x);
      const height = Math.abs(currentY - cropStart.y);

      if (width > 10 && height > 10) {
        updateCropBoxUI({ x: left, y: top, w: width, h: height }, rect);
      }
    }
  });

  window.addEventListener("mouseup", () => {
    isDrawingCrop = false;
    isDraggingCrop = false;
    activeResizeHandle = null;
  });

  // Apply Crop
  applyCropBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (cropRect.w < 10 || cropRect.h < 10) return;

    const rect = cropOverlay.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let sourceX = Math.round(cropRect.x * scaleX);
    let sourceY = Math.round(cropRect.y * scaleY);
    let sourceW = Math.round(cropRect.w * scaleX);
    let sourceH = Math.round(cropRect.h * scaleY);

    // Defensive bounds clamp: rounding at high zoom levels can push the rect
    // a pixel past the canvas; out-of-bounds reads yield transparent padding.
    sourceW = Math.min(sourceW, canvas.width - sourceX);
    sourceH = Math.min(sourceH, canvas.height - sourceY);
    if (sourceW < 1 || sourceH < 1) return;

    // Extract cropped pixels
    const croppedImageData = ctx.getImageData(sourceX, sourceY, sourceW, sourceH);

    // Resize canvas
    canvas.width = sourceW;
    canvas.height = sourceH;
    ctx.putImageData(croppedImageData, 0, 0);

    toggleCropMode(false);
    undoCropBtn.style.display = "inline-flex";
    updateMetaLabel();
    applyZoom();

    showToast("Screenshot cropped successfully! ✂️");
  });

  // Undo / Reset Crop: re-stitch from the original capture chunks. This avoids
  // keeping a full-size ImageData copy of a potentially enormous canvas.
  undoCropBtn.addEventListener("click", async () => {
    if (!originalPayload) return;

    try {
      undoCropBtn.disabled = true;
      const { viewportWidth, viewportHeight, totalHeight, dpr } = originalPayload;
      effectiveDpr = computeEffectiveDpr(dpr, viewportWidth, totalHeight);
      canvas.width = Math.round(viewportWidth * effectiveDpr);
      canvas.height = Math.round(Math.max(totalHeight, viewportHeight) * effectiveDpr);
      await drawChunks(originalPayload);

      undoCropBtn.style.display = "none";
      updateMetaLabel();
      applyZoom();

      showToast("Restored original full page screenshot! ↩️");
    } catch (err) {
      console.error("Undo restore failed:", err);
      showToast("Could not restore original capture");
    } finally {
      undoCropBtn.disabled = false;
    }
  });

  // Query background worker for the latest capture payload
  chrome.runtime.sendMessage({ action: "GET_LATEST_CAPTURE_PAYLOAD" }, (res) => {
    void chrome.runtime.lastError; // suppress unchecked-error spam
    if (res && res.payload && Array.isArray(res.payload.chunks) && res.payload.chunks.length) {
      stitchCanvas(res.payload);
    } else {
      loadingWrap.innerHTML = `<span style="color: #ef4444;">No capture data found. Please trigger a new screenshot.</span>`;
    }
  });

})();
