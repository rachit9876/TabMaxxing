// TabMaxxing - AdBlock Cosmetic Filtering Engine (uBlock Origin Lite Architecture)
// Supports:
// Level 0: Off (No action)
// Level 1: Basic (DNR network blocking handled in background service worker)
// Level 2: Optimal (DNR + Domain-specific cosmetic element hiding)
// Level 3: Complete (Optimal + Generic cosmetic hiding via DOM observer and djb2 hash mapping)

(function () {
  "use strict";

  if (window.__TABMAXXING_ADBLOCK_COSMETIC_LOADED) return;
  window.__TABMAXXING_ADBLOCK_COSMETIC_LOADED = true;

  let currentMode = 0; // 0 = off, 1 = basic, 2 = optimal, 3 = complete
  let specificRulesCache = null;
  let genericRulesCache = null;
  let activeSpecificStyle = null;
  let activeGenericStyle = null;
  let domMutationObserver = null;
  let processTimer = null;
  let styleSheetTimer = null;

  const seenHashes = new Set();
  const pendingHashes = new Set();
  const pendingSelectors = [];
  const maxSurveyNodeSlice = 64;

  const pendingNodes = {
    addedNodes: [],
    nodeSet: new Set(),
    add(node) {
      this.addedNodes.push(node);
    },
    next(out) {
      for (const added of this.addedNodes) {
        if (this.nodeSet.has(added)) continue;
        this.nodeSet.add(added);
        if (added.firstElementChild === null) continue;
        const descendants = added.querySelectorAll ? added.querySelectorAll('[id],[class]') : [];
        for (const descendant of descendants) {
          this.nodeSet.add(descendant);
        }
      }
      this.addedNodes.length = 0;
      for (const node of this.nodeSet) {
        this.nodeSet.delete(node);
        out.push(node);
        if (out.length === maxSurveyNodeSlice) break;
      }
    },
    hasNodes() {
      return this.addedNodes.length !== 0 || this.nodeSet.size !== 0;
    }
  };

  // djb2 hash algorithm matching uBO Lite compiler
  function hashFromStr(type, s) {
    const len = s.length;
    const step = (len + 7) >>> 3;
    let hash = ((type << 5) + type) ^ len;
    for (let i = 0; i < len; i += step) {
      hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
    }
    return hash & 0xFFFF;
  }

  function idFromNode(node) {
    const raw = node.id;
    if (typeof raw !== 'string' || raw.length === 0) return;
    const hash = hashFromStr(0x23 /* '#' */, raw.trim());
    if (seenHashes.has(hash)) return;
    seenHashes.add(hash);
    pendingHashes.add(hash);
  }

  function classesFromNode(node) {
    const s = node.getAttribute && node.getAttribute('class');
    if (typeof s !== 'string') return;
    const len = s.length;
    for (let beg = 0, end = 0; beg < len; beg += 1) {
      end = s.indexOf(' ', beg);
      if (end === beg) continue;
      if (end === -1) end = len;
      const token = s.slice(beg, end).trim();
      beg = end;
      if (token.length === 0) continue;
      const hash = hashFromStr(0x2E /* '.' */, token);
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);
      pendingHashes.add(hash);
    }
  }

  function injectCSS(cssText, elementId) {
    if (!cssText || !cssText.trim()) return null;
    let style = document.getElementById(elementId);
    if (!style) {
      style = document.createElement('style');
      style.id = elementId;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = cssText;
    return style;
  }

  function appendCSS(cssText, elementId) {
    if (!cssText || !cssText.trim()) return null;
    let style = document.getElementById(elementId);
    if (!style) {
      style = document.createElement('style');
      style.id = elementId;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent += '\n' + cssText;
    return style;
  }

  // --- Specific Cosmetic Filtering (Mode 2 & 3) ---
  async function applySpecificCosmetic() {
    if (activeSpecificStyle) {
      activeSpecificStyle.remove();
      activeSpecificStyle = null;
    }
    if (currentMode < 2) return;

    try {
      if (!specificRulesCache) {
        const res = await fetch(chrome.runtime.getURL('js/adblock/specific-rules.json'));
        if (!res.ok) return;
        specificRulesCache = await res.json();
      }

      const hostname = window.location.hostname || '';
      if (!hostname) return;

      const matchingSelectors = new Set();
      let hn = hostname;
      while (hn) {
        if (specificRulesCache[hn]) {
          for (const sel of specificRulesCache[hn]) {
            matchingSelectors.add(sel);
          }
        }
        const dotIndex = hn.indexOf('.');
        if (dotIndex === -1) break;
        hn = hn.slice(dotIndex + 1);
      }

      if (matchingSelectors.size > 0) {
        const css = Array.from(matchingSelectors).join(',\n') + ' { display: none !important; }';
        activeSpecificStyle = injectCSS(css, '__tabmax_adblock_specific__');
      }
    } catch (e) {
      console.warn("TabMaxxing specific cosmetic error:", e);
    }
  }

  // --- Generic Cosmetic Filtering (Mode 3) ---
  async function applyGenericCosmetic() {
    stopGenericObserver();
    if (activeGenericStyle) {
      activeGenericStyle.remove();
      activeGenericStyle = null;
    }
    if (currentMode < 3) return;

    try {
      if (!genericRulesCache) {
        const res = await fetch(chrome.runtime.getURL('js/adblock/generic-rules.json'));
        if (!res.ok) return;
        genericRulesCache = await res.json();
      }

      // Inject highly generic selectors immediately
      if (genericRulesCache.highlyGeneric) {
        const highCSS = `${genericRulesCache.highlyGeneric} { display: none !important; }`;
        activeGenericStyle = injectCSS(highCSS, '__tabmax_adblock_generic__');
      }

      // Initial DOM scan
      if (document.body || document.documentElement) {
        const initialNodes = (document.body || document.documentElement).querySelectorAll('[id],[class]');
        for (let i = 0; i < initialNodes.length; i++) {
          idFromNode(initialNodes[i]);
          classesFromNode(initialNodes[i]);
        }
        processPendingGenericHashes();
      }

      // Start observer
      startGenericObserver();
    } catch (e) {
      console.warn("TabMaxxing generic cosmetic error:", e);
    }
  }

  function processPendingGenericHashes() {
    if (!genericRulesCache || !genericRulesCache.lowlyGeneric) return;
    const lowly = genericRulesCache.lowlyGeneric;

    for (const hash of pendingHashes) {
      const selectors = lowly[hash];
      if (selectors) {
        delete lowly[hash]; // Match once
        pendingSelectors.push(selectors);
      }
    }
    pendingHashes.clear();

    if (pendingSelectors.length > 0) {
      const selectorsToHide = pendingSelectors.join(',\n');
      pendingSelectors.length = 0;
      appendCSS(`${selectorsToHide} { display: none !important; }`, '__tabmax_adblock_generic__');
    }
  }

  function processNodesSlice() {
    const nodes = [];
    const t0 = Date.now();
    const deadline = t0 + 4; // 4ms budget
    while (pendingNodes.hasNodes()) {
      pendingNodes.next(nodes);
      if (nodes.length === 0) break;
      for (const node of nodes) {
        idFromNode(node);
        classesFromNode(node);
      }
      nodes.length = 0;
      if (Date.now() >= deadline) break;
    }
    processPendingGenericHashes();
  }

  function onDomMutation(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const added of mutation.addedNodes) {
          if (added.nodeType !== 1) continue;
          if (added.parentElement === null) continue;
          pendingNodes.add(added);
        }
      } else if (mutation.attributeName === 'class') {
        classesFromNode(mutation.target);
      } else if (mutation.attributeName === 'id') {
        idFromNode(mutation.target);
      }
    }

    if (processTimer !== null) return;
    processTimer = setTimeout(() => {
      processTimer = null;
      processNodesSlice();
    }, 64);
  }

  function startGenericObserver() {
    if (domMutationObserver) return;
    domMutationObserver = new MutationObserver(onDomMutation);
    const target = document.documentElement || document.body;
    if (target) {
      domMutationObserver.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'id']
      });
    }
  }

  function stopGenericObserver() {
    if (processTimer !== null) {
      clearTimeout(processTimer);
      processTimer = null;
    }
    if (styleSheetTimer !== null) {
      cancelAnimationFrame(styleSheetTimer);
      styleSheetTimer = null;
    }
    if (domMutationObserver) {
      domMutationObserver.disconnect();
      domMutationObserver = null;
    }
    pendingHashes.clear();
    pendingSelectors.length = 0;
  }

  function updateMode(mode) {
    const parsed = Number(mode) || 0;
    if (parsed === currentMode) return;
    currentMode = parsed;

    if (currentMode === 0 || currentMode === 1) {
      // Modes 0 & 1 do not use cosmetic element hiding
      if (activeSpecificStyle) {
        activeSpecificStyle.remove();
        activeSpecificStyle = null;
      }
      if (activeGenericStyle) {
        activeGenericStyle.remove();
        activeGenericStyle = null;
      }
      stopGenericObserver();
    } else if (currentMode === 2) {
      // Mode 2: Optimal (Specific rules only)
      if (activeGenericStyle) {
        activeGenericStyle.remove();
        activeGenericStyle = null;
      }
      stopGenericObserver();
      applySpecificCosmetic();
    } else if (currentMode >= 3) {
      // Mode 3: Complete (Specific + Generic)
      applySpecificCosmetic();
      applyGenericCosmetic();
    }
  }

  // Read initial storage settings
  chrome.storage.local.get(['adBlockMode', 'adBlockEnabled'], (res) => {
    let mode = 0;
    if (typeof res.adBlockMode === 'number') {
      mode = res.adBlockMode;
    } else if (res.adBlockEnabled) {
      mode = 1;
    }
    updateMode(mode);
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.adBlockMode !== undefined) {
        updateMode(changes.adBlockMode.newValue);
      } else if (changes.adBlockEnabled !== undefined) {
        updateMode(changes.adBlockEnabled.newValue ? 1 : 0);
      }
    }
  });

  // Hook DOMContentLoaded in case document hasn't finished initial structure
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (currentMode >= 2) applySpecificCosmetic();
      if (currentMode >= 3) applyGenericCosmetic();
    }, { once: true });
  }
})();
