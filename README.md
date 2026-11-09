# TabMaxxing

**TabMaxxing** is an all-in-one power tools & privacy suite for Chromium browsers (Manifest V3). It bundles visual privacy filters (blur, pixelate, block, invert), an audio leveling engine, an ad & tracker shield, a universal media grabber with a collect-later bucket, full-page screenshot capture, reverse image search, text spoofing, password locks, and everyday utilities like QR codes and URL shortening — all configurable globally or per tab.

[Download the latest ZIP](https://github.com/rachit9876/TabMaxxing/archive/refs/heads/main.zip)

<div align="left">

| <img src="https://dr-fast-upload.pages.dev/public/7c80c0b7700c.webp" /> |
| :---: |

</div>

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

### Media DL & Sensory Bucket (`media-dl`)
| Feature | What it does |
| :--- | :--- |
| **Hover Overlay** | Hovering any image or video (≥ 50 px) for a moment shows a floating toolbar with **Bucket** and **Download** buttons — on every site, not just social platforms. |
| **Quick Download** | Saves the media as a file. Images download from the highest-resolution source available (`srcset` aware, with cross-origin fetching through the service worker and a canvas fallback); videos save the current frame as a JPEG. Large payloads are downloaded through page-side blob URLs so multi-megapixel images never hit the data-URL size cap. |
| **Media Bucket** | Collects media from any number of pages into a persistent local bucket (deduplicated by URL or payload signature, capped at 80 items). The popup's bucket gallery shows thumbnails with dimensions, per-item download, remove, clear-all, and **Download All as ZIP** (packaged locally with the bundled JSZip). |
| **Alt+L Shortcut** | While Media DL is enabled, pressing `Alt+L` logs the currently hovered media straight to the bucket (ignored while typing in form fields). |
| **Per-Tab Scoping** | The "THIS TAB" mode toggles the hover overlay for the current tab only, like every other feature card. |

### Capture & Search Tools
| Feature | What it does |
| :--- | :--- |
| **Full-Page Screenshot** | Auto-scrolls the page (sticky headers hidden after the first slice), captures viewport slices through the extension service worker, and stitches them into a canvas viewer. Includes an interactive crop tool (draw, drag, and corner-resize with correct edge clamping) plus undo, zoom, high-res PNG download, PDF export (via the browser print dialog), and 1-click clipboard copy. Capped at 100 slices and Chrome's 16384 px / 268 MP canvas limits (long pages are downscaled automatically). |
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
`Alt+X` (remappable at `chrome://extensions/shortcuts`) triggers a configurable action: toggle blur, block, invert, uniform, hover, right-click, stable/mono/smooth volume, dark mode, text spoofing, media DL, or open settings. The shortcut respects per-tab scoping.

## Installation

1. Download and extract the ZIP from this repository.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder.
5. Pin **TabMaxxing** to the toolbar.

To update an existing install, extract the new files over your project folder and click **Reload** on the extension card — all settings, the media bucket, and the shortening history live in `chrome.storage.local` and are never touched by file replacement.

## Permissions & Why They Are Needed

| Permission | Purpose |
| :--- | :--- |
| `storage` | Settings, password hash, domain locks, shortening history, diagnostics logs, media bucket. |
| `unlimitedStorage` | The media bucket stores full-resolution images as base64; without this the 10 MB `storage.local` quota would reject the third or fourth high-res photo. |
| `declarativeNetRequest` / `declarativeNetRequestWithHostAccess` | Native network blocking for the Ad Shield and image/video media block. |
| `scripting` | Injects the capture, snipping, and QR overlay scripts on demand. |
| `tabs` | Reads the active tab URL for counters, screenshots, and shortening. |
| `activeTab` | Interacts with the current page on user action. |
| `clipboardWrite` | Copies screenshots and shortened URLs. |
| `contextMenus` | Right-click image search, QR, and shortening entries. |
| `downloads` | Saves bucket items, ZIP archives, and media files. |
| `<all_urls>` host access | Content scripts (media filters, media grabber, text spoofing, locks) must run everywhere, and the service worker fetches cross-origin images on behalf of the bucket/downloader. |

### What leaves your browser
- Shortened URLs are sent to **is.gd**; QR codes are rendered by **api.qrserver.com**; reverse image searches send the image URL (or an uploaded crop) to the chosen engine. The popup/options pages load the *Alata* font from Google Fonts. Everything else — filters, adblock rules, media bucket, capture, ZIP packaging, locks — runs fully locally; the media grabber only fetches image bytes from the page's own CDN URLs.

## Project Structure

```
manifest.json                  MV3 manifest (permissions, DNR rulesets, commands)
background.js                  Service worker: state, DNR, badge, context menus,
                               shortcuts, shortener, visual search uploaders,
                               media bucket store, download handling
content.js                     Content script: visual filters, smart dark mode,
                               Web Audio engine, force right-click, text spoofing,
                               lock overlays, per-tab scoping
js/adblock/adblock-cosmetic.js Cosmetic filtering engine (specific + generic)
js/adblock/specific-rules.json Domain-keyed specific cosmetic selectors
js/adblock/generic-rules.json  Generic cosmetic selectors (high/low specificity)
media-dl.js                    Universal hover media grabber (all sites, all frames)
media-dl.css                   Overlay/toast styles for the hover toolbar
capture.js / capture.css       Full-page scrolling capture orchestrator
capture-viewer.html / .js      Stitched-canvas viewer (crop, zoom, PNG, PDF)
selector.js / selector.css     Area snipping tool for visual search
popup.html / popup.js          Toolbar popup: quick toggles, tools, bucket gallery
options.html / options.js      Settings page: all options, locks, history, logs
jszip.min.js                   JSZip 3.10.1 (MIT/GPLv3) for bucket ZIP packaging
rules/block_images.json        DNR ruleset: image requests
rules/block_videos.json        DNR ruleset: video requests
rules/adblock/*.json           DNR rulesets: uBlock, EasyList, EasyPrivacy, etc.
icons/                         Extension icons
convert_icons.py               Utility: converts .ico icons to .png (Pillow)
```

## Development Notes

- `convert_icons.py` regenerates the `.png` icons from the `.ico` files (`pip install Pillow` first).
- The extension stores its settings in `chrome.storage.local`. Setting the Ad Shield mode is the numeric key `adBlockMode` (0–3); a legacy boolean `adBlockEnabled` from older versions is migrated automatically on startup. A legacy `instaDlEnabled` / `instaDlCopyEnabled` boolean from versions ≤ 5.0 is inert — the Instagram-specific downloader was replaced by the universal Media DL (`mediaDlEnabled`).
- The capture viewer can also be reached directly after a capture; the payload survives service-worker restarts via `chrome.storage.session`.
- Downloads of large media avoid the ~2 MB data-URL cap of the downloads API: http(s) sources are passed as direct URLs to `chrome.downloads`, and oversized base64 payloads are converted to blob URLs in the page or popup context, where `URL.createObjectURL` is available (MV3 service workers cannot create blob URLs).
- `rules/adblock/annoyances-*.json` are additional uBlock "annoyances" lists bundled for future use; they are intentionally not registered as enabled rulesets.

## Known Limitations

- Full-page capture supports up to 100 viewport slices and downscale-fits Chrome's maximum canvas size; extremely long pages are therefore captured at reduced resolution.
- The hover grabber saves **video frames** (JPEG), not the underlying stream — DRM, MSE, and `blob:`-based players cannot be reassembled by design.
- Bucket items that were logged as remote URLs (rather than fetched payloads) only survive while that URL stays alive; the ZIP packager reports how many items were skipped for this reason.
- Domain Lock is a convenience/privacy overlay, not OS-level parental control — it guards normal browsing contexts only.
