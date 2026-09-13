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
    instaDlEnabled: { color: "var(--insta-accent)", labelPrefix: "INSTA DL" }
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
      if (statusText.textContent === 'GENERATING...') return;

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

          if (data.status === 200) {
            await navigator.clipboard.writeText(data.shorturl);
            statusText.textContent = 'Copied Link!';
            statusText.style.color = '#10b981';
          } else {
            statusText.textContent = `Error ${data.status}`;
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

      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["capture.css"] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["capture.js"] });
      window.close();
    });
  }

  function initImageSearch() {
    const btn = document.getElementById('searchImageBtn');
    btn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.url.startsWith("http")) return;

      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["selector.css"] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["selector.js"] });
      window.close();
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
      img.src = qrUrl;
      container.style.display = 'flex';
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
      chrome.tabs.sendMessage(currentActiveTabId, { type: "UPDATE_PAGE_TAB_SETTING", key, value });
    } else {
      chrome.runtime.sendMessage({ type: "UPDATE_SETTING", key, value });
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
      if (!state) return;
      
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
           document.getElementById('browserLockEnabledTrack').style.opacity = '0.4';
           lockLabel.textContent = "PASSWORD REQUIRED";
           lockLabel.style.color = "var(--text-secondary)";
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
        chrome.storage.local.set({ adBlockMode: targetMode, adBlockEnabled: targetMode >= 1 });
      });
    });

    document.getElementById('settingsBtn').addEventListener('click', () => { chrome.runtime.openOptionsPage(); });
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