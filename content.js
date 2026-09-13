// TabMaxxing Content Script
(function () {
  "use strict";
  if (window.__MB_LOADED) return;
  window.__MB_LOADED = true;

  // Auto-relay runtime errors to Background debug store (filtering out benign 3rd-party noise)
  const BENIGN_ERRORS = [
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",
    "ResizeObserver loop limit exceeded"
  ];

  window.addEventListener('error', (e) => {
    try {
      const msg = e.message || '';
      if (BENIGN_ERRORS.some(b => msg.includes(b))) return;
      // If error is from an external 3rd-party script unrelated to tabmaxxing or page DOM
      if (!msg && !e.filename) return;

      chrome.runtime.sendMessage({
        action: 'AGENTIC_LOG',
        category: 'PAGE_ERROR',
        logs: [`[${location.hostname}] ${msg || 'Error'} at ${e.filename || 'inline'}:${e.lineno || 0}:${e.colno || 0}`]
      });
    } catch (_) {}
  });

  window.addEventListener('unhandledrejection', (e) => {
    try {
      const reasonMsg = e.reason?.message || String(e.reason || '');
      if (BENIGN_ERRORS.some(b => reasonMsg.includes(b))) return;

      chrome.runtime.sendMessage({
        action: 'AGENTIC_LOG',
        category: 'PAGE_UNHANDLED_REJECTION',
        logs: [`[${location.hostname}] ${reasonMsg}`]
      });
    } catch (_) {}
  });

  const IMG_SELECTORS = 'img, picture, canvas, svg image, object[type^="image"], embed[type^="image"], [role="img"]';
  const BG_SELECTORS = '[style*="background-image"], [style*="url("]';
  const VID_SELECTORS = 'video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"], iframe[src*="twitch"], iframe[src*="tiktok"], iframe[src*="facebook"], iframe[src*="instagram"], iframe[src*="twitter"], iframe[src*="x.com"], object[type^="video"], embed[type^="video"]';
  
  const prefix = (parent, selectors) => selectors.split(',').map(s => `${parent} ${s.trim()}`).join(', ');

  const PIXELATE_SVG = `<svg id="__mb_svg_filters__" width="0" height="0" style="position:absolute;z-index:-1;"><filter id="mb-pixelate-filter"><feGaussianBlur stdDeviation="6" result="blur" /><feComponentTransfer in="blur" result="discrete"><feFuncR type="discrete" tableValues="0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1"/><feFuncG type="discrete" tableValues="0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1"/><feFuncB type="discrete" tableValues="0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1"/></feComponentTransfer></filter></svg>`;

  const DARK_MODE_CSS = `
    html[data-mb-darkmode="true"] {
      background-color: #121216 !important;
      filter: invert(1) hue-rotate(180deg) !important;
    }
    html[data-mb-darkmode="true"] body {
      background-color: #121216 !important;
    }
    /* Counter-invert all media in dark mode so they appear completely natural */
    ${prefix('html[data-mb-darkmode="true"]', IMG_SELECTORS)},
    ${prefix('html[data-mb-darkmode="true"]', VID_SELECTORS)},
    ${prefix('html[data-mb-darkmode="true"]', BG_SELECTORS)} {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    /* When Media Invert feature is explicitly enabled on images/videos, apply user negative filter */
    ${prefix('html[data-mb-darkmode="true"]:root[data-mb-target-img="true"][data-mb-invert="true"]', IMG_SELECTORS)},
    ${prefix('html[data-mb-darkmode="true"]:root[data-mb-target-vid="true"][data-mb-invert="true"]', VID_SELECTORS)} {
      filter: none !important;
    }
  `;

  const MASTER_CSS = `:root { --mb-blur-filter: blur(0px); --mb-grayscale: 0%; --mb-invert: 0; --mb-hue: 0deg; --mb-opacity: 1; } :root[data-mb-invert="true"] { --mb-invert: 1; --mb-hue: 180deg; } :root[data-mb-uniform="true"] { --mb-grayscale: 100%; } :root[data-mb-block="true"] { --mb-opacity: 0; } ${prefix(':root[data-mb-target-img="true"]', IMG_SELECTORS)}, ${prefix(':root[data-mb-target-vid="true"]', VID_SELECTORS)} { filter: var(--mb-blur-filter) grayscale(var(--mb-grayscale)) invert(var(--mb-invert)) hue-rotate(var(--mb-hue)) !important; opacity: var(--mb-opacity) !important; } ${prefix(':root[data-mb-ready="true"][data-mb-target-img="true"]', IMG_SELECTORS)}, ${prefix(':root[data-mb-ready="true"][data-mb-target-vid="true"]', VID_SELECTORS)} { transition: filter 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease !important; } ${prefix(':root[data-mb-target-vid="true"]', VID_SELECTORS)} { transform: translateZ(0); } ${prefix(':root[data-mb-target-img="true"][data-mb-hover="true"]', IMG_SELECTORS).split(',').map(s => `${s.trim()}:hover`).join(', ')}, ${prefix(':root[data-mb-target-vid="true"][data-mb-hover="true"]', VID_SELECTORS).split(',').map(s => `${s.trim()}:hover`).join(', ')} { --mb-blur-filter: blur(0px) !important; --mb-grayscale: 0% !important; --mb-invert: 0 !important; --mb-hue: 0deg !important; --mb-opacity: 1 !important; } ${prefix(':root[data-mb-target-img="true"][data-mb-hover="true"]', IMG_SELECTORS)}, ${prefix(':root[data-mb-target-vid="true"][data-mb-hover="true"]', VID_SELECTORS)} { cursor: pointer !important; } ${prefix(':root[data-mb-target-img="true"][data-mb-block="true"]', 'img')} { position: relative !important; visibility: hidden !important; } ${prefix(':root[data-mb-target-img="true"][data-mb-block="true"]', 'img')}::after { content: attr(alt) " (Media Blocked)" !important; visibility: visible !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: #1a1a1f !important; color: #a0a0b0 !important; font-size: 13px !important; font-family: sans-serif !important; display: flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; padding: 8px !important; box-sizing: border-box !important; border: 1px dashed #3a3a4a !important; overflow: hidden !important; text-overflow: ellipsis !important; } ${prefix(':root[data-mb-target-vid="true"][data-mb-block="true"]', VID_SELECTORS)} { pointer-events: none !important; } ${prefix(':root[data-mb-target-img="true"][data-mb-block="true"]', BG_SELECTORS)} { background-image: none !important; } ${DARK_MODE_CSS}`;

  function injectMasterStyle() {
    if (!document.getElementById("__mb_svg_filters__")) {
      const svgContainer = document.createElement("div"); svgContainer.innerHTML = PIXELATE_SVG;
      (document.body || document.documentElement).appendChild(svgContainer);
    }
    if (!document.getElementById("__mediablock_master_style__")) {
      const style = document.createElement("style"); style.id = "__mediablock_master_style__"; style.textContent = MASTER_CSS;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  let isForceRightClickOn = false;
  const FRC_EVENTS = ['contextmenu', 'copy', 'selectstart'];
  function onFrcCaptureEvent(e) {
    if (isForceRightClickOn) {
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }

  function toggleForceRightClick(enabled) {
    isForceRightClickOn = Boolean(enabled);
    FRC_EVENTS.forEach(evt => {
      window.removeEventListener(evt, onFrcCaptureEvent, true);
      if (isForceRightClickOn) {
        window.addEventListener(evt, onFrcCaptureEvent, true);
      }
    });
    toggleForceRightClickStyle(isForceRightClickOn);
  }



  function toggleForceRightClickStyle(enabled) {
      let styleEl = document.getElementById("__mb_frc_style__");
      if (enabled) {
          if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = "__mb_frc_style__";
              styleEl.innerHTML = `* { -webkit-user-select: text !important; user-select: text !important; pointer-events: auto !important; }`;
              (document.head || document.documentElement).appendChild(styleEl);
          }
      } else { if (styleEl) styleEl.remove(); }
  }

  let isStableVolumeOn = false; 
  let isMonoAudioOn = false;
  let isSmoothVolumeOn = false;
  let audioEqMode = 'stable'; 
  let currentAudioLufs = -12;
  let audioCtx = null; 
  const processedMedia = new WeakMap();

  function updateMonoNodeState(monoNode, enabled) {
    if (!monoNode) return;
    if (enabled) {
      monoNode.channelCount = 1;
      monoNode.channelCountMode = "explicit";
      monoNode.channelInterpretation = "speakers";
    } else {
      monoNode.channelCount = 2;
      monoNode.channelCountMode = "max";
      monoNode.channelInterpretation = "speakers";
    }
  }

  function attachAudioProcessing(mediaEl) {
    if (!isStableVolumeOn && !isMonoAudioOn && !isSmoothVolumeOn) return;
    if (processedMedia.has(mediaEl)) return;
    
    try {
      const src = mediaEl.currentSrc || mediaEl.src;
      if (src) {
        const url = new URL(src, window.location.href);
        if (url.origin !== window.location.origin && url.protocol !== 'blob:' && url.protocol !== 'data:' && !mediaEl.crossOrigin) {
          return; // Skip cross-origin media to prevent outputting zeroes
        }
      }
    } catch(e) {}

    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(mediaEl);

      // Mono Audio Downmixer Node
      const monoNode = audioCtx.createGain();
      updateMonoNodeState(monoNode, isMonoAudioOn);
      
      const lowEQ = audioCtx.createBiquadFilter(); 
      lowEQ.type = "lowshelf"; 
      lowEQ.frequency.value = 250;
      
      const midEQ = audioCtx.createBiquadFilter(); 
      midEQ.type = "peaking"; 
      midEQ.frequency.value = 2000; 
      midEQ.Q.value = 1.0;

      const highEQ = audioCtx.createBiquadFilter();
      highEQ.type = "highshelf";
      highEQ.frequency.value = 6000;
      
      // Stage 1: Dynamic Range Leveler
      const compressor = audioCtx.createDynamicsCompressor(); 
      compressor.threshold.value = currentAudioLufs; 
      compressor.knee.value = 12; 
      compressor.ratio.value = 12; 
      compressor.attack.value = 0.003; 
      compressor.release.value = 0.20;   
      
      const makeupGain = audioCtx.createGain(); 
      makeupGain.gain.value = 1.8; 

      // Stage 2: Fast Brickwall Peak Limiter
      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;
      
      const effectGain = audioCtx.createGain(); 
      effectGain.gain.value = isStableVolumeOn ? 1 : 0;
      
      const bypassGain = audioCtx.createGain(); 
      bypassGain.gain.value = isStableVolumeOn ? 0 : 1;
      
      const fadeGain = audioCtx.createGain();
      fadeGain.gain.value = isSmoothVolumeOn ? 0 : 1; // Start at 0 if smooth volume is active during creation
      
      // Source feeds mono downmixer first
      source.connect(monoNode);

      // Effect Path (EQ + Compressor + Limiter)
      monoNode.connect(lowEQ); 
      lowEQ.connect(midEQ); 
      midEQ.connect(highEQ);
      highEQ.connect(compressor); 
      compressor.connect(makeupGain); 
      makeupGain.connect(limiter);
      limiter.connect(effectGain); 
      effectGain.connect(fadeGain); 
      
      // Bypass Path
      monoNode.connect(bypassGain); 
      bypassGain.connect(fadeGain);
      
      fadeGain.connect(audioCtx.destination);
      
      const audioNodes = { source, effectGain, bypassGain, lowEQ, midEQ, highEQ, compressor, limiter, monoNode, fadeGain };
      processedMedia.set(mediaEl, audioNodes);
      updateEQNodes(audioNodes);

      const cleanupMediaAudio = () => {
        try {
          fadeGain.disconnect();
          source.disconnect();
          monoNode.disconnect();
        } catch (_) {}
      };
      mediaEl.addEventListener('emptied', cleanupMediaAudio, { once: true });
      mediaEl.addEventListener('error', cleanupMediaAudio, { once: true });
    } catch (e) { }
  }

  function updateEQNodes(nodes) {
    if (!nodes) return;
    switch (audioEqMode) {
      case 'stable':
        nodes.lowEQ.gain.value = 0; nodes.midEQ.gain.value = 0; nodes.highEQ.gain.value = 0;
        break;
      case 'dialogue':
        nodes.lowEQ.gain.value = -4; nodes.midEQ.gain.value = 6; nodes.highEQ.gain.value = 3;
        break;
      case 'bass_cut':
        nodes.lowEQ.gain.value = -12; nodes.midEQ.gain.value = 0; nodes.highEQ.gain.value = 0;
        break;
      case 'bass_boost':
        nodes.lowEQ.gain.value = 8; nodes.midEQ.gain.value = -2; nodes.highEQ.gain.value = -2;
        break;
      case 'music':
        nodes.lowEQ.gain.value = 4; nodes.midEQ.gain.value = -2; nodes.highEQ.gain.value = 4;
        break;
      case 'cinema':
        nodes.lowEQ.gain.value = 6; nodes.midEQ.gain.value = 2; nodes.highEQ.gain.value = 4;
        break;
      default:
        nodes.lowEQ.gain.value = 0; nodes.midEQ.gain.value = 0; nodes.highEQ.gain.value = 0;
    }
  }

  function toggleMonoAudioLive(enabled) {
    isMonoAudioOn = enabled; 
    const mediaEls = document.querySelectorAll('video, audio'); 
    if (enabled) mediaEls.forEach(attachAudioProcessing);
    mediaEls.forEach(el => { 
      const nodes = processedMedia.get(el); 
      if (nodes && nodes.monoNode) updateMonoNodeState(nodes.monoNode, enabled); 
    });
    if (enabled && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function toggleStableVolumeLive(enabled) {
    isStableVolumeOn = enabled; 
    const mediaEls = document.querySelectorAll('video, audio'); 
    if (enabled) mediaEls.forEach(attachAudioProcessing);
    mediaEls.forEach(el => { 
      const nodes = processedMedia.get(el); 
      if (nodes) { 
        const ctxTime = audioCtx ? audioCtx.currentTime : 0;
        nodes.effectGain.gain.setTargetAtTime(enabled ? 1 : 0, ctxTime, 0.05); 
        nodes.bypassGain.gain.setTargetAtTime(enabled ? 0 : 1, ctxTime, 0.05); 
        updateEQNodes(nodes); 
      } 
    });
    if (enabled && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }
  
  function toggleSmoothVolumeLive(enabled) {
    isSmoothVolumeOn = enabled;
    const mediaEls = document.querySelectorAll('video, audio'); 
    if (enabled) mediaEls.forEach(attachAudioProcessing);
    mediaEls.forEach(el => { 
      const nodes = processedMedia.get(el); 
      if (nodes && audioCtx) {
        nodes.fadeGain.gain.cancelScheduledValues(audioCtx.currentTime);
        nodes.fadeGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05); 
      }
    });
    if (enabled && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  // Resume AudioContext only on real user interaction to strictly adhere to autoplay policy
  let hasUserInteracted = false;
  const unlockAudioContext = () => {
    hasUserInteracted = true;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, unlockAudioContext, { once: true, passive: true });
  });
  
  document.addEventListener('play', (e) => { 
    if (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') { 
      if ((isStableVolumeOn || isMonoAudioOn || isSmoothVolumeOn) && hasUserInteracted) { 
        attachAudioProcessing(e.target); 
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
      } 
      
      if (isSmoothVolumeOn && hasUserInteracted) {
        const nodes = processedMedia.get(e.target);
        if (nodes && audioCtx) {
           nodes.fadeGain.gain.cancelScheduledValues(audioCtx.currentTime);
           nodes.fadeGain.gain.setValueAtTime(0.01, audioCtx.currentTime); // Exponential ramp cannot start at 0
           nodes.fadeGain.gain.exponentialRampToValueAtTime(1, audioCtx.currentTime + 5); // 5 seconds exponential fade
        }
      }
    } 
  }, true);

  let darkModeEnabled = false;
  let darkObserver = null;

  function applySmartDarkMode() {
    if (!darkModeEnabled) { document.documentElement.removeAttribute("data-mb-darkmode"); return; }
    const root = document.documentElement; const body = document.body; let isDark = false;
    const htmlClasses = (root.className || '').toString().toLowerCase();
    const bodyClasses = body ? (body.className || '').toString().toLowerCase() : '';
    const themeAttrs = [ root.getAttribute('data-theme'), root.getAttribute('theme'), root.getAttribute('data-color-mode'), root.getAttribute('data-bs-theme'), body ? body.getAttribute('data-theme') : null ].map(a => (a || '').toLowerCase());
    if ( htmlClasses.includes('dark') || htmlClasses.includes('night') || bodyClasses.includes('dark') || bodyClasses.includes('night') || themeAttrs.some(attr => attr.includes('dark') || attr.includes('night')) ) { isDark = true; }
    if (!isDark) {
        let computedStyleRoot = window.getComputedStyle(root);
        if (computedStyleRoot.colorScheme.includes('dark') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) { isDark = true; }
    }
    if (!isDark) {
        let elementsToCheck = [root, body];
        if (body) { Array.from(body.children).forEach(child => { if (['DIV', 'MAIN', 'APP-ROOT', 'SECTION'].includes(child.tagName)) { elementsToCheck.push(child); } }); }
        for (let el of elementsToCheck) {
            if (!el) continue;
            let rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
            if (el === root || el === body || (rect.width > window.innerWidth * 0.4 && rect.height > window.innerHeight * 0.4)) {
                let bg = window.getComputedStyle(el).backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                    let match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (match) {
                        let r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
                        let brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                        if (brightness < 127) { isDark = true; }
                        break; 
                    }
                }
            }
        }
    }
    if (isDark) { root.removeAttribute("data-mb-darkmode"); } else { root.setAttribute("data-mb-darkmode", "true"); }
  }

  let darkModeDebounceTimer = null;
  function debouncedSmartDarkMode() {
    if (darkModeDebounceTimer) return;
    darkModeDebounceTimer = setTimeout(() => {
        applySmartDarkMode();
        darkModeDebounceTimer = null;
    }, 250);
  }

  function toggleDarkMode(enabled) {
    darkModeEnabled = enabled;
    if (enabled) {
        applySmartDarkMode();
        if (!darkObserver) {
            darkObserver = new MutationObserver(() => debouncedSmartDarkMode());
            darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'theme'] });
            if (document.body) darkObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        }
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', () => {
                applySmartDarkMode();
                if (darkObserver) darkObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
            });
        }
    } else {
        document.documentElement.removeAttribute("data-mb-darkmode");
        if (darkObserver) { darkObserver.disconnect(); darkObserver = null; }
    }
  }

  let textSpoofingEnabled = false;
  let textSpoofingSeed = "mediablock";
  let textSpoofObserver = null;
  let textSpoofApplyDepth = 0;
  let textSpoofScheduled = false;
  const textSpoofState = new WeakMap();
  const TEXT_SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION",
    "PRE", "CODE", "KBD", "SAMP", "SVG", "CANVAS"
  ]);

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

  function spoofWord(word) {
    const chars = Array.from(word);
    if (chars.length < 4) return word;

    const first = chars[0];
    const last = chars[chars.length - 1];
    const middle = chars.slice(1, -1);
    if (middle.length < 2 || middle.every(ch => ch === middle[0])) return word;

    const rand = seededRandom(hashString(`${textSpoofingSeed}:${word.toLocaleLowerCase()}`));
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

  function spoofText(text) {
    return text.replace(/[\p{L}\p{M}]{4,}/gu, spoofWord);
  }

  function shouldIgnoreTextNode(node) {
    if (!node || !node.nodeValue || !node.nodeValue.trim()) return true;
    const parent = node.parentElement;
    if (!parent || parent.closest('[data-mb-text-spoof-ignore="true"]')) return true;
    if (parent.isContentEditable) return true;
    return TEXT_SKIP_TAGS.has(parent.tagName);
  }

  function shouldSkipTextNode(node) {
    if (shouldIgnoreTextNode(node)) return true;
    const parent = node.parentElement;
    if (!parent) return true;

    const style = window.getComputedStyle(parent);
    return style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0;
  }

  function spoofTextNode(node, alreadyValidated = false) {
    if (!alreadyValidated && shouldSkipTextNode(node)) return;

    const existing = textSpoofState.get(node);
    const original = existing ? existing.original : node.nodeValue;
    const spoofed = spoofText(original);

    if (!existing || existing.original !== original || existing.spoofed !== spoofed) {
      textSpoofState.set(node, { original, spoofed });
    }

    if (node.nodeValue !== spoofed) {
      textSpoofApplyDepth++;
      node.nodeValue = spoofed;
      textSpoofApplyDepth--;
    }
  }

  function restoreTextNode(node) {
    const existing = textSpoofState.get(node);
    if (!existing) return;
    if (node.nodeValue === existing.spoofed) {
      textSpoofApplyDepth++;
      node.nodeValue = existing.original;
      textSpoofApplyDepth--;
    }
    textSpoofState.delete(node);
  }

  function walkTextNodes(root, callback, includeHidden = false) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      if (includeHidden ? !shouldIgnoreTextNode(root) : !shouldSkipTextNode(root)) callback(root, true);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const skip = includeHidden ? shouldIgnoreTextNode(node) : shouldSkipTextNode(node);
        return skip ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while ((node = walker.nextNode())) callback(node, true);
  }

  function applyTextSpoofingToPage() {
    if (!textSpoofingEnabled) return;
    walkTextNodes(document.body || document.documentElement, spoofTextNode);
  }

  let textSpoofScheduleTimer = null;
  function scheduleTextSpoofing() {
    if (!textSpoofingEnabled) return;
    if (textSpoofScheduleTimer) clearTimeout(textSpoofScheduleTimer);
    textSpoofScheduleTimer = setTimeout(() => {
      textSpoofScheduleTimer = null;
      applyTextSpoofingToPage();
    }, 500);
  }

  function startTextSpoofObserver() {
    if (textSpoofObserver) return;
    textSpoofObserver = new MutationObserver((mutations) => {
      if (textSpoofApplyDepth > 0 || !textSpoofingEnabled) return;

      let needsFullPass = false;
      mutations.forEach(mutation => {
        if (mutation.type === "characterData") {
          const existing = textSpoofState.get(mutation.target);
          if (existing && mutation.target.nodeValue !== existing.spoofed) {
            textSpoofState.set(mutation.target, { original: mutation.target.nodeValue, spoofed: "" });
          }
          spoofTextNode(mutation.target);
          return;
        }

        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) spoofTextNode(node);
          else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            walkTextNodes(node, spoofTextNode);
          }
        });

        if (mutation.type === "attributes") needsFullPass = true;
      });

      if (needsFullPass) scheduleTextSpoofing();
    });
    textSpoofObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    });
  }

  function toggleTextSpoofing(enabled) {
    textSpoofingEnabled = enabled;
    document.documentElement.toggleAttribute("data-mb-text-spoofing", enabled);

    if (enabled) {
      applyTextSpoofingToPage();
      startTextSpoofObserver();
      if (!document.body) window.addEventListener("DOMContentLoaded", applyTextSpoofingToPage, { once: true });
    } else {
      if (textSpoofObserver) { textSpoofObserver.disconnect(); textSpoofObserver = null; }
      walkTextNodes(document.body || document.documentElement, restoreTextNode, true);
    }
  }

  function updateTextSpoofSeed(seed) {
    textSpoofingSeed = String(seed || "mediablock");
    if (textSpoofingEnabled) {
      walkTextNodes(document.body || document.documentElement, restoreTextNode, true);
      applyTextSpoofingToPage();
    }
  }

  const STATE_MAP = { mediaBlockEnabled: "data-mb-block", mediaInvertEnabled: "data-mb-invert", mediaHoverEnabled: "data-mb-hover", mediaUniformEnabled: "data-mb-uniform", targetImgEnabled: "data-mb-target-img", targetVidEnabled: "data-mb-target-vid" };

  let currentBlurVal = 25;
  let currentBlurMode = "blur";

  function updateVisualFilter() {
    const root = document.documentElement;
    if (root.getAttribute("data-mb-blur") !== "true") {
      root.style.setProperty("--mb-blur-filter", "blur(0px)");
      return;
    }
    if (currentBlurMode === "pixelate") {
      root.style.setProperty("--mb-blur-filter", "url(#mb-pixelate-filter)");
    } else {
      root.style.setProperty("--mb-blur-filter", `blur(${currentBlurVal}px)`);
    }
  }

  let isTabScoped = false;
  let currentActiveState = {};

  function applyState(key, value) {
    currentActiveState[key] = value;
    const root = document.documentElement;
    if (key === "blurIntensity") { currentBlurVal = value; updateVisualFilter(); }
    else if (key === "blurMode") { currentBlurMode = value; updateVisualFilter(); }
    else if (key === "mediaBlurEnabled") { value ? root.setAttribute("data-mb-blur", "true") : root.removeAttribute("data-mb-blur"); updateVisualFilter(); }
    else if (key === "forceRightClickEnabled") { toggleForceRightClick(value); }
    else if (key === "stableVolumeEnabled") { toggleStableVolumeLive(value); }
    else if (key === "monoAudioEnabled") { toggleMonoAudioLive(value); }
    else if (key === "smoothVolumeEnabled") { toggleSmoothVolumeLive(value); }
    else if (key === "audioEqMode") { audioEqMode = value; document.querySelectorAll('video, audio').forEach(el => updateEQNodes(processedMedia.get(el))); }
    else if (key === "audioLufs") { 
        currentAudioLufs = parseInt(value, 10) || -12; 
        document.querySelectorAll('video, audio').forEach(el => {
            const nodes = processedMedia.get(el);
            if (nodes && nodes.compressor && audioCtx) {
              nodes.compressor.threshold.setTargetAtTime(currentAudioLufs, audioCtx.currentTime, 0.1);
            }
        });
    }
    else if (key === "darkModeEnabled") { toggleDarkMode(value); }
    else if (key === "textSpoofingEnabled") { toggleTextSpoofing(value); }
    else if (key === "textSpoofingSeed") { updateTextSpoofSeed(value); }
    else if (key === "adBlockEnabled") { if (typeof toggleCosmeticAdBlock === "function") toggleCosmeticAdBlock(value); }
    else if (key === "browserLockEnabled") { value ? showLockScreen() : document.getElementById('mb-lock-screen')?.remove(); }
    else if (key === "domainLockEnabled") { if (!value) document.getElementById('mb-domain-lock')?.remove(); }
    else if (STATE_MAP[key]) { value ? root.setAttribute(STATE_MAP[key], "true") : root.removeAttribute(STATE_MAP[key]); }
  }

  function checkDomainLock(state) {
    if (!state.domainLockEnabled) return;
    if (!state.lockedDomains || state.lockedDomains.length === 0) return;
    if (!state.browserLockPassword) return; 
    
    const currentHost = window.location.hostname.toLowerCase();
    const isLocked = state.lockedDomains.some(d => {
      const lockDomain = (d || '').toLowerCase().trim();
      return lockDomain && (currentHost === lockDomain || currentHost.endsWith('.' + lockDomain));
    });
    
    if (isLocked) {
        const sessionKey = 'mb_unlocked_' + currentHost;
        if (!sessionStorage.getItem(sessionKey)) {
            showDomainLockScreen(currentHost);
        }
    }
  }

  function showDomainLockScreen(domain) {
    if (document.getElementById('mb-domain-lock') || document.getElementById('mb-lock-screen')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'mb-domain-lock';
    overlay.style.cssText = `
      position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
      background: #0f0f11 !important; z-index: 2147483647 !important; display: flex !important; flex-direction: column !important; 
      align-items: center !important; justify-content: center !important; font-family: sans-serif !important; color: #f0f0f5 !important;
    `;
    
    overlay.innerHTML = `
      <div style="background: #1a1a1f; padding: 40px; border-radius: 16px; border: 1px solid #2a2a32; text-align: center; width: 340px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
        <div style="margin-bottom: 20px; display: flex; justify-content: center;">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff3b3b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h2 style="margin-bottom: 8px; font-size: 20px;">Site Locked</h2>
        <p style="font-size: 13px; color: #7a7a8a; margin-bottom: 24px;"><b>${domain}</b> requires a password.</p>
        <input type="password" id="mb-domain-pw" placeholder="Enter Password" style="width: 100%; padding: 12px; border-radius: 8px; border: 2px solid #2a2a32; background: #0f0f11; color: #fff; margin-bottom: 12px; outline: none; box-sizing: border-box; font-size: 14px;">
        <button id="mb-domain-unlock-btn" style="width: 100%; padding: 12px; background: #ff3b3b; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.2s;">Unlock Session</button>
        <div id="mb-domain-err" style="color: #ff3b3b; font-size: 12px; margin-top: 12px; display: none;">Incorrect Password</div>
      </div>
    `;
    
    const appendOverlay = () => { if (!document.getElementById('mb-domain-lock')) (document.body || document.documentElement).appendChild(overlay); };
    appendOverlay();
    if (!document.body) window.addEventListener('DOMContentLoaded', appendOverlay);
    
    ['click', 'mousedown', 'wheel', 'contextmenu', 'scroll'].forEach(evt => overlay.addEventListener(evt, e => {
      e.stopPropagation(); e.stopImmediatePropagation();
    }, true));
    
    overlay.addEventListener('keydown', e => {
       e.stopPropagation(); e.stopImmediatePropagation();
       if(e.key === 'Enter') submitPw();
    }, true);

    const pwInput = overlay.querySelector('#mb-domain-pw');
    const errDiv = overlay.querySelector('#mb-domain-err');
    
    const submitPw = () => {
        chrome.runtime.sendMessage({ type: "UNLOCK_ATTEMPT", password: pwInput.value, isDomainUnlock: true }, (res) => {
            if (res && res.success) {
                sessionStorage.setItem('mb_unlocked_' + domain, 'true');
                overlay.remove();
            } else {
                errDiv.style.display = 'block';
                pwInput.value = '';
                pwInput.focus();
            }
        });
    };
    
    overlay.querySelector('#mb-domain-unlock-btn').addEventListener('click', submitPw);
    setTimeout(() => pwInput.focus(), 100);
  }

  function showLockScreen() {
    if (document.getElementById('mb-lock-screen')) return;
    const overlay = document.createElement('div');
    overlay.id = 'mb-lock-screen';
    overlay.style.cssText = `
      position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
      background: #0f0f11 !important; z-index: 2147483647 !important; display: flex !important; flex-direction: column !important; 
      align-items: center !important; justify-content: center !important; font-family: sans-serif !important; color: #f0f0f5 !important;
    `;
    overlay.innerHTML = `<div style="background: #1a1a1f; padding: 40px; border-radius: 16px; border: 1px solid #2a2a32; text-align: center; width: 340px;"><h2>Browser Locked</h2></div>`;
    const appendOverlay = () => { if (!document.getElementById('mb-lock-screen')) (document.body || document.documentElement).appendChild(overlay); };
    appendOverlay();
    if (!document.body) window.addEventListener('DOMContentLoaded', appendOverlay);
    ['click', 'mousedown', 'keydown', 'wheel', 'contextmenu', 'scroll'].forEach(evt => overlay.addEventListener(evt, e => {
      e.stopPropagation(); e.stopImmediatePropagation();
    }, true));
  }

  const DEFAULTS = {
    mediaBlockEnabled: false, mediaInvertEnabled: false, mediaBlurEnabled: false,
    mediaHoverEnabled: false, mediaUniformEnabled: false, forceRightClickEnabled: false,
    stableVolumeEnabled: false, monoAudioEnabled: false, smoothVolumeEnabled: false, darkModeEnabled: false, targetImgEnabled: true, targetVidEnabled: true,
    blurIntensity: 25, blurMode: "blur", audioEqMode: "stable", audioLufs: "-12",
    shortcutAction: "toggle_blur", browserLockEnabled: false, browserLockPassword: "", urlHistory: [],
    textSpoofingEnabled: false, textSpoofingSeed: "mediablock",
    domainLockEnabled: false, lockedDomains: [],
    instaDlEnabled: false, instaDlCopyEnabled: false,
    adBlockEnabled: false
  };

  function init() {
    injectMasterStyle();
    chrome.storage.local.get(DEFAULTS, (state) => {
      if (!state) return;
      if (state.browserLockEnabled) showLockScreen();
      Object.keys(state).forEach(key => applyState(key, state[key]));
      checkDomainLock(state);
      requestAnimationFrame(() => {
        document.documentElement.setAttribute('data-mb-ready', 'true');
      });
    });
  }

  init();

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (!isTabScoped) {
        Object.keys(changes).forEach(key => {
          if (changes[key] !== undefined) {
            applyState(key, changes[key].newValue);
          }
        });
      }
      if (changes.lockedDomains || changes.browserLockPassword || changes.domainLockEnabled) {
        chrome.storage.local.get(DEFAULTS, (state) => checkDomainLock(state));
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_PAGE_TAB_SCOPE") {
      sendResponse({ isScoped: isTabScoped, localState: currentActiveState });
      return true;
    }

    if (message.type === "TOGGLE_PAGE_TAB_SCOPE") {
      isTabScoped = !isTabScoped;
      if (!isTabScoped) {
        chrome.storage.local.get(DEFAULTS, (state) => {
          if (state) {
            Object.keys(state).forEach(key => applyState(key, state[key]));
          }
          sendResponse({ isScoped: false, localState: currentActiveState });
        });
        return true;
      }
      sendResponse({ isScoped: true, localState: currentActiveState });
      return true;
    }

    if (message.type === "UPDATE_PAGE_TAB_SETTING") {
      applyState(message.key, message.value);
      sendResponse({ success: true, localState: currentActiveState });
      return true;
    }
  });

})();