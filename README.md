# LazySloth Cleaner 🦥✨

> **“Stay cozy. We'll sort the clutter together.”**

LazySloth Cleaner is a cozy, privacy-first companion application designed to help you declutter photos, promotional emails, and message clutter without anxiety, false promises, or privacy intrusions.

---

## 🌟 Highlights & Brand Preservation

- **Authentic Cute Mascot:** Preserves the beloved LazySloth character with his cozy pink hoodie, headphones, pointed wizard hat with star pin, and magical golden leaf broom.
- **Expressive Living Animations:**
  - Gentle idle floating on branch (`anim-float`)
  - Cozy sleeping state on the Home screen (`eyes-closed`, breathing, and floating Zs)
  - Joyful wake-up hops when entering active cleaning tabs (`anim-hop`)
  - Broom sweeping motion during scanning (`anim-sweep` and cleaning leaf particles)
  - Cheerful celebration upon completing a sweep
  - Interactive wake-up on click/tap
- **Accessibility & Battery Conservation:** Full support for `prefers-reduced-motion` and an in-app toggle that instantly halts intense animations for users who prefer stillness.
- **100% On-Device & Truthful:** Zero tracking, zero telemetry, and zero cloud uploads. The app clearly discloses browser sandbox boundaries and never fakes AI or account connections.

---

## 🛠️ Technology Stack

- **Frontend Core:** HTML5, Modern Vanilla JavaScript (modular architecture).
- **Styling:** Tailwind CSS, FontAwesome 6, Google Fonts (*Plus Jakarta Sans* & *Fredoka*).
- **Duplicate Engine:** Browser native **Web Crypto API** (`crypto.subtle.digest('SHA-256')`) for byte-for-byte exact duplicate identification.
- **Review Architecture:** Centralized reactive `ReviewStore` with stable item IDs and protective guardrails.
- **AI Service Boundary:** Clean decoupled `GemmaClassifierService` ready for future on-device Gemma models (WebGPU / LiteRT).
- **Deployment Target:** Render Static Site (`render.yaml`) and zero-dependency local Node server (`server.js`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended) or any modern web browser.

### Option A: Run via Node Local Server (Recommended)
```bash
# 1. Navigate to the project directory
cd "C:\Users\DELL\.gemini\antigravity\scratch\lazysloth-cleaner"

# 2. Start the local server
npm start
```
Open your browser at: **`http://localhost:3000`** (or open `http://localhost:3000/lazysloth_cleaner.html`).

### Option B: Standalone File (No Server Required)
Simply double-click `lazysloth_cleaner.html` or `index.html` in Windows Explorer or open it directly in Chrome, Edge, Safari, or Firefox:
```
file:///C:/Users/DELL/.gemini/antigravity/scratch/lazysloth-cleaner/lazysloth_cleaner.html
```

---

## 🧪 Running Automated Tests

LazySloth Cleaner includes both unit test suites and automated headless browser E2E tests (using native Chrome DevTools Protocol):

```bash
npm test
```

### Test Coverage:
1. **Duplicate Detection Engine:**
   - Byte-size formatting verification.
   - SHA-256 exact matching with identical byte streams.
   - Differentiating distinct byte streams.
   - Grouping duplicate items with their respective original.
   - Automatic "Keep Safe" tagging for study notes, receipts, documents, and whiteboard captures.
2. **Review Store:**
   - Unified state across Photos, Email, and SMS.
   - Invariant verification: protected items can never be selected for cleanup.
   - Memory management (safe revocation of object URLs upon removal).
   - Reactive subscriber notifications.
3. **Gemma AI Service Boundary:**
   - Honest "unconfigured" status reporting.
   - Explicit labeling of heuristic recommendations (`method: 'heuristic'`).
   - WebGPU and WebAssembly environment checking.
4. **Headless Browser E2E:**
   - Brand name and mascot SVG rendering.
   - Sleeping sloth on Home screen.
   - All tab navigation routes (Home, Photos, Inbox, Review, Settings).
   - Reduced motion toggle affecting DOM classes.
   - Real local photo batch processing with synthetic duplicate detection.
   - Confirmation modal guardrails and safe cancellation.
   - Zero console errors during all user interactions.
   - Responsive layout checks across 360px, 440px, and 1024px viewports.

---

## 🔍 How to Use the Working Photo Duplicate Flow

1. Open the app and navigate to the **Photos** tab.
2. Click **"Select Local Photos"** to pick image files from your computer, or click **"Load Test Batch"** to test immediately with built-in synthetic image blobs.
3. LazySloth's broom sweeps while computing local SHA-256 hashes:
   - Identical byte hashes are grouped together.
   - The first file is kept safe as the **Original**.
   - Subsequent identical files are tagged with **"Exact Match"** and pre-selected for cleanup.
   - Files matching notes/study/receipts/whiteboards are automatically tagged **"Keep Safe"** and unselected.
4. Click **"Proceed to Review Selected Items"** to view candidate items.
5. In the Review screen, inspect the items and click **"Sweep Away Selected Items"**.
6. The confirmation dialog will open, explaining the browser safety boundary (items will be removed from the review session without modifying your disk files). Confirm to sweep!

---

## 🔒 Privacy & Architecture Guardrails

| Feature | Current State | Truthful Disclosure |
|---|---|---|
| **Photos** | Local File Picker & SHA-256 Hashing | Only processes files you explicitly select. No whole-device gallery scan. No server uploads. |
| **Email** | Demo Mode | Not connected. Real integration requires OAuth 2.0 PKCE with read-only scopes (`gmail.readonly`). Zero password storage. |
| **SMS / Messages** | Demo Mode (Sandbox Notice) | Web browsers cannot access device SMS due to OS security sandboxing. Native mobile wrapper planned. |
| **Gemma AI** | Unconfigured Interface | Heuristic rules are explicitly labeled. No fake claims of active AI neural inference. |
| **File Deletion** | Safe Session Removal | Browser security prevents deleting device files. Items are removed from in-memory review. |

---

## 📄 License
MIT License. LazySloth character design & artwork copyright protected.
