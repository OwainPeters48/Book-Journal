# Reading Journal — Setup Guide

## What you need (all free)
- [GitHub account](https://github.com) — to host the code
- [Netlify account](https://netlify.com) — to deploy the site
- [Anthropic API key](https://console.anthropic.com) — for AI features
- [Google Books API key](https://console.cloud.google.com) — for fast book search with covers (optional but recommended)

---

## Step 1 — Get your API keys

### Anthropic API key (required for AI features)
1. Go to https://console.anthropic.com
2. Click **API Keys** in the sidebar
3. Click **Create Key**, give it a name, copy it
4. Save it somewhere — you'll need it in Step 3

### Google Books API key (recommended — faster search, better covers)
1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → Library**
4. Search "Books API", click it, click **Enable**
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → API Key**
7. Copy the key — you'll need it in Step 3

> Without the Google Books key the app still works — it just uses the unauthenticated quota which is lower.

---

## Step 2 — Put the code on GitHub

1. Go to https://github.com/new
2. Repository name: `reading-journal`
3. Set to **Private** (recommended — your API keys will be in Netlify, not here, but still)
4. Click **Create repository**
5. On your computer, open Terminal (Mac) or Command Prompt (Windows)
6. Run these commands:

```bash
cd path/to/reading-journal    # navigate to the folder you downloaded
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reading-journal.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3 — Deploy to Netlify

1. Go to https://netlify.com and log in (or sign up)
2. Click **Add new site → Import an existing project**
3. Click **GitHub**, authorise Netlify, select your `reading-journal` repo
4. Build settings will auto-fill from `netlify.toml` — leave them as is
5. Click **Deploy site**

### Add your environment variables (API keys)
1. Once deployed, go to **Site configuration → Environment variables**
2. Click **Add a variable** for each of these:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic key from Step 1 |
| `VITE_GOOGLE_BOOKS_KEY` | Your Google Books key from Step 1 |

3. Click **Deploy site** again (or trigger a redeploy) for the variables to take effect

---

## Step 4 — Open your site

Netlify gives you a URL like `https://your-site-name.netlify.app`

That's it. Your reading journal is live, with:
- ✅ Instant book search with real cover images
- ✅ Full AI features (primer, discussion, suggestions)
- ✅ Data saved in your browser (localStorage)
- ✅ Works on mobile

---

## Local development (optional)

If you want to run it on your computer before deploying:

```bash
npm install
npm run dev
```

Then open http://localhost:5173

For the Netlify function to work locally, install the Netlify CLI:
```bash
npm install -g netlify-cli
netlify dev
```

This runs both the React app and the serverless function together at http://localhost:8888

---

## Notes

- **Your data** is stored in your browser's localStorage. It won't sync between devices unless you add a database (Supabase is a good free option — ask Claude to add it).
- **AI costs** — the Anthropic API charges per token. Typical usage (a few primers, some discussion) costs pennies per month.
- **Google Books quota** — the free tier allows 1,000 searches/day without a key, 1,000/day with a free key. More than enough for personal use.
