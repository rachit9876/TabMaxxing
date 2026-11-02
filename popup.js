// TabMaxxing - Popup Script
(function () {
  "use strict";

  window.addEventListener('error', (e) => {
    try {
      chrome.runtime.sendMessage({
        action: 'AGENTIC_LOG',
        category: 'POPUP_ERROR',
        logs: [`${e.message || 'Error'} at ${e.filename}:${e.lineno}:${e.colno}`]
      });
    } catch (_) {}
  });

  window.addEventListener('unhandledrejection', (e) => {
    try {
      chrome.runtime.sendMessage({
        action: 'AGENTIC_LOG',
        category: 'POPUP_UNHANDLED_REJECTION',
        logs: [`${e.reason?.message || String(e.reason)}`]
      });
    } catch (_) {}
  });

  const configMap = {
    mediaBlockEnabled: { color: "var(--block-accent)", labelPrefix: "BLOCK" },
    mediaBlurEnabled: { color: "var(--blur-accent)", labelPrefix: "BLUR" },
    mediaInvertEnabled: { color: "var(--invert-accent)", labelPrefix: "INVERT" },
    mediaUniformEnabled: { color: "var(--uniform-accent)", labelPrefix: "UNIFORM" },
    mediaHoverEnabled: { color: "var(--hover-accent)", labelPrefix: "HOVER" },
    forceRightClickEnabled: { color: "var(--frc-accent)", labelPrefix: "RIGHT-CLICK" },
    stableVolumeEnabled: { color: "var(--vol-accent)", labelPrefix: "STABLE VOL" },
    monoAudioEnabled: { color: "var(--mono-accent)", labelPrefix: "MONO" },
    smoothVolumeEnabled: { color: "var(--search-accent)", labelPrefix: "SMOOTH VOL" },
    darkModeEnabled: { color: "var(--dark-accent)", labelPrefix: "DARK MODE" },
    textSpoofingEnabled: { color: "var(--textspoof-accent)", labelPrefix: "TEXT SPOOF" },
    browserLockEnabled: { color: "var(--lock-accent)", labelPrefix: "LOCK" },
    mediaDlEnabled: { color: "var(--short-accent)", labelPrefix: "MEDIA DL" }
  };

  function updateSubUI(key, enabled) {
    if (!configMap[key]) {
      const toggle = document.getElementById(key);
      if (toggle) toggle.checked = enabled;
      return;
    }

    const config = configMap[key];
    const toggleEl = document.getElementById(key);
    if (toggleEl) toggleEl.checked = enabled;
    
    const card = document.getElementById(`${key}Card`);
    const label = document.getElementById(`${key}Label`);
    const track = document.getElementById(`${key}Track`);
    const thumb = document.getElementById(`${key}Thumb`);

    if (key === 'browserLockEnabled' && toggleEl && toggleEl.disabled) return; 

    if (label) {
      label.textContent = enabled ? "ON" : "OFF";
      label.style.color = enabled ? config.color : "var(--text-secondary)";
    }
    
    if (track) {
      track.style.background = enabled ? config.color : "#1f1f28";
      track.style.borderColor = enabled ? config.color : "var(--border)";
    }
    
    if (thumb) {
      thumb.style.left = enabled ? "calc(100% - 14px)" : "2px";
      thumb.style.background = enabled ? "#ffffff" : "var(--text-dim)";
    }
    
    if (card) {
      card.classList.toggle(`active-${key}`, enabled);
    }
  }

  const ADBLOCK_MODE_INFO = {
    0: { label: "OFF", desc: "No Filtering", color: "var(--text-secondary)" },
    1: { label: "BASIC (DNR)", desc: "DNR Network Rules", color: "#34d399" },
    2: { label: "OPTIMAL", desc: "DNR + Specific Element Hiding", color: "#10b981" },
    3: { label: "COMPLETE", desc: "DNR + Specific & Generic Cosmetic", color: "#059669" }
  };

  function updateAdBlockModeUI(mode) {
    const m = Number(mode) || 0;
    const info = ADBLOCK_MODE_INFO[m] || ADBLOCK_MODE_INFO[0];
    
    const card = document.getElementById('adBlockModeCard');
    const label = document.getElementById('adBlockModeLabel');
    const desc = document.getElementById('adBlockModeDesc');
    
    if (label) {
      label.textContent = info.label;
      label.style.color = info.color;
    }
    if (desc) {
      desc.textContent = info.desc;
    }
    if (card) {
      card.classList.remove('active-adBlockMode-1', 'active-adBlockMode-2', 'active-adBlockMode-3');
      if (m >= 1) {
        card.classList.add(`active-adBlockMode-${m}`);
      }
    }

    const btns = document.querySelectorAll('#adBlockTierPills .adblock-tier-btn');
    btns.forEach(btn => {
      const btnMode = Number(btn.getAttribute('data-mode')) || 0;
      btn.classList.toggle('active', btnMode === m);
    });
  }

  async function fetchMediaCounts() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.url.startsWith("http")) throw new Error("Restricted");
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          images: document.querySelectorAll("img, picture, svg image, canvas, [role='img']").length,
          videos: document.querySelectorAll("video, iframe[src*='youtube'], iframe[src*='vimeo']").length
        })
      });

      if (results?.[0]?.result) {
        document.getElementById("imgCount").textContent = `${results[0].result.images} found`;
        document.getElementById("vidCount").textContent = `${results[0].result.videos} found`;
      }
    } catch (_) {
      document.getElementById("imgCount").textContent = "-";
      document.getElementById("vidCount").textContent = "-";
    }
  }

  async function initUrlShortener() {
    const btn = document.getElementById('shortenUrlBtn');
    const statusText = document.getElementById('shortenStatusLabel');

    btn.addEventListener('click', async () => {
      // Double-submit guard (case must match the value set below)
      if (statusText.textContent === 'Generating...') return;

      try {
        statusText.textContent = 'Generating...';
        statusText.style.color = 'var(--text-secondary)';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab?.url || !tab.url.startsWith("http")) {
            statusText.textContent = 'HTTP/HTTPS only';
            statusText.style.color = '#ff3b3b';
            setTimeout(() => { statusText.textContent = 'Shorten URL'; statusText.style.color = 'var(--text-primary)'; }, 3000);
            return;
        }

        chrome.runtime.sendMessage({ type: "SHORTEN_URL", url: tab.url }, async (data) => {
          if (chrome.runtime.lastError || !data) {
            statusText.textContent = 'Network Error';
            statusText.style.color = '#ff3b3b';
            return;
          }

          if (data.status === 200 && data.shorturl) {
            try {
              await navigator.clipboard.writeText(data.shorturl);
              statusText.textContent = 'Copied Link!';
              statusText.style.color = '#10b981';
            } catch (_) {
              statusText.textContent = data.shorturl;
              statusText.style.color = '#10b981';
            }
          } else {
            statusText.textContent = `Error ${data.status || '?'}`;
            statusText.style.color = '#ff3b3b';
          }
        });
      } catch (err) {
        statusText.textContent = 'Network Error';
        statusText.style.color = '#ff3b3b';
      }

      setTimeout(() => {
        statusText.textContent = 'Shorten URL';
        statusText.style.color = 'var(--text-primary)';
      }, 3000);
    });
  }

  function initFullPageCapture() {
    const btn = document.getElementById('capturePageBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.url.startsWith("http")) {
        alert("Full page capture is available on standard HTTP/HTTPS pages.");
        return;
      }

      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["capture.css"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["capture.js"] });
        window.close();
      } catch (_) {
        // Some https pages (Chrome Web Store, PDF viewer...) forbid injection;
        // surface the failure instead of throwing an unhandled rejection.
        alert("TabMaxxing could not start the capture on this page (script injection is blocked).");
      }
    });
  }

  function initImageSearch() {
    const btn = document.getElementById('searchImageBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.url.startsWith("http")) return;

      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["selector.css"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["selector.js"] });
        window.close();
      } catch (_) {
        alert("TabMaxxing could not start the crop search on this page (script injection is blocked).");
      }
    });
  }

  function initQrGenerator() {
    const input = document.getElementById('customUrlInput');
    const btn = document.getElementById('generateQrBtn');
    const container = document.getElementById('customQrContainer');
    const img = document.getElementById('customQrImage');

    const generate = () => {
      const content = input.value.trim();
      if (!content) {
         container.style.display = 'none';
         return;
      }
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(content)}&bgcolor=FFFFFF&color=000000`;
      img.onerror = () => { container.style.display = 'none'; };
      img.onload = () => { container.style.display = 'flex'; };
      img.src = qrUrl;
    };

    btn.addEventListener('click', generate);
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') generate();
    });
    
    input.addEventListener('paste', () => {
      setTimeout(generate, 50);
    });
  }

  let currentActiveTabId = null;
  let isTabScoped = false;

  function updateScopeUI(scoped) {
    const btn = document.getElementById('tabScopeBtn');
    const tag = document.getElementById('tabScopeTag');
    if (!btn || !tag) return;

    btn.classList.toggle('active-tab-scope', scoped);
    tag.textContent = scoped ? 'THIS TAB' : 'ALL TABS';
    btn.title = scoped ? 'Scope: This Tab Only (Changes apply only to this open page)' : 'Scope: All Tabs (Click to apply to This Tab Only)';
  }

  function sendSettingUpdate(key, value) {
    if (isTabScoped && currentActiveTabId) {
      chrome.tabs.sendMessage(currentActiveTabId, { type: "UPDATE_PAGE_TAB_SETTING", key, value }, () => {
        void chrome.runtime.lastError; // tab may have navigated away
      });
    } else {
      chrome.runtime.sendMessage({ type: "UPDATE_SETTING", key, value }, () => {
        void chrome.runtime.lastError;
      });
    }
  }

  async function init() {
    const lockPw = document.getElementById('popupLockPw');
    const lockErr = document.getElementById('popupLockErr');
    const lockScreen = document.getElementById('popupLockScreen');
    const tabScopeBtn = document.getElementById('tabScopeBtn');
    
    let isTogglingOff = false; 
    
    const submitUnlock = () => {
      chrome.runtime.sendMessage({ type: "UNLOCK_ATTEMPT", password: lockPw.value }, (res) => {
        if (res && res.success) {
          lockScreen.style.display = 'none';
          lockPw.value = '';
          lockErr.style.display = 'none';
          isTogglingOff = false;
        } else {
          lockErr.style.display = 'block';
          lockPw.value = '';
          lockPw.focus();
        }
      });
    };
    
    document.getElementById('popupLockBtn').addEventListener('click', submitUnlock);
    
    document.getElementById('popupLockCancel').addEventListener('click', () => {
      if (isTogglingOff) {
        lockScreen.style.display = 'none';
        lockPw.value = '';
        lockErr.style.display = 'none';
        updateSubUI('browserLockEnabled', true);
        isTogglingOff = false;
      } else {
        window.close();
      }
    });

    lockPw.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitUnlock(); });
    document.getElementById("appVersion").textContent = `v${chrome.runtime.getManifest().version}`;
    
    // Check initial active tab scope
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        currentActiveTabId = tab.id;
        chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TAB_SCOPE" }, (res) => {
          if (!chrome.runtime.lastError && res && res.isScoped) {
            isTabScoped = true;
            updateScopeUI(true);
            if (res.localState) {
              Object.keys(res.localState).forEach(key => updateSubUI(key, res.localState[key]));
            }
          }
        });
      }
    } catch (_) {}

    if (tabScopeBtn) {
      tabScopeBtn.addEventListener('click', async () => {
        if (!currentActiveTabId) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) currentActiveTabId = tab.id;
        }
        if (!currentActiveTabId) return;

        chrome.tabs.sendMessage(currentActiveTabId, { type: "TOGGLE_PAGE_TAB_SCOPE" }, (res) => {
          if (chrome.runtime.lastError || !res) {
            alert("This Tab Only mode is available on standard web pages.");
            return;
          }
          isTabScoped = res.isScoped;
          updateScopeUI(isTabScoped);
          if (res.localState) {
            Object.keys(res.localState).forEach(key => updateSubUI(key, res.localState[key]));
          }
        });
      });
    }

    chrome.runtime.sendMessage({ type: "GET_ALL_STATE" }, (state) => {
      if (chrome.runtime.lastError || !state) return;
      
      if (state.browserLockEnabled) {
        lockScreen.style.display = 'flex';
        isTogglingOff = false; 
        setTimeout(() => lockPw.focus(), 100);
      }

      const lockToggle = document.getElementById('browserLockEnabled');
      const lockLabel = document.getElementById('browserLockEnabledLabel');
      
      if (!state.browserLockPassword) {
        if (lockToggle) {
           lockToggle.disabled = true;
           const lockCard = document.getElementById('browserLockEnabledCard');
           if (lockCard) {
             lockCard.style.cursor = 'not-allowed';
             lockCard.style.opacity = '0.6';
           }
           const lockTrack = document.getElementById('browserLockEnabledTrack');
           if (lockTrack) lockTrack.style.opacity = '0.4';
           if (lockLabel) {
             lockLabel.textContent = "PASSWORD REQUIRED";
             lockLabel.style.color = "var(--text-secondary)";
           }
        }
      }

      if (!isTabScoped) {
        Object.keys(state).forEach(key => updateSubUI(key, state[key]));
        const mode = typeof state.adBlockMode === 'number' ? state.adBlockMode : (state.adBlockEnabled ? 1 : 0);
        updateAdBlockModeUI(mode);
      }
    });

    fetchMediaCounts();
    initUrlShortener();
    initFullPageCapture();
    initImageSearch();
    initQrGenerator(); 

    // Target cards full-card click handlers
    ['targetImg', 'targetVid'].forEach(prefix => {
      const card = document.getElementById(`${prefix}Card`);
      const key = `${prefix}Enabled`;
      if (card) {
        card.addEventListener('click', () => {
          const toggle = document.getElementById(key);
          if (toggle) {
            const nextState = !toggle.checked;
            toggle.checked = nextState;
            sendSettingUpdate(key, nextState);
          }
        });
      }
    });

    // Feature cards full-card click handlers
    Object.keys(configMap).forEach(key => {
      const card = document.getElementById(`${key}Card`);
      if (!card) return;

      card.addEventListener('click', (e) => {
        if (key === 'browserLockEnabled') {
          const lockToggle = document.getElementById('browserLockEnabled');
          if (lockToggle && lockToggle.disabled) return;
          const nextState = !lockToggle.checked;
          updateSubUI('browserLockEnabled', nextState);
          
          if (nextState) {
            sendSettingUpdate("browserLockEnabled", true);
          } else {
            isTogglingOff = true;
            lockScreen.style.display = 'flex';
            setTimeout(() => lockPw.focus(), 100);
          }
          return;
        }

        const toggle = document.getElementById(key);
        if (toggle) {
          const nextState = !toggle.checked;
          updateSubUI(key, nextState);
          sendSettingUpdate(key, nextState);
          
          if (key === 'stableVolumeEnabled' && nextState) {
             updateSubUI('smoothVolumeEnabled', false);
             sendSettingUpdate('smoothVolumeEnabled', false);
          } else if (key === 'smoothVolumeEnabled' && nextState) {
             updateSubUI('stableVolumeEnabled', false);
             sendSettingUpdate('stableVolumeEnabled', false);
          }
        }
      });
    });

    // AdBlock Mode Tier buttons click handlers
    const adBlockTierBtns = document.querySelectorAll('#adBlockTierPills .adblock-tier-btn');
    adBlockTierBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetMode = Number(btn.getAttribute('data-mode')) || 0;
        updateAdBlockModeUI(targetMode);
        // Only the numeric adBlockMode is written; the legacy adBlockEnabled
        // boolean is no longer needed (all readers prefer adBlockMode).
        chrome.storage.local.set({ adBlockMode: targetMode });
      });
    });

    document.getElementById('settingsBtn').addEventListener('click', () => { chrome.runtime.openOptionsPage(); });

    // --- Media Bucket Modal & Actions ---
    const bucketModal = document.getElementById('bucketModal');
    const openBucketBtn = document.getElementById('openBucketBtn');
    const closeBucketModal = document.getElementById('closeBucketModal');
    const bucketCountBadge = document.getElementById('bucketCountBadge');
    const bucketModalBadge = document.getElementById('bucketModalBadge');
    const bucketGrid = document.getElementById('bucketGrid');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const clearBucketBtn = document.getElementById('clearBucketBtn');

    function updateBucketBadge(items) {
      const count = items ? items.length : 0;
      if (bucketCountBadge) bucketCountBadge.textContent = `BUCKET (${count})`;
      if (bucketModalBadge) bucketModalBadge.textContent = `${count} items`;
    }

    function renderBucketGallery(items) {
      updateBucketBadge(items);
      if (!bucketGrid) return;
      bucketGrid.innerHTML = '';

      if (!items || !items.length) {
        bucketGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 40px 10px; text-align: center; color: var(--text-secondary); font-size: 12px;">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            <div>Your bucket is empty.</div>
            <div style="font-size: 10.5px; margin-top: 4px; color: var(--text-dim);">Enable <b>Media DL</b>, hover any image on the web and click <b>Bucket</b> (or press <b>Alt+L</b>)!</div>
          </div>
        `;
        return;
      }

      items.forEach((item, index) => {
        const card = document.createElement('div');
        card.style.cssText = 'position: relative; background: #161620; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; aspect-ratio: 1;';
        
        const imgSrc = item.base64 || item.url;
        card.innerHTML = `
          <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy">
          <div style="position: absolute; bottom: 0; inset-inline: 0; background: linear-gradient(transparent, rgba(0,0,0,0.85)); padding: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 9px; color: #94a3b8; font-weight: 700;">${item.width ? `${item.width}×${item.height}` : `#${index + 1}`}</span>
            <div style="display: flex; gap: 4px;">
              <button class="b-dl" title="Download image" style="background: rgba(255,255,255,0.2); border: none; border-radius: 4px; width: 20px; height: 20px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="b-del" title="Remove" style="background: rgba(239,68,68,0.3); border: none; border-radius: 4px; width: 20px; height: 20px; color: #f87171; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
                ✕
              </button>
            </div>
          </div>
        `;

        card.querySelector('.b-dl').addEventListener('click', (e) => {
          e.stopPropagation();
          const ext = imgSrc.includes('image/png') ? 'png' : 'jpg';
          chrome.runtime.sendMessage({
            action: 'DOWNLOAD_MEDIA',
            url: imgSrc,
            filename: `bucket_${item.id || index}.${ext}`
          });
        });

        card.querySelector('.b-del').addEventListener('click', async (e) => {
          e.stopPropagation();
          const res = await chrome.storage.local.get({ mediaBucket: [] });
          let list = res.mediaBucket || [];
          list = list.filter(b => b.id !== item.id);
          await chrome.storage.local.set({ mediaBucket: list });
          renderBucketGallery(list);
        });

        bucketGrid.appendChild(card);
      });
    }

    if (openBucketBtn) {
      openBucketBtn.addEventListener('click', async () => {
        const res = await chrome.storage.local.get({ mediaBucket: [] });
        renderBucketGallery(res.mediaBucket || []);
        bucketModal.style.display = 'flex';
      });
    }

    if (closeBucketModal) {
      closeBucketModal.addEventListener('click', () => {
        bucketModal.style.display = 'none';
      });
    }

    if (clearBucketBtn) {
      clearBucketBtn.addEventListener('click', async () => {
        if (!confirm('Clear all items from your media bucket?')) return;
        await chrome.storage.local.set({ mediaBucket: [] });
        renderBucketGallery([]);
      });
    }

    if (downloadZipBtn) {
      downloadZipBtn.addEventListener('click', async () => {
        const res = await chrome.storage.local.get({ mediaBucket: [] });
        const items = res.mediaBucket || [];
        if (!items.length) {
          alert('Bucket is empty!');
          return;
        }

        if (typeof JSZip === 'undefined') {
          alert('ZIP library loading... Please try again.');
          return;
        }

        const originalText = downloadZipBtn.innerHTML;
        downloadZipBtn.innerHTML = `<span>Creating ZIP...</span>`;
        downloadZipBtn.disabled = true;

        try {
          const zip = new JSZip();
          const imgFolder = zip.folder("tabmaxxing_images");

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const dataUrl = item.base64 || item.url;
            let binaryData = null;
            let ext = "jpg";

            if (dataUrl.startsWith("data:")) {
              const parts = dataUrl.split(",");
              const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
              ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
              const b64Str = parts[1];
              binaryData = b64Str;
              imgFolder.file(`image_${i + 1}_${item.width}x${item.height}.${ext}`, binaryData, { base64: true });
            } else if (dataUrl.startsWith("http")) {
              try {
                const fetched = await fetch(dataUrl);
                const blob = await fetched.blob();
                ext = blob.type.includes("png") ? "png" : "jpg";
                imgFolder.file(`image_${i + 1}.${ext}`, blob);
              } catch (_) {}
            }
          }

          const content = await zip.generateAsync({ type: "base64" });
          const zipDataUrl = "data:application/zip;base64," + content;

          chrome.runtime.sendMessage({
            action: 'DOWNLOAD_MEDIA',
            url: zipDataUrl,
            filename: `tabmaxxing_bucket_${Date.now()}.zip`
          });

          downloadZipBtn.innerHTML = `<span>Downloaded ZIP!</span>`;
          setTimeout(() => {
            downloadZipBtn.innerHTML = originalText;
            downloadZipBtn.disabled = false;
          }, 2000);
        } catch (err) {
          alert(`Failed to create ZIP: ${err.message}`);
          downloadZipBtn.innerHTML = originalText;
          downloadZipBtn.disabled = false;
        }
      });
    }

    // Initialize initial count badge
    chrome.storage.local.get({ mediaBucket: [] }, (res) => {
      updateBucketBadge(res.mediaBucket || []);
    });
  }

  init();

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && !isTabScoped) {
      Object.keys(changes).forEach(key => {
        if (changes[key] !== undefined) {
          updateSubUI(key, changes[key].newValue);
        }
      });
      if (changes.adBlockMode !== undefined) {
        updateAdBlockModeUI(changes.adBlockMode.newValue);
      } else if (changes.adBlockEnabled !== undefined) {
        updateAdBlockModeUI(changes.adBlockEnabled.newValue ? 1 : 0);
      }
    }
  });

})();