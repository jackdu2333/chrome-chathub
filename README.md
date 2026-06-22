# Chrome ChatHub

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](package.json)
[![Chrome](https://img.shields.io/badge/chrome-MV3-green.svg)](src/manifest.json)

> Multi-AI comparison workspace where **you** choose the models, the targets, and observe the results. The tool doesn't make decisions for you.

Chrome extension: chat with multiple AI services simultaneously in a single interface. Unified input broadcasts to all windows, with file upload, drag-and-drop sorting, and macOS-style UI.

## Features

- **Multi-window AI aggregation** — responsive grid layout, iframe-embedded third-party AI sites
- **Send target system** — all windows / current window / custom selection, always know who received your message
- **Draft protection** — drafts preserved on partial failure, cleared only when all succeed
- **Result feedback** — toast notifications for success / partial failure / all failed
- **Model search & grouping** — search by name/domain/tags, group by general / chinese / coding / search
- **Model combos** — save favorite comparison combos, one-click replace or append
- **Model drawer** — macOS-style drawer, pinned button, stability level badges
- **Layout system** — grid / primary-scroll / focus / vertical
- **Diagnostics panel** — per-window status, capability detection, error code translations, selector config
- **Custom adapters** — add / edit / delete AI services with selector testing
- **Keyboard shortcuts** — Enter to send / Cmd+Ctrl+Enter for all / Cmd+Ctrl+Shift+Enter for current

## Supported Services

ChatGPT / Gemini / Doubao (豆包) / Qianwen (千问) / YiYan (文心一言) / Kimi / DeepSeek / ChatGLM / Copilot / Claude / Tabbit

*Add more via Settings → Custom Adapter.*

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| State | Zustand (chrome.storage.local persistence, 4 slices) |
| Styling | Tailwind CSS (macOS-style glassmorphism) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Icons | Lucide React |
| Build | Vite + CRXJS |
| Testing | Vitest |
| Extension | Chrome Extension Manifest V3 |

## Download

**Option 1: GitHub Release (recommended)**

Download the latest `chrome-chathub-vX.X.X.zip` from [Releases](https://github.com/jackdu2333/chrome-chathub/releases), unzip, then load as unpacked extension.

**Option 2: Build from source**

See [Getting Started](#getting-started) below.

### Load into Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the unzipped `dist` folder

## Getting Started

### Prerequisites

```bash
node -v   # Node.js 18+
npm -v
```

### Installation

```bash
git clone https://github.com/jackdu2333/chrome-chathub.git
cd chrome-chathub
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

Output: `dist/` folder.

### Test

```bash
npm test              # vitest run
npm run check         # lint + test + build
```

## Architecture

```
Browser Layer (App.tsx + Zustand Store)
  ↓
Window Layer (ChatFrame iframe)
  ↓ postMessage
Injection Layer (Content Script + Drivers)
  ↓ DOM Control
AI Service Websites
```

**Store Architecture (4 slices):**
- `botSlice` — activeBots, adapter CRUD, preferences
- `uiSlice` — layout mode, send target mode, focus state
- `settingsSlice` — sync toggle, drafts, theme, input mode, send results
- `modelGroupSlice` — model combo CRUD + persistence

**Driver Architecture:** Per-site drivers (openai/doubao/chatglm/qianwen/gemini/generic), config + driver two-layer pattern.

## Design System

- **Font**: System Stack (`-apple-system`, `BlinkMacSystemFont`)
- **Theme**: Dynamic Light/Dark mode + manual toggle + high-contrast light mode
- **UI Style**: Morandi / Bold (high-contrast Morandi)

## Project Structure

```
src/
├── background/         # Service worker (DNR rules, content script registration)
├── components/         # React components (ChatFrame, Sidebar, Settings, etc.)
├── content/            # Content scripts + DOM drivers
│   ├── dom/            # DOM manipulation utilities
│   └── drivers/        # Per-site AI platform drivers
├── hooks/              # Custom React hooks
├── lib/                # Utilities (broadcast, resolveTargets)
├── runtime/            # Frame bridge, protocol, session store
├── store/              # Zustand store (4 slices)
└── types.ts            # Shared TypeScript types
```

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `npm run check` to ensure lint + test + build pass
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Adding a New AI Platform

1. Add the adapter config to `DEFAULT_ADAPTERS` in `src/types.ts`
2. Create a driver in `src/content/drivers/` if needed
3. Add the domain to `host_permissions` in `src/manifest.json`
4. Add to `content_scripts.matches` in `src/manifest.json`
5. Test with `npm run check`

## License

[Apache License 2.0](LICENSE) — Copyright 2026 jackdu2333

## Acknowledgments

- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin) for seamless Chrome extension development with Vite
- [Lucide](https://lucide.dev/) for beautiful icons
- All the AI platforms that make this possible
