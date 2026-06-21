# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dragon Ball fan community website where users create and share anime-style story posts with a visual editor. Hebrew-first UI with RTL support.

## Tech Stack

- **Frontend:** HTML, CSS, vanilla JavaScript (no framework)
- **Backend:** Node.js with Express
- **Database:** SQLite via `node:sqlite` (DatabaseSync, requires `--experimental-sqlite`)
- **Auth:** Session-based with bcrypt password hashing
- **AI Images:** Pollinations AI (free, no API key)
- **Hosting:** Vercel
- **Vercel Token:** Deploy with `npx vercel deploy --prod --yes --token=TOKEN --scope=ultra-man-22`

## Commands

```bash
# Run dev server
node --experimental-sqlite server.js

# Deploy to production
npx vercel deploy --prod --yes --scope=ultra-man-22
```

## Architecture

```
server.js          — Express server, API routes, auth middleware
public/
  index.html       — Landing / post feed
  login.html       — Login/register page
  editor.html      — Visual story editor
  post.html        — Full post view
  settings.html    — User settings
  css/style.css    — Global styles (dark theme, neon, RTL)
  js/
    app.js         — Post feed, navigation
    editor.js      — Visual editor logic (text, images, styles)
    auth.js        — Login/register forms
    api.js         — API client helpers
data/
  community.db     — SQLite database
```

## Key Design Decisions

- All UI in Hebrew, RTL layout
- Dark theme with gold/purple neon aesthetic (matching the Giuro saga style)
- Visual editor must be code-free for users — drag, click, type only
- AI image generation via Pollinations (`https://image.pollinations.ai/prompt/...`)
- Security: bcrypt passwords, HTTP-only session cookies, CSRF protection, input sanitization, parameterized SQL queries
