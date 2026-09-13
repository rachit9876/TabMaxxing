# TabMaxxing ⚡

**TabMaxxing** is the ultimate PowerTools & privacy utility suite for Chromium browsers. Max out your daily browsing stats with visual privacy (blur, block, pixelate, invert), audio leveling (stable volume compressor, mono downmix), 1-click live clipboard copying, Instagram high-res downloads (`insta-dl`), shoulder-surfing text spoofing, area snipping visual search, master password locks, and daily tab productivity tools.

[Download the latest ZIP](https://github.com/rachit9876/TabMaxxing/archive/refs/heads/main.zip)

## What's New

- **Instagram Pro (Downloader & 1-Click Live Copier `insta-dl`):** Download highest-resolution photos, videos, stories, and reels on Instagram. Features an instant **1-Click Live Copy** button to copy full-resolution PNG images directly to your system clipboard for instant pasting (<kbd>Ctrl</kbd>+<kbd>V</kbd>) into Discord, WhatsApp Web, Slack, etc. without downloading any files!
- **Accurate Story Media Handling:** Automatically distinguishes between still photo stories (`.jpg`) and video stories (`.mp4`), fixing the common bug in other downloaders where static photo stories were forced into video format.
- **Visual Image Search & Snipping Tool:** Right-click to search images via Google Lens, Yandex, or TinEye. Use the "Search Area" tool in the popup to snip and search any part of your screen!
- **Tab Scoped Settings:** Click "ALL TABS / THIS TAB" in the popup to apply filters and privacy modes to only the currently active tab without affecting the rest of your browser.
- **QR Code Generator:** Right-click to generate a QR code for the current page, link, or media. A custom QR generator is also available in the popup.
- **Text Spoofing:** Converts visible page text into deterministic, seed-based typoglycemic text to prevent shoulder-surfing.
- **Domain Lock & Browser Lock:** Require your universal password before opening selected websites or lock the entire browser.
- **URL Shortener:** Shorten current pages, links, images, video, and audio URLs, with recent history and QR preview.
- **Smart Dark Mode:** Applies a dark-style inversion only when the current site appears light.
- **Advanced Audio Tools:** Stable Volume compression, Mono Audio, dialogue boost, and heavy bass cut profiles.

## ⚡ Feature Matrix (TabMaxxing Suite)

### 📸 1. Instagram & Media Maxxing (`insta-dl`)
| Feature | Icon | What It Does | Why It's Great |
| :--- | :---: | :--- | :--- |
| **1-Click Live Copier** | 📋 | Copies raw PNG images directly to your system clipboard | Paste (<kbd>Ctrl</kbd>+<kbd>V</kbd>) into Discord, WhatsApp Web, Slack, etc. without saving junk files. |
| **Video Frame Snapshot** | 🖼️ | Captures the active playing frame of Reels & Videos as an image | Instant meme grabbing and high-definition frame copying. |
| **Smart Story Downloader** | 📥 | Downloads stories as true `.jpg` photos or `.mp4` videos | Fixes the common bug where static photo stories were forced into `.mp4`. |
| **Carousel & Reel Grabber** | 🎠 | Downloads single carousel slides, all slides, or full Reels | Highest available resolution directly from Instagram CDN. |

### 🛡️ 2. Visual Privacy Maxxing
| Feature | Icon | What It Does | Use Case |
| :--- | :---: | :--- | :--- |
| **Smart Blur & Pixelate** | 💧 | Applies Gaussian blur or retro mosaic filters to media | Browse in cafes, offices, or classrooms without screen snooping. |
| **Total Media Block** | 🛑 | Zero-bandwidth network block using `declarativeNetRequest` | Extreme privacy and high-speed data saving. |
| **Invert & Grayscale** | ☯️ | Inverts colors or converts all targeted media to black & white | Low-distraction reading and reduced eye strain. |
| **Hover Reveal** | 👁️ | Temporarily un-blurs media only when your mouse hovers over it | Peek at images on demand without unmasking the whole page. |
| **Target Selectors** | 🎯 | Filter only Images, only Videos, or both | Granular control over media rendering. |

### 🔊 3. Audio Maxxing
| Feature | Icon | What It Does | Use Case |
| :--- | :---: | :--- | :--- |
| **Stable Volume Engine** | 🔊 | Dynamic Web Audio compression & LUFS loudness leveling | Normalizes audio spikes (whispering dialogue vs deafening explosions). |
| **Mono Audio Downmix** | 🎧 | Combines stereo channels into balanced unified mono | Listening with a single earbud or sharing headphones. |
| **Smooth Volume Fade** | 📈 | Softly ramps up volume when media starts playing | Eliminates sudden loud ear-blasting autoplay audio. |
| **Custom EQ Profiles** | 🎛️ | Flat, Dialogue Boost, Night Mode (Bass Cut), Cinema, Music | Crystal-clear voices in podcasts, lectures, and movies. |

### 🔒 4. Security & Text Privacy Maxxing
| Feature | Icon | What It Does | Use Case |
| :--- | :---: | :--- | :--- |
| **Ad & Tracker Shield** | 🛡️ | Zero-overhead native Chromium DeclarativeNetRequest ad blocker | Drops ads, popups, and tracking beacons with 0ms latency and 0 telemetry. |
| **Text Spoofing (Typoglycemia)** | 🔤 | Scrambles inner letters of words using a deterministic seed | Protects confidential documents & chats from shoulder surfers while you can still read it. |
| **Browser Master Lock** | 🔒 | Locks the browser popup behind a universal SHA-256 password | Prevents unauthorized tampering when stepping away from your laptop. |
| **Domain Lock** | 🚫 | Requires password authentication before accessing selected domains | Block distracting or private sites (e.g. `reddit.com`, `youtube.com`). |
| **Per-Tab Scoping** | 🗂️ | Switch between "ALL TABS" and "THIS TAB" | Apply extreme privacy or filters to one tab without affecting others. |

### 🛠️ 5. Day-to-Day Utilities
| Feature | Icon | What It Does | Use Case |
| :--- | :---: | :--- | :--- |
| **Full Page Screenshot & PDF** | 📸 | Auto-scrolls and stitches entire webpages into high-res PNG or PDF | Capture long articles, receipts, and full design mockups with 1 click. |
| **Area Snipping Search** | 🔍 | Snip any screen region for multi-engine reverse image search | Search directly with Google Lens, Yandex, or TinEye. |
| **Force Right-Click & Copy** | 🔓 | Overrides restrictive website scripts that disable right-clicking | Enables text selection, context menus, and copy/paste anywhere. |
| **QR Code Generator** | 📱 | Generates instant QR codes for any link, image, or custom text | Quick link transfer directly from your desktop to your phone. |
| **Universal URL Shortener** | 🔗 | 1-click URL shortening with recent history tracking | Clean, short shareable links without opening external tools. |
| **Smart Dark Mode** | 🌙 | Intelligent dark theme inversion for glaring white sites | Comfortable night-time reading with media color preservation. |

## Installation

1. Download the ZIP from this repository.
2. Extract it to a folder.
3. Open Chrome and go to `chrome://extensions/`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted extension folder.
7. Pin **TabMaxxing** to your toolbar for quick access.

## Permissions Used

- `storage`: Save extension settings, password hash, domain locks, and URL history.
- `downloads`: Save high-resolution Instagram photos, videos, and reels.
- `declarativeNetRequest`: Block image and video requests efficiently.
- `declarativeNetRequestWithHostAccess`: Apply network rules across allowed sites.
- `scripting`: Run small page scripts for counters, snipping tools, clipboard writes, and alerts.
- `tabs`: Read the active tab URL for counters, screenshots, and URL shortening.
- `activeTab`: Interact with the currently active page.
- `clipboardWrite`: Direct copy of images, frames, and shortened URLs to the clipboard.
- `contextMenus`: Add right-click URL shortening, QR generation, and image search actions.
- `<all_urls>` host access: Apply media filtering, text spoofing, locks, and page protections across websites.

## Project Files

- `manifest.json`: Chrome extension manifest.
- `background.js`: State management, DNR rules, shortcut handling, context menus, URL shortening, visual search uploaders, password checks, download handlers.
- `content.js`: Page-side media filters, smart dark mode, lock overlays, Web Audio API processing, force right-click, Text Spoofing observer.
- `insta-dl.js`: Instagram media resolver, story handler, 1-click clipboard copier, and post/reel/story UI injector.
- `insta-dl.css`: Styling for Instagram action bars, buttons, dropdowns, and toast notifications.
- `capture.js` / `capture.css`: Full-page scrolling screenshot orchestrator and sticky header suppressor.
- `capture-viewer.html` / `capture-viewer.js`: High-resolution stitched canvas viewer, PNG/JPEG download, PDF exporter, and 1-click clipboard copier.
- `selector.js`: Screen area selection and snipping tool UI for Visual Search.
- `popup.html` / `popup.js`: Quick controls, URL shortener, QR generator, snipping tool trigger, Instagram Pro toggle, and tab scoping logic.
- `options.html` / `options.js`: Advanced settings, Instagram configuration, domain locks, history, and live previews.
- `rules/`: Declarative network request rules for media blocking.

## Version

Current manifest version: `5.0.0`.
