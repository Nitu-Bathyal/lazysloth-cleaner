# Deployment Guide: LazySloth Cleaner on Render

This guide outlines the deployment steps for hosting LazySloth Cleaner on **Render** as a high-performance, privacy-first **Static Site**.

---

## 🏗️ Architecture Overview

LazySloth Cleaner is a client-side web application designed to run entirely in the user's browser:
- **No backend server is required** for production hosting.
- Zero private image data is ever uploaded to a server.
- The site can be hosted on any global CDN or static hosting platform.

---

## 🚀 Deploying to Render

### Option 1: Automatic Blueprint Deployment (`render.yaml`)

LazySloth Cleaner includes a pre-configured `render.yaml` file in the root directory:

```yaml
services:
  - type: web
    name: lazysloth-cleaner
    runtime: static
    buildCommand: ""
    staticPublishPath: .
    headers:
      - path: /*
        name: Content-Security-Policy
        value: "default-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com blob: data:; img-src 'self' data: blob: https://placehold.co https://images.unsplash.com;"
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
      - path: /*
        name: X-Frame-Options
        value: SAMEORIGIN
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

#### Steps:
1. Push the repository to GitHub or GitLab.
2. Log in to your **Render Dashboard** (`https://dashboard.render.com/`).
3. Click **New +** and select **Blueprint**.
4. Connect your repository. Render will automatically detect `render.yaml` and configure the static site.
5. Click **Apply**.

---

### Option 2: Manual Static Site Creation

1. In Render Dashboard, click **New +** and choose **Static Site**.
2. Connect your repository.
3. Configure settings:
   - **Name:** `lazysloth-cleaner`
   - **Branch:** `main` (or default branch)
   - **Build Command:** *(Leave empty)*
   - **Publish Directory:** `.` (root directory)
4. Click **Create Static Site**.

---

## 🔑 Environment Variables & Secrets Policy

> [!IMPORTANT]
> **Zero Secrets in Frontend Code:**
> LazySloth Cleaner operates on a zero-trust, local-first model. Do **not** add any private API keys, client secrets, or credentials into the frontend repository or Render environment variables.

When future external integrations are configured:
- **Gmail OAuth 2.0:** Use OAuth 2.0 with PKCE (Proof Key for Code Exchange) or a backend proxy. Never embed client secrets in frontend files.
- **Gemma Model Backend:** If deploying a dedicated Gemma inference server, host it as a separate Render Web Service or Private Service with appropriate rate limiting and authentication.

---

## 🌐 Security Headers Configured

The following headers are specified in `render.yaml`:
- **Content-Security-Policy:** Enforces safe script origins (CDN Tailwind, FontAwesome, Google Fonts) while permitting local `blob:` URLs for image previews.
- **X-Content-Type-Options:** `nosniff` prevents MIME type sniffing.
- **X-Frame-Options:** `SAMEORIGIN` prevents clickjacking attacks.

---

## 🧪 Post-Deployment Verification

After deployment succeeds on your Render URL (e.g. `https://lazysloth-cleaner.onrender.com`):
1. Load the homepage and confirm the cute sloth mascot is sleeping peacefully.
2. Tap the sloth to verify wake-up interaction.
3. Navigate to **Photos** and click **"Load Test Batch"** to verify that Web Crypto SHA-256 duplicate detection works in the HTTPS context.
4. Verify that the **Review** tab shows the selected items and that the confirmation modal functions without errors.
