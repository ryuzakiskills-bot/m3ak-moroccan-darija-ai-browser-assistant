# M3ak (معاك) — Moroccan Darija AI Browser Assistant (Chrome Extension MV3)

**M3ak (معاك)** is a production-ready Chrome Extension (Manifest V3) and interactive AI Browser Assistant that understands the current webpage, identifies interactive DOM elements, visually highlights the exact target on the page, verifies user progress, and guides the user **one single step at a time** in natural **Moroccan Darija**.

---

## 1. Complete Project Structure

```text
├── manifest.json                         # Chrome Extension Manifest V3
├── public/
│   ├── manifest.json                     # Copied into dist/ on build
│   ├── assistant-avatar.png              # Dedicated consistent AI avatar asset
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── server.ts                             # Express + @google/genai backend proxy
├── src/
│   ├── background/
│   │   └── service-worker.ts             # Manifest V3 background service worker
│   ├── content/
│   │   ├── content-script.ts             # Content script message router
│   │   ├── dom-analyzer.ts               # Compact structured DOM extractor (element_1..N)
│   │   ├── element-highlighter.ts        # Target element resolver & action badge generator
│   │   └── page-observer.ts              # Debounced MutationObserver & user action detector
│   ├── sidepanel/
│   │   ├── components/
│   │   │   ├── AssistantAvatar.tsx       # Consistent AI avatar with subtle states
│   │   │   ├── VisualHighlightOverlay.tsx# Glowing border, pulse, pointer & Darija tooltip
│   │   │   ├── SidePanelView.tsx         # Main Chrome Side Panel UI
│   │   │   ├── WebpageSandbox.tsx        # Multi-site live interactive testing sandbox
│   │   │   ├── SettingsModal.tsx         # Privacy, Voice & AI settings
│   │   │   └── ExtensionArchitectureModal.tsx # Live DOM JSON & MV3 inspector
│   │   ├── hooks/
│   │   │   └── useBrowserAgent.ts        # Step-by-step agent loop & Task State Machine
│   │   └── pages/
│   │       └── OnboardingModal.tsx       # 5-step Moroccan Darija onboarding flow
│   ├── popup/
│   │   └── components/
│   │       └── ExtensionPopup.tsx        # Fast, minimal Chrome Extension Popup
│   ├── ai/
│   │   ├── ai-service.ts                 # Clean AI abstraction + local DOM fallback
│   │   ├── prompts.ts                    # Modular Darija system & step prompts
│   │   └── schemas.ts                    # Strict JSON schema validators
│   ├── voice/
│   │   ├── speech-to-text.ts             # Web Speech API STT (Listening/Processing/Idle)
│   │   └── text-to-speech.ts             # Darija/Arabic TTS synthesis (Speaking/Idle)
│   └── shared/
│       ├── types.ts                      # Strict TypeScript interfaces
│       ├── constants.ts                  # Darija quick prompts & sensitive keywords
│       └── utils.ts                      # Debounce, sensitivity checks, helpers
└── README.md
```

---

## 2. Environment Variables Required

Create a `.env` file (or configure via AI Studio Secrets) based on `.env.example`:

```bash
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
```

> **Security Note:** The `GEMINI_API_KEY` is strictly accessed server-side in `server.ts` via `process.env.GEMINI_API_KEY` and is never exposed in client-side bundles.

---

## 3. How to Run Locally & Build Production Version

### Run Development Server (Full-Stack Workbench + API Server on Port 3000)

```bash
npm install
npm run dev
```

### Build Production Bundle

```bash
npm run build
```

---

## 4. How to Load the Extension in Google Chrome

1. Run `npm run build` to generate the `dist/` directory containing `manifest.json`, `assistant-avatar.png`, `icons/`, and compiled assets.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dist/` folder.
5. Click the **M3ak (معاك)** icon in your Chrome toolbar to open the Popup or Side Panel.

---

## 5. How to Replace `/public/assistant-avatar.png`

Replace `/public/assistant-avatar.png` with any square (`1:1`) PNG or JPG image. Because `AssistantAvatar.tsx` references `/assistant-avatar.png` across the Popup, Side Panel, Chat messages, Voice bar, Highlight Tooltip, and Onboarding, your custom avatar will automatically appear everywhere.
