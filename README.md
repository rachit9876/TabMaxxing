# TabMaxxing

**TabMaxxing** is an all-in-one power tools & privacy suite for Chromium browsers (Manifest V3). It bundles visual privacy filters (blur, pixelate, block, invert), an audio leveling engine, an ad & tracker shield, an Instagram media downloader, full-page screenshot capture, reverse image search, text spoofing, password locks, and everyday utilities like QR codes and URL shortening — all configurable globally or per tab.

[Download the latest ZIP](https://github.com/rachit9876/TabMaxxing/archive/refs/heads/main.zip)

## Features

### Visual Privacy & Media Filtering
| Feature | What it does |
| :--- | :--- |
| **Blur / Pixelate** | Applies a CSS Gaussian blur (5–50 px, adjustable) or an SVG pixel-mosaic filter to all targeted media. |
| **Total Media Block** | Hides images/videos and, at the network level, blocks image and video requests via `declarativeNetRequest` rulesets (saves bandwidth). Blocked images show an `alt`-text placeholder. |
| **Invert / Uniform Gray** | Inverts media colors or converts them to grayscale for low-distraction reading. |
| **Hover Reveal** | Temporarily restores blurred/hidden media while the cursor is over it. |
| **Media Targets** | Independently target Images (incl. `picture`, `canvas`, CSS backgrounds) and Videos (incl. embedded iframes). |
| **Smart Dark Mode** | Inverts only pages that appear light, counter-inverting media so images and videos keep natural colors. |

### Ad Shield (uBlock Origin Lite–style engine)
Four protection levels, selectable in the popup or the options page:

| Mode | Behavior |
| :--- | :--- |
| **0 — Off** | No filtering. |
| **1 — Basic** | Network blocking only, via bundled `declarativeNetRequest` rulesets (uBlock filters, EasyList, EasyPrivacy, Peter Lowe's list, uBlock badware, URLhaus). Zero page-side CPU. |
| **2 — Optimal** | Basic + domain-specific cosmetic element hiding, matched against the hostname and uBO entity rules (`example.*`). |
| **3 — Complete** | Optimal + generic cosmetic hiding: highly generic selectors are injected immediately; lowly generic selectors are resolved through djb2 hash mapping of observed ids/classes with a time-sliced DOM mutation observer. |

### Audio Engine (Web Audio API)
| Feature | What it does |
| :--- | :--- |
| **Stable Volume** | Routes media through a compressor + makeup gain + brickwall limiter chain to level loudness spikes and lift quiet dialogue. |
| **Loudness Target** | Compressor threshold selectable from −10 to −20 LUFS. |
| **EQ Profiles** | Flat, Dialogue Boost, Night Mode (bass cut), Heavy Bass, Music, Cinema. |
| **Mono Downmix** | Folds stereo into mono for single-earbud listening. |
| **Smooth Volume** | 5-second exponential fade-in when media starts, to avoid ear-blasting autoplay. |

Cross-origin media without a `crossOrigin` attribute is deliberately skipped so the graph never silences playback.

### Instagram Pro (`insta-dl`)
| Feature | What it does |
| :--- | :--- |
| **Download Buttons** | Injects Download buttons on posts, reels, and stories. Photos download at the highest `srcset` resolution; videos resolve the best-quality MP4 through an 8-layer pipeline (direct src → in-page Instagram APIs → React Fiber scan → live network capture via `webRequest` → background API fallback → page script JSON scan → OpenGraph). |
| **1-Click Live Copier** | Copies full-resolution PNG images — or the active video frame — directly to the clipboard for instant pasting into Discord, Slack, etc. Falls back to copying the direct URL if the clipboard image write fails. |
| **Story Handling** | Distinguishes photo stories (`.jpg`) from video stories (`.mp4`). |
| **SPA-aware** | MutationObserver + URL polling keep buttons present while you navigate Instagram's single-page app. |

### Capture & Search Tools
| Feature | What it does |
| :--- | :--- |
| **Full-Page Screenshot** | Auto-scrolls the page (sticky headers hidden after the first slice), captures viewport slices through the extension service worker, and stitches them into a canvas viewer. Includes crop + undo, zoom, high-res PNG download, PDF export (via the browser print dialog), and 1-click clipboard copy. Capped at 100 slices and Chrome's 16384 px / 268 MP canvas limits (long pages are downscaled automatically). |
| **Area Snipping Search** | Drag a selection anywhere on the page to capture it and run a reverse image search on Google Lens, Yandex, and/or TinEye (opened in new tabs). |
| **Right-Click Image Search** | Context-menu entry to search any image by URL or upload. |
| **QR Codes** | Context-menu QR overlays for the page / link / media, a custom QR input in the popup, and enlarged QR previews in the shortening history. |
| **URL Shortener** | 1-click shortening via the free [is.gd](https://is.gd) API (no key or account needed), with copy-to-clipboard and a 20-entry history. |

### Security & Text Privacy
| Feature | What it does |
| :--- | :--- |
| **Text Spoofing** | Deterministic, seed-based typoglycemic scramble of visible words (first/last letters preserved) to defeat shoulder surfing; runs on a MutationObserver so SPA content stays spoofed. |
| **Browser Lock** | Master password (stored only as a SHA-256 hash) that gates the extension popup and covers pages with a lock overlay. |
| **Domain Lock** | Requires the master password before opening selected domains (per-site unlock remembered for the browser session). |
| **Force Right-Click** | Re-enables context menus, text selection, and copy on sites that block them. |
| **Per-Tab Scoping** | "ALL TABS / THIS TAB" switch applies filters to just the active tab without touching global settings. |
| **Diagnostics Console** | Live error log (relayed from content scripts and the service worker) viewable in the options page, with copy/clear. |

### Keyboard Shortcut
`Alt+X` (remappable at `chrome://extensions/shortcuts`) triggers a configurable action: toggle blur, block, invert, uniform, hover, right-click, stable/mono/smooth volume, dark mode, text spoofing, or open settings. The shortcut respects per-tab scoping.

## Installation

1. Download and extract the ZIP from this repository.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder.
5. Pin **TabMaxxing** to the toolbar.

## Permissions & Why They Are Needed

| Permission | Purpose |
| :--- | :--- |
| `storage` | Settings, password hash, domain locks, shortening history, diagnostics logs. |
| `declarativeNetRequest` / `declarativeNetRequestWithHostAccess` | Native network blocking for the Ad Shield and image/video media block. |
| `webRequest` | **Observation only** (MV3 cannot block with it): captures Instagram CDN media URLs in the active tab to resolve `blob:` video downloads. |
| `scripting` | Injects the capture, snipping, QR overlay, and counter scripts on demand. |
| `tabs` | Reads the active tab URL for counters, screenshots, and shortening. |
| `activeTab` | Interacts with the current page on user action. |
| `clipboardWrite` | Copies images, frames, and shortened URLs. |
| `contextMenus` | Right-click image search, QR, and shortening entries. |
| `downloads` | Saves Instagram media and screenshots. |
| `<all_urls>` host access | Content scripts (media filters, text spoofing, locks) must run everywhere. |

### What leaves your browser
- Shortened URLs are sent to **is.gd**; QR codes are rendered by **api.qrserver.com**; reverse image searches send the image URL (or an uploaded crop) to the chosen engine. Instagram media resolution queries Instagram's own endpoints with your logged-in session. The popup/options pages load the *Alata* font from Google Fonts. Everything else — filters, adblock rules, capture, locks — runs fully locally.

## Project Structure

```
manifest.json                  MV3 manifest (permissions, DNR rulesets, commands)
background.js                  Service worker: state, DNR, badge, context menus,
                               shortcuts, shortener, visual search uploaders,
                               Instagram stream capture, download handling
content.js                     Content script: visual filters, smart dark mode,
                               Web Audio engine, force right-click, text spoofing,
                               lock overlays, per-tab scoping
js/adblock/adblock-cosmetic.js Cosmetic filtering engine (specific + generic)
js/adblock/specific-rules.json Domain-keyed specific cosmetic selectors
js/adblock/generic-rules.json  Generic cosmetic selectors (high/low specificity)
insta-dl.js / insta-dl.css     Instagram downloader & clipboard copier
capture.js / capture.css       Full-page scrolling capture orchestrator
capture-viewer.html / .js      Stitched-canvas viewer (crop, zoom, PNG, PDF)
selector.js / selector.css     Area snipping tool for visual search
popup.html / popup.js          Toolbar popup: quick toggles, tools, scoping
options.html / options.js      Settings page: all options, locks, history, logs
rules/block_images.json        DNR ruleset: image requests
rules/block_videos.json        DNR ruleset: video requests
rules/adblock/*.json           DNR rulesets: uBlock, EasyList, EasyPrivacy, etc.
icons/                         Extension icons
convert_icons.py               Utility: converts .ico icons to .png (Pillow)
```

## Development Notes

- `convert_icons.py` regenerates the `.png` icons from the `.ico` files (`pip install Pillow` first).
- The extension stores its settings in `chrome.storage.local`. Setting the Ad Shield mode is the numeric key `adBlockMode` (0–3); a legacy boolean `adBlockEnabled` from older versions is migrated automatically on startup.
- The capture viewer can also be reached directly after a capture; the payload survives service-worker restarts via `chrome.storage.session`.

## Known Limitations

- Full-page capture supports up to 100 viewport slices and downscale-fits Chrome's maximum canvas size; extremely long pages are therefore captured at reduced resolution.
- Instagram's private APIs change frequently; the downloader's multi-layer resolver degrades gracefully, but no resolution can be guaranteed for every post.
- Domain Lock is a convenience/privacy overlay, not OS-level parental control — it guards normal browsing contexts only.
