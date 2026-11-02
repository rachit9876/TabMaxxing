// TabMaxxing - Area Selection & Snipping Tool for Image Search
(function() {
  if (window.sbiSelectorActive) return;
  window.sbiSelectorActive = true;

  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // Create snipping UI elements
  const overlay = document.createElement('div');
  overlay.id = 'mb-snip-overlay';

  const banner = document.createElement('div');
  banner.id = 'mb-snip-banner';
  banner.innerHTML = `<span>✂️ Drag to select search area</span> <span class="snip-key">Esc</span> <span>to cancel</span>`;

  const snipBox = document.createElement('div');
  snipBox.id = 'mb-snip-box';

  const dimTag = document.createElement('div');
  dimTag.id = 'mb-snip-dim';
  snipBox.appendChild(dimTag);

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(banner);
  document.documentElement.appendChild(snipBox);

  function preventDefault(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      preventDefault(e);
      cleanup();
    }
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    preventDefault(e);
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    snipBox.style.left = `${startX}px`;
    snipBox.style.top = `${startY}px`;
    snipBox.style.width = '0px';
    snipBox.style.height = '0px';
    snipBox.style.display = 'block';
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    preventDefault(e);

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    snipBox.style.left = `${left}px`;
    snipBox.style.top = `${top}px`;
    snipBox.style.width = `${width}px`;
    snipBox.style.height = `${height}px`;

    dimTag.textContent = `${width} × ${height}`;
  }

  function handleMouseUp(e) {
    if (!isDragging) return;
    preventDefault(e);
    isDragging = false;

    const endX = e.clientX;
    const endY = e.clientY;

    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Hide and remove overlay immediately so it doesn't appear in the captured screenshot
    if (overlay) overlay.style.display = 'none';
    if (banner) banner.style.display = 'none';
    if (snipBox) snipBox.style.display = 'none';
    cleanup();

    // Ignore tiny accidental clicks (less than 10x10 px)
    if (width < 10 || height < 10) return;

    // Allow browser compositor two frame cycles to cleanly repaint without overlay
    requestAnimationFrame(() => {
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "capture_visible_tab" }, (response) => {
          if (chrome.runtime.lastError || !response || !response.dataUrl) {
            console.error("TabMaxxing: Screenshot capture failed", chrome.runtime.lastError || response?.error);
            return;
          }

          cropAndSearch(response.dataUrl, left, top, width, height);
        });
      }, 50);
    });
  }

  function cropAndSearch(dataUrl, x, y, width, height) {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = new Image();

    img.onload = () => {
      ctx.drawImage(
        img,
        Math.round(x * dpr),
        Math.round(y * dpr),
        Math.round(width * dpr),
        Math.round(height * dpr),
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Export cropped area as Base64 JPEG data URL
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.95);

      // Send cropped Base64 to background.js for multi-engine visual search
      chrome.runtime.sendMessage({ action: "search_image", imgUrl: croppedBase64 });
    };

    img.src = dataUrl;
  }

  function cleanup() {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('mousedown', handleMouseDown, true);
    window.removeEventListener('mousemove', handleMouseMove, true);
    window.removeEventListener('mouseup', handleMouseUp, true);

    overlay.remove();
    banner.remove();
    snipBox.remove();
    window.sbiSelectorActive = false;
  }

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('mousedown', handleMouseDown, true);
  window.addEventListener('mousemove', handleMouseMove, true);
  window.addEventListener('mouseup', handleMouseUp, true);
})();