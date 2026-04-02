# 🎌 AniExplore

Anime discovery terminal powered by [Jikan API](https://jikan.moe/) and [xAI Grok-2](https://x.ai/). Built with Vite + React + Tailwind. Deployed as a single project on Vercel using serverless functions.

## Project Structure

```
aniexplore/
├── api/                   ← Vercel Serverless Functions (your backend)
│   ├── anime.js           ← GET  /api/anime      — Jikan search proxy
│   ├── top-anime.js       ← GET  /api/top-anime  — Jikan top anime proxy
│   └── grok.js            ← POST /api/grok       — xAI Grok-2 proxy (key stays here)
├── src/
│   ├── App.jsx            ← Main React app
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
├── .env.example           ← Safe to commit (no real key)
├── .gitignore
└── README.md
```

---

## 🚀 Deploy to Vercel (Step by Step)

### 1. Push to GitHub

```bash
# In the project root
git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com (don't add README or .gitignore there)
git remote add origin https://github.com/YOUR_USERNAME/aniexplore.git
git branch -M main
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Click **Import** next to your `aniexplore` GitHub repo
3. Vercel will auto-detect Vite — leave all build settings as-is
4. Before clicking **Deploy**, go to **Environment Variables** and add:

| Name | Value |
|------|-------|
| `GROK_API_KEY` | `xai-your-key-here` |

5. Click **Deploy** ✅

Your app will be live at `https://aniexplore.vercel.app` (or similar).

---

## 💻 Run Locally

Install [Vercel CLI](https://vercel.com/docs/cli) to simulate the serverless functions locally:

```bash
npm install -g vercel

# In project root — create local .env
cp .env.example .env
# Edit .env and add your real GROK_API_KEY

# Start local dev (runs both Vite + serverless functions)
vercel dev
```

Open **http://localhost:3000**

> Without Vercel CLI, `npm run dev` runs the frontend only — the `/api` routes won't work locally.

---

## ⚠️ Security Reminder

- `.env` is in `.gitignore` — your key will **never** be committed
- The Grok API key is only read server-side inside `/api/grok.js`
- The frontend never has access to the key
