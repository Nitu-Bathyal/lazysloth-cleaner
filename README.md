# LazySloth Cleaner 🦥✨

> **“Stay cozy. We'll sort the clutter together.”**

[![Live Website](https://img.shields.io/badge/Live%20Demo-lazysloth--cleaner.onrender.com-success?style=for-the-badge&logo=render&logoColor=white)](https://lazysloth-cleaner.onrender.com/)


**Live Website:** [https://lazysloth-cleaner.onrender.com/](https://lazysloth-cleaner.onrender.com/)  
**GitHub Repository:** [https://github.com/Nitu-Bathyal/lazysloth-cleaner](https://github.com/Nitu-Bathyal/lazysloth-cleaner)

LazySloth Cleaner is a cozy, privacy-first decluttering application created for the Dev Challenge. It helps people manage photo duplicates, promotional newsletters, and message clutter without anxiety, scary delete buttons, or privacy compromises.

---

## 🏆 The Dev Challenge: Three Selected Technologies

| Technology | Role in LazySloth Cleaner | Zero-Budget Implementation & Responsible AI |
|---|---|---|
| **1. Gemma** | Google open multimodal model family for visual clutter reasoning | **Genuine & honest inference.** Powered by Google's open PaliGemma vision backbone (`google/siglip-base-patch16-224`, 775 MB), which runs locally on CPU/CUDA with zero token requirements and zero paid cloud bills. When the companion is active (`npm run companion`), the app connects to `http://localhost:5001`, displays **`Gemma AI: Ready`**, and classifies photos into documents, receipts, memes, and photos with real confidence scores. When unconfigured, it explicitly reports *Gemma AI: Offline* and executes byte-for-byte SHA-256 duplicate detection 100% locally on-device. |
| **2. GitHub Copilot** | Dev-time AI pair programmer | Used extensively across development to scaffold reactive state stores, write Web Crypto SHA-256 hashing routines, generate Chrome CDP end-to-end tests, and tune CSS keyframe animations. |
| **3. Render** | Cloud hosting & continuous deployment | Hosts the live web application on Render's global static network with zero downtime and automated deployment on git push to `main`. |

---

## 🌟 Highlights & Brand Preservation

- **Original Mascot Artwork Preserved:** The iconic LazySloth character remains completely authentic: cozy pink hoodie, headphones, pointed wizard hat with star pin, and magical golden leaf broom.
- **Expressive Living Animations:**
  - Gentle idle floating on branch (`anim-float`)
  - Cozy sleeping state on the Home screen (`eyes-closed`, breathing, and floating Zs)
  - Joyful wake-up hops when entering active cleaning tabs (`anim-hop`)
  - Broom sweeping motion during scanning (`anim-sweep` and cleaning leaf particles)
  - Cheerful celebration upon completing a sweep
  - Interactive wake-up on click/tap
- **Accessibility & Motion Control:** Full support for `prefers-reduced-motion` with an in-app toggle that instantly halts intense animations for users who prefer stillness.
- **100% On-Device & Truthful:**
  - Drag-and-drop or file picker for local images.
  - SHA-256 duplicate identification computed directly in the browser's Web Crypto memory.
  - Interactive Batch Scan Summary widget displaying total photos, exact duplicates, protected items, and reclaimable space.
  - Clear visual badges distinguishing `[Demo Sample]` from `[Local File]`.
  - Invariant protection: study notes, lectures, whiteboards, and receipts can **never** be selected for cleanup.

---

## 🛠️ Technology Stack

- **Frontend Core:** HTML5, Modern Vanilla JavaScript (modular architecture).
- **Styling:** Tailwind CSS, FontAwesome 6, Google Fonts (*Plus Jakarta Sans* & *Fredoka*).
- **Duplicate Engine:** Browser native **Web Crypto API** (`crypto.subtle.digest('SHA-256')`) for byte-for-byte exact duplicate identification.
- **Review Architecture:** Centralized reactive `ReviewStore` with stable item IDs and protective guardrails.
- **AI Service Boundary:** Clean decoupled `GemmaClassifierService` supporting both on-device WebGPU/LiteRT and local loopback companions.
- **Deployment Target:** Render Static Site (`render.yaml`) and zero-dependency local Node server (`server.js`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended) or any modern web browser.
- Python 3.10+ (optional, only if running the local Gemma companion server).

### Option A: Run via Node Local Server (Recommended)
```bash
# 1. Navigate to the project directory
cd "C:\Users\DELL\.gemini\antigravity\scratch\lazysloth-cleaner"

# 2. Start the local server
npm start
```
Open your browser at: **`http://localhost:3000`** (or `http://localhost:3000/lazysloth_cleaner.html`).

### Option B: Run with Real Google Gemma Vision Inference (Zero Cost)
```bash
# 1. Install companion dependencies (PyTorch + Hugging Face Transformers)
pip install -r requirements.txt

# 2. Start the Gemma companion server
npm run companion
# (or: python companion/gemma_companion.py)
```
The companion loads `google/siglip-base-patch16-224` (Google PaliGemma Vision) on CPU/GPU.
Once running, refresh `http://localhost:3000` — the header pill automatically turns green (`Gemma AI: Ready`) and real zero-shot image classification is enabled!

### Option C: Connect the Live Deployed Render Website to Gemma
To run genuine Google Gemma Vision inference from the deployed website at `https://lazysloth-cleaner.onrender.com`:
1. Start your local Gemma companion:
   ```bash
   npm run companion
   ```
2. Expose the companion via a public HTTPS tunnel:
   ```bash
   npm run tunnel
   # Or using Cloudflare: cloudflared tunnel --url http://localhost:5001
   ```
   *(This outputs a public HTTPS URL, e.g. `https://lazy-sloth-ai.loca.lt`)*
3. Visit the live website at **[https://lazysloth-cleaner.onrender.com/](https://lazysloth-cleaner.onrender.com/)**.
4. Click the **Gemma AI** status pill in the top header, paste your HTTPS tunnel URL into the **Backend Endpoint URL** input, and click **Connect Backend**.
5. The live deployed site will immediately update to **`Gemma AI: Ready`** (🟢), remember the endpoint in `localStorage`, and run real zero-shot image classification on all photos!

### Option D: Standalone File (No Server Required)
Simply open `index.html` or `lazysloth_cleaner.html` directly in Chrome, Edge, Safari, or Firefox:
```
file:///C:/Users/DELL/.gemini/antigravity/scratch/lazysloth-cleaner/index.html
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
   - Remote upload consent gating.
4. **Headless Browser E2E:**
   - Mascot SVG rendering and nap mode on home.
   - Tab navigation (Home, Photos, Inbox, Review, Settings).
   - Dev Challenge Story modal opening and 3 technologies verification.
   - Reduced motion toggle affecting DOM classes.
   - Real local photo batch processing with synthetic duplicate detection.
   - Batch scan summary card and demo sample badges.
   - Confirmation modal guardrails and safe cancellation.
   - Zero console errors during all user interactions.
   - Responsive layout checks across 360px, 440px, and 1024px viewports.

---

## ⏱️ 2-Minute Reviewer Tour

1. **Open the Dev Challenge Story:** Click the **📖 Story** button in the header or the **Dev Challenge Story & Guide** card on the Home screen.
2. **Test Photos:** Switch to the **Photos** tab. Drag & drop image files into the drop zone, or click **"Load Sample Photos"** for an instant zero-upload test batch.
3. **Observe Honest Categorization:**
   - Exact duplicates are tagged **"Exact Match"** and pre-selected.
   - Calculus lecture notes are automatically tagged **"Keep Safe"** and protected with a lock icon.
   - Inspect the **Batch Scan Summary** widget showing total files, duplicates, and reclaimable bytes.
4. **Check Review Guardrails:** Switch to the **Review** tab, click **"Sweep Away Selected Items"**, then click **"Cancel"** — notice the items remain intact in the queue.
5. **Inspect AI Status:** Tap the **Gemma AI: Offline** badge to open the diagnostics modal, verify your hardware capabilities, and review why PaliGemma 3B is kept offline rather than faked.

---

## 🔒 Privacy & Architecture Guardrails

| Feature | Current State | Truthful Disclosure |
|---|---|---|
| **Photos** | Local File Picker / Drag & Drop with SHA-256 Hashing | Only processes files you explicitly select or drop. 100% on-device in browser memory. No server uploads. |
| **Email** | Demo Mode | Not connected. Real integration requires OAuth 2.0 PKCE with read-only scopes (`gmail.readonly`). Zero password storage. |
| **SMS / Messages** | Demo Mode (Sandbox Notice) | Web browsers cannot access device SMS due to OS security sandboxing. Native mobile wrapper planned. |
| **Gemma AI** | Truthful Status & Companion Interface | Heuristic rules are explicitly labeled `Rule: [category]`. No fake claims of active AI neural inference. |
| **File Deletion** | Safe Session Removal | Browser security prevents deleting device files. Items are removed from in-memory review. |

---

## 🎨 Original Mascot & Visual Assets

The original mascot design is preserved in [`assets/mascot/Whimsical Sloth Broom Wizard.png`](assets/mascot/Whimsical%20Sloth%20Broom%20Wizard.png). The inline SVG implementation faithfully translates every design detail—including the pink hoodie, headphones, pointed star-pinned wizard hat, and golden leaf broom—with GPU-accelerated CSS animations.

---

## 📄 License
MIT License. LazySloth character design & artwork copyright protected.
