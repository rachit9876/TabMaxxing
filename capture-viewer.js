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
  let cropStart = { x: 0, y: 0 };
  let cropRect = { x: 0, y: 0, w: 0, h: 0 };

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
  document.getElementById("copyClipboardBtn").addEventListener("click", async () => {
    try {
      showToast("Copying image to clipboard...");
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Canvas to blob failed");
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("Copied image to clipboard! (Ready to paste)");
      }, "image/png");
    } catch (err) {
      console.error("Clipboard write failed:", err);
      showToast("Clipboard copy failed");
    }
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

  cropOverlay.addEventListener("mousedown", (e) => {
    if (e.target.closest("#cropBox") && !e.target.classList.contains("crop-overlay")) {
      return; // Handled inside box
    }
    const rect = cropOverlay.getBoundingClientRect();
    cropStart.x = e.clientX - rect.left;
    cropStart.y = e.clientY - rect.top;
    isDrawingCrop = true;
    cropBox.style.display = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDrawingCrop) return;
    const rect = cropOverlay.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const left = Math.min(cropStart.x, currentX);
    const top = Math.min(cropStart.y, currentY);
    const width = Math.abs(currentX - cropStart.x);
    const height = Math.abs(currentY - cropStart.y);

    if (width > 10 && height > 10) {
      cropBox.style.display = "block";
      cropBox.style.left = `${left}px`;
      cropBox.style.top = `${top}px`;
      cropBox.style.width = `${width}px`;
      cropBox.style.height = `${height}px`;

      cropRect = { x: left, y: top, w: width, h: height };

      // Calculate real canvas pixel dimensions
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const realW = Math.round(width * scaleX);
      const realH = Math.round(height * scaleY);

      cropDimBadge.textContent = `${realW} × ${realH} px`;
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDrawingCrop) {
      isDrawingCrop = false;
    }
  });

  // Apply Crop
  applyCropBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (cropRect.w < 10 || cropRect.h < 10) return;

    const rect = cropOverlay.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const sourceX = Math.round(cropRect.x * scaleX);
    const sourceY = Math.round(cropRect.y * scaleY);
    const sourceW = Math.round(cropRect.w * scaleX);
    const sourceH = Math.round(cropRect.h * scaleY);

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
      const { viewportWidth, totalHeight, dpr } = originalPayload;
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
