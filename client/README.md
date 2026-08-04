# RelayX Frontend Dashboard

This is the Next.js frontend application for **RelayX** — an interactive distributed job queue inspector and telemetry console.

---

## ⚡ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios (configured with environment base URL)

---

## ⚙️ Configuration & Ports

| Service | Port | Environment Variable |
|---|---|---|
| **Frontend App** | `3000` | `http://localhost:3000` |
| **Backend Express API** | `5000` | `NEXT_PUBLIC_API_URL=http://localhost:5000` |

---

## 🚀 Development Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Verify `NEXT_PUBLIC_API_URL` points to your backend server:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.
