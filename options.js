window.addEventListener('error', (e) => {
  try {
    chrome.runtime.sendMessage({
      action: 'AGENTIC_LOG',
      category: 'OPTIONS_ERROR',
      logs: [`${e.message || 'Error'} at ${e.filename}:${e.lineno}:${e.colno}`]
    });
  } catch (_) {}
});

window.addEventListener('unhandledrejection', (e) => {
  try {
    chrome.runtime.sendMessage({
      action: 'AGENTIC_LOG',
      category: 'OPTIONS_UNHANDLED_REJECTION',
      logs: [`${e.reason?.message || String(e.reason)}`]
    });
  } catch (_) {}
});

document.addEventListener('DOMContentLoaded', () => {
  const inputs = {
    targetImgEnabled: document.getElementById('targetImgEnabled'),
    targetVidEnabled: document.getElementById('targetVidEnabled'),
    forceRightClickEnabled: document.getElementById('forceRightClickEnabled'),
    darkModeEnabled: document.getElementById('darkModeEnabled'),
    blurMode: document.getElementById('blurMode'),
    blurIntensity: document.getElementById('blurIntensity'),
    stableVolumeEnabled: document.getElementById('stableVolumeEnabled'),
    monoAudioEnabled: document.getElementById('monoAudioEnabled'),
    smoothVolumeEnabled: document.getElementById('smoothVolumeEnabled'),
    audioEqMode: document.getElementById('audioEqMode'),
    audioLufs: document.getElementById('audioLufs'),
    shortcutAction: document.getElementById('shortcutAction'),
    textSpoofingEnabled: document.getElementById('textSpoofingEnabled'),
    textSpoofingSeed: document.getElementById('textSpoofingSeed'),
    browserLockPassword: document.getElementById('browserLockPassword'),
    browserLockPasswordConfirm: document.getElementById('browserLockPasswordConfirm'),
    domainLockEnabled: document.getElementById('domainLockEnabled'),
    instaDlEnabled: document.getElementById('instaDlEnabled'),
    instaDlCopyEnabled: document.getElementById('instaDlCopyEnabled'),
    adBlockMode: document.getElementById('adBlockMode')
  };
  
  const historyContainer = document.getElementById('historyContainer');
  const textSpoofPreview = document.getElementById('textSpoofPreview');

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }
  
  function updateIntensityLabel() {
    const isPixelate = inputs.blurMode.value === 'pixelate';
    document.getElementById('blurIntensityLabel').textContent = isPixelate ? 'Mosaic Intensity' : 'Blur Intensity';
    updateIntensityBadge();
  }

  function updateIntensityBadge() {
    const badge = document.getElementById('blurIntensityVal');
    if (!badge) return;
    const val = inputs.blurIntensity ? inputs.blurIntensity.value : 25;
    const isPixelate = inputs.blurMode && inputs.blurMode.value === 'pixelate';
    badge.textContent = isPixelate ? `Lvl ${val}` : `${val}px`;
  }

  // --- Live Text Spoofing Preview Logic ---
  function hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function spoofWord(word, seed) {
    const chars = Array.from(word);
    if (chars.length < 4) return word;

    const first = chars[0];
    const last = chars[chars.length - 1];
    const middle = chars.slice(1, -1);
    if (middle.length < 2 || middle.every(ch => ch === middle[0])) return word;

    const rand = seededRandom(hashString(`${seed}:${word.toLocaleLowerCase()}`));
    const originalMiddle = middle.join("");

    for (let i = middle.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [middle[i], middle[j]] = [middle[j], middle[i]];
    }

    if (middle.join("") === originalMiddle && middle[0] !== middle[middle.length - 1]) {
      [middle[0], middle[middle.length - 1]] = [middle[middle.length - 1], middle[0]];
    }

    return `${first}${middle.join("")}${last}`;
  }

  function updateSpoofPreview() {
    if (!textSpoofPreview) return;
    const originalSample = 'alt: "A golden retriever puppy running through a field"';
    const isEnabled = inputs.textSpoofingEnabled ? inputs.textSpoofingEnabled.checked : true;
    const seed = (inputs.textSpoofingSeed ? inputs.textSpoofingSeed.value.trim() : "") || "mediablock";

    if (!isEnabled) {
      textSpoofPreview.textContent = originalSample;
    } else {
      const spoofed = originalSample.replace(/[\p{L}\p{M}]{4,}/gu, (w) => spoofWord(w, seed));
      textSpoofPreview.textContent = spoofed;
    }
  }

  function renderHistory(historyArray) {
    historyContainer.innerHTML = '';
    if (!historyArray || historyArray.length === 0) {
      historyContainer.innerHTML = '<div style="padding: 20px; text-align:center; color: var(--text-secondary); font-size:13px;">No recent links. Right click any media to shorten!</div>';
      return;
    }
    
    historyArray.forEach(item => {
      const div = document.createElement('div'); div.className = 'history-item';
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(item.short)}&bgcolor=FFFFFF&color=000000`;
      const qrUrlHighRes = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(item.short)}&bgcolor=FFFFFF&color=000000`;
      const shortUrl = escapeHtml(item.short);
      const originalUrl = escapeHtml(item.original);
      
      div.innerHTML = `
        <div class="qr-box" title="Click to expand"><img src="${qrUrl}" alt="QR Code"></div>
        <div class="link-info">
          <a href="${shortUrl}" target="_blank" rel="noopener noreferrer" class="link-short">${shortUrl}</a>
          <span class="link-original" title="${originalUrl}">${originalUrl}</span>
        </div>
      `;
      
      div.querySelector('.qr-box').addEventListener('click', () => {
        document.getElementById('qrModalImg').src = qrUrlHighRes;
        document.getElementById('qrModal').style.display = 'flex';
      });
      historyContainer.appendChild(div);
    });
  }
  
  function renderLockedDomains(domains) {
    const container = document.getElementById('lockedDomainsList');
    container.innerHTML = '';
    if (!domains || domains.length === 0) {
      container.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px; padding: 4px;">No domains locked.</div>';
      return;
    }
    domains.forEach(domain => {
      const div = document.createElement('div');
      div.style.cssText = "display: flex; justify-content: space-between; background: #1e1e26; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--off-border); font-size: 13px; align-items: center;";
      const safeDomain = escapeHtml(domain);
      div.innerHTML = `<span>${safeDomain}</span> <button class="remove-domain-btn" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-weight:bold; transition: 0.2s;">X</button>`;
      
      const removeBtn = div.querySelector('.remove-domain-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          chrome.storage.local.get(['lockedDomains'], (res) => {
            const updated = (res.lockedDomains || []).filter(d => d !== domain);
            updateSetting("lockedDomains", updated);
          });
        });
      }
      
      container.appendChild(div);
    });
  }

  document.getElementById('closeQrModal').addEventListener('click', () => document.getElementById('qrModal').style.display = 'none');
  document.getElementById('qrModal').addEventListener('click', (e) => { if(e.target.id === 'qrModal') document.getElementById('qrModal').style.display = 'none'; });

  function loadSettings() {
    chrome.runtime.sendMessage({ type: "GET_ALL_STATE" }, (state) => {
      if (!state) return;

      inputs.targetImgEnabled.checked = state.targetImgEnabled;
      inputs.targetVidEnabled.checked = state.targetVidEnabled;
      inputs.forceRightClickEnabled.checked = state.forceRightClickEnabled;
      inputs.darkModeEnabled.checked = state.darkModeEnabled;
      inputs.blurMode.value = state.blurMode;
      inputs.blurIntensity.value = state.blurIntensity;
      inputs.stableVolumeEnabled.checked = state.stableVolumeEnabled;
      if (inputs.monoAudioEnabled) inputs.monoAudioEnabled.checked = state.monoAudioEnabled || false;
      if (inputs.smoothVolumeEnabled) inputs.smoothVolumeEnabled.checked = state.smoothVolumeEnabled || false;
      inputs.audioEqMode.value = state.audioEqMode;
      if (inputs.audioLufs) inputs.audioLufs.value = state.audioLufs || "-12";
      inputs.shortcutAction.value = state.shortcutAction;
      
      if (inputs.textSpoofingEnabled) {
        inputs.textSpoofingEnabled.checked = state.textSpoofingEnabled || false;
      }
      if (inputs.textSpoofingSeed) {
        inputs.textSpoofingSeed.value = state.textSpoofingSeed || "mediablock";
      }
      if (inputs.domainLockEnabled) {
        inputs.domainLockEnabled.checked = state.domainLockEnabled || false;
      }
      if (inputs.instaDlEnabled) {
        inputs.instaDlEnabled.checked = Boolean(state.instaDlEnabled);
      }
      if (inputs.instaDlCopyEnabled) {
        inputs.instaDlCopyEnabled.checked = Boolean(state.instaDlCopyEnabled);
      }
      if (inputs.adBlockMode) {
        const mode = typeof state.adBlockMode === 'number' ? state.adBlockMode : (state.adBlockEnabled ? 1 : 0);
        inputs.adBlockMode.value = String(mode);
        updateAdBlockExplainer(mode);
      }
      
      updateIntensityLabel();
      updateIntensityBadge();
      updateSpoofPreview();
      renderHistory(state.urlHistory);
      renderLockedDomains(state.lockedDomains || []);
      
      const versionEl = document.getElementById("appVersion");
      if (versionEl) versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
      
      inputs.browserLockPassword.value = ""; inputs.browserLockPasswordConfirm.value = "";
      
      if (state.browserLockPassword && state.browserLockPassword !== "") {
        inputs.browserLockPassword.placeholder = "Enter new password...";
        inputs.browserLockPasswordConfirm.placeholder = "Confirm new password...";
        document.getElementById('savePasswordBtn').textContent = "Update";
        document.getElementById('deletePasswordBtn').style.display = "block";
      } else {
        inputs.browserLockPassword.placeholder = "Enter password...";
        inputs.browserLockPasswordConfirm.placeholder = "Confirm password...";
        document.getElementById('savePasswordBtn').textContent = "Save";
        document.getElementById('deletePasswordBtn').style.display = "none";
      }
    });
  }

  const ADBLOCK_EXPLAINERS = {
    0: { title: "0: Off (Disabled)", body: "Content blocking is completely disabled." },
    1: { title: "1: Basic (DNR Only)", body: "Declarative network rules block ad/tracker requests natively at the network level with zero CPU overhead. No cosmetic page modifications." },
    2: { title: "2: Optimal (+ Specific CSS)", body: "Network blocking + domain-specific cosmetic CSS element hiding. Cleanly removes ad containers and empty placeholders tailored for specific sites." },
    3: { title: "3: Complete (+ Generic CSS)", body: "Complete protection matching uBO Lite: Network blocking + Specific element hiding + Generic element observation for full ad removal." }
  };

  function updateAdBlockExplainer(mode) {
    const m = Number(mode) || 0;
    const exp = ADBLOCK_EXPLAINERS[m] || ADBLOCK_EXPLAINERS[0];
    const titleEl = document.getElementById('adBlockModeTitle');
    const bodyEl = document.getElementById('adBlockModeBody');
    if (titleEl) titleEl.textContent = exp.title + ':';
    if (bodyEl) bodyEl.textContent = ' ' + exp.body;
  }

  loadSettings();

  function updateSetting(key, value) {
    chrome.runtime.sendMessage({ type: "UPDATE_SETTING", key, value });
  }

  if (inputs.adBlockMode) {
    inputs.adBlockMode.addEventListener('change', (e) => {
      const mode = parseInt(e.target.value, 10) || 0;
      updateSetting('adBlockMode', mode);
      updateSetting('adBlockEnabled', mode >= 1);
      updateAdBlockExplainer(mode);
    });
  }

  ['targetImgEnabled', 'targetVidEnabled', 'forceRightClickEnabled', 'stableVolumeEnabled', 'monoAudioEnabled', 'smoothVolumeEnabled', 'darkModeEnabled', 'textSpoofingEnabled', 'domainLockEnabled', 'instaDlEnabled', 'instaDlCopyEnabled'].forEach(key => {
    if (inputs[key]) {
      inputs[key].addEventListener('change', (e) => {
        updateSetting(key, e.target.checked);
        if (key === 'textSpoofingEnabled') updateSpoofPreview();
        
        if (key === 'stableVolumeEnabled' && e.target.checked && inputs.smoothVolumeEnabled) {
          inputs.smoothVolumeEnabled.checked = false;
          updateSetting('smoothVolumeEnabled', false);
        } else if (key === 'smoothVolumeEnabled' && e.target.checked && inputs.stableVolumeEnabled) {
          inputs.stableVolumeEnabled.checked = false;
          updateSetting('stableVolumeEnabled', false);
        }
      });
    }
  });

  if (inputs.textSpoofingSeed) {
    inputs.textSpoofingSeed.addEventListener('input', () => {
      updateSpoofPreview();
    });
    inputs.textSpoofingSeed.addEventListener('change', (e) => {
      const seed = e.target.value.trim() || "mediablock";
      e.target.value = seed;
      updateSetting('textSpoofingSeed', seed);
      updateSpoofPreview();
    });
  }

  ['blurMode', 'audioEqMode', 'audioLufs', 'shortcutAction'].forEach(key => {
    if (inputs[key]) {
      inputs[key].addEventListener('change', (e) => {
        updateSetting(key, e.target.value);
        if (key === 'blurMode') updateIntensityLabel();
      });
    }
  });

  if (inputs.blurIntensity) {
    inputs.blurIntensity.addEventListener('input', (e) => {
      updateSetting('blurIntensity', parseInt(e.target.value, 10));
      updateIntensityBadge();
    });
  }

  function showFeedback(msg, isError = false) {
    const feedback = document.getElementById('passwordFeedback');
    feedback.textContent = msg; feedback.style.color = isError ? "var(--danger)" : "#10b981"; 
    feedback.style.display = "block"; setTimeout(() => { feedback.style.display = "none"; }, 3000);
  }

  document.getElementById('savePasswordBtn').addEventListener('click', () => {
    const pw = inputs.browserLockPassword.value;
    const confirmPw = inputs.browserLockPasswordConfirm.value;
    if (!pw) { showFeedback("Password cannot be empty!", true); return; }
    if (pw !== confirmPw) { showFeedback("Passwords do not match!", true); return; }

    updateSetting('browserLockPassword', pw);
    
    inputs.browserLockPassword.value = ""; inputs.browserLockPasswordConfirm.value = "";
    inputs.browserLockPassword.placeholder = "Enter new password..."; inputs.browserLockPasswordConfirm.placeholder = "Confirm new password...";
    document.getElementById('savePasswordBtn').textContent = "Update"; document.getElementById('deletePasswordBtn').style.display = "block";
    showFeedback("Password saved successfully!");
  });

  document.getElementById('deletePasswordBtn').addEventListener('click', () => {
    if (confirm("Remove your password? This will also disable Domain Locks.")) {
      updateSetting('browserLockPassword', ""); updateSetting('browserLockEnabled', false); 
      inputs.browserLockPassword.value = ""; inputs.browserLockPasswordConfirm.value = "";
      inputs.browserLockPassword.placeholder = "Enter password..."; inputs.browserLockPasswordConfirm.placeholder = "Confirm password...";
      document.getElementById('savePasswordBtn').textContent = "Save"; document.getElementById('deletePasswordBtn').style.display = "none";
      showFeedback("Password removed!");
    }
  });

  document.getElementById('addDomainBtn').addEventListener('click', () => {
    const input = document.getElementById('newLockedDomain');
    let val = input.value.trim().toLowerCase();
    if (!val) return;
    
    // Strip out http://, https://, and www. if pasted directly from URL bar
    val = val.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    if (!/^[a-z0-9.-]+$/.test(val) || !val.includes('.')) {
      alert("Enter a valid domain, for example reddit.com");
      return;
    }
    
    chrome.storage.local.get(['lockedDomains'], (res) => {
      const current = res.lockedDomains || [];
      if (!current.includes(val)) {
        current.push(val);
        updateSetting("lockedDomains", current);
        input.value = '';
      }
    });
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, () => renderHistory([]));
  });

  // Live Diagnostics & Dev Error Console
  const logsContainer = document.getElementById('agenticLogsContainer');
  const copyLogsBtn = document.getElementById('copyLogsBtn');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  function renderLogs(logs) {
    if (!logsContainer) return;
    if (!logs || !logs.length) {
      logsContainer.textContent = "[Ready] No runtime errors recorded.";
      logsContainer.style.color = '#818cf8';
      return;
    }
    logsContainer.textContent = logs.join('\n');
    logsContainer.style.color = logs.some(l => l.includes('ERROR') || l.includes('REJECTION')) ? '#f87171' : '#a5b4fc';
  }

  chrome.storage.local.get(['agenticDebugLogs'], (res) => {
    renderLogs(res.agenticDebugLogs || []);
  });

  if (copyLogsBtn) {
    copyLogsBtn.addEventListener('click', async () => {
      const txt = logsContainer ? logsContainer.textContent : '';
      await navigator.clipboard.writeText(txt);
      copyLogsBtn.textContent = 'Copied!';
      setTimeout(() => { copyLogsBtn.textContent = 'Copy All'; }, 1500);
    });
  }

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      chrome.storage.local.set({ agenticDebugLogs: [] }, () => {
        renderLogs([]);
      });
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.agenticDebugLogs) {
        renderLogs(changes.agenticDebugLogs.newValue || []);
      }
      Object.keys(changes).forEach(key => {
        const newValue = changes[key].newValue;
        if (inputs[key] && !['browserLockPassword', 'browserLockPasswordConfirm'].includes(key)) {
          if (['blurIntensity', 'shortcutAction', 'blurMode', 'audioEqMode', 'audioLufs', 'textSpoofingSeed'].includes(key)) {
            inputs[key].value = newValue;
            if (key === 'blurMode' || key === 'blurIntensity') {
              updateIntensityLabel();
              updateIntensityBadge();
            }
            if (key === 'textSpoofingSeed') updateSpoofPreview();
          } else {
            inputs[key].checked = newValue;
            if (key === 'textSpoofingEnabled') updateSpoofPreview();
          }
        } else if (key === 'urlHistory') {
          renderHistory(newValue);
        } else if (key === 'lockedDomains') {
          renderLockedDomains(newValue);
        } else if (key === 'browserLockPassword') {
          loadSettings(); 
        }
      });
    }
  });

});