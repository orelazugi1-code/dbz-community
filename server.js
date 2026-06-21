const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database ─────────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'community.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT DEFAULT '',
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    display_color TEXT DEFAULT '#ffd700',
    avatar TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    cover_image TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS post_views (
    post_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS likes (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );
`);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'dragonball-community-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype))
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'לא מחובר' });
  next();
}

// ── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, email, password, displayName } = req.body;
  if (!username || !password || !displayName) return res.status(400).json({ error: 'כל השדות נדרשים' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'שם משתמש חייב להיות 3-20 תווים' });
  if (password.length < 6) return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 6 תווים' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: 'שם משתמש או אימייל כבר קיימים' });

  const hash = bcrypt.hashSync(password, 12);
  const token = crypto.randomBytes(32).toString('hex');
  try { var result = db.prepare('INSERT INTO users (username, email, password, display_name, token) VALUES (?, ?, ?, ?, ?)').run(username, email || '', hash, displayName, token); } catch(e) { return res.status(400).json({ error: 'שם משתמש כבר קיים' }); }
  req.session.userId = result.lastInsertRowid;
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  req.session.userId = user.id;
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT id, username, display_name, display_color, avatar, bio, token, created_at FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user });
});

// ── User Settings ────────────────────────────────────────────────────────────
app.put('/api/settings', requireAuth, (req, res) => {
  const { displayName, displayColor, bio } = req.body;
  db.prepare('UPDATE users SET display_name = ?, display_color = ?, bio = ? WHERE id = ?').run(displayName || '', displayColor || '#ffd700', bio || '', req.session.userId);
  res.json({ success: true });
});

app.post('/api/settings/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run('/uploads/' + req.file.filename, req.session.userId);
  res.json({ avatar: '/uploads/' + req.file.filename });
});

app.post('/api/settings/regenerate-token', requireAuth, (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, req.session.userId);
  res.json({ token });
});

// ── Posts ─────────────────────────────────────────────────────────────────────
app.post('/api/posts', requireAuth, (req, res) => {
  const { title, content, coverImage } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'כותרת ותוכן נדרשים' });
  const result = db.prepare('INSERT INTO posts (user_id, title, content, cover_image) VALUES (?, ?, ?, ?)').run(req.session.userId, title, content, coverImage || '');
  res.json({ id: Number(result.lastInsertRowid) });
});

app.get('/api/posts', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const sort = req.query.sort || 'newest';
  const limit = 12;
  const offset = (page - 1) * limit;
  const posts = db.prepare(`
    SELECT p.*, u.display_name, u.display_color, u.avatar,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p JOIN users u ON p.user_id = u.id
    ORDER BY
    CASE WHEN ? = 'oldest' THEN p.created_at END ASC,
    CASE WHEN ? = 'popular' THEN (SELECT COUNT(*) FROM likes WHERE post_id = p.id) + (SELECT COUNT(*) FROM comments WHERE post_id = p.id) + p.views END DESC,
    CASE WHEN ? NOT IN ('oldest','popular') THEN p.created_at END DESC
    LIMIT ? OFFSET ?
  `).all(sort, sort, sort, limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
  res.json({ posts, total, pages: Math.ceil(total / limit) });
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.display_name, u.display_color, u.avatar, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count
    FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
  `).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'פוסט לא נמצא' });
  const viewKey = req.session.userId || req.ip;
  const viewed = db.prepare('SELECT 1 FROM post_views WHERE post_id = ? AND user_id = ?').get(req.params.id, String(viewKey));
  if (!viewed) {
    db.prepare('INSERT OR IGNORE INTO post_views (post_id, user_id) VALUES (?, ?)').run(req.params.id, String(viewKey));
    db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(req.params.id);
  }
  const comments = db.prepare(`
    SELECT c.*, u.display_name, u.display_color, u.avatar
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json({ post, comments });
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!post) return res.status(403).json({ error: 'אין הרשאה' });
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Likes ────────────────────────────────────────────────────────────────────
app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  } else {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(req.params.id, req.session.userId);
  }
  const count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE post_id = ?').get(req.params.id).c;
  res.json({ liked: !existing, count });
});

// ── Comments ─────────────────────────────────────────────────────────────────
app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'תוכן נדרש' });
  db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)').run(req.params.id, req.session.userId, content);
  res.json({ success: true });
});

// ── Image Upload ─────────────────────────────────────────────────────────────
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ── AI Translate for image prompts ─────────────────────────────────────────
app.post('/api/translate-prompt', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'no text' });
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (process.env.GROQ_API_KEY || '') + '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 100,
        messages: [
          { role: 'system', content: 'You are a world-class anime story writer. Write ONLY in Hebrew. RULES: 1) Write 5-8 chapters each COMPLETELY different 2) NEVER repeat sentences 3) Use vivid metaphors 4) Describe battles with visual details and sound effects 5) Show emotions through actions 6) Build tension each chapter more intense 7) End with epic climax 8) Use Dragon Ball terms correctly. FORMAT: HTML h2 for chapter titles with emojis, strong for names and attacks, em for thoughts, blockquote for declarations, hr between chapters. Write like the BEST anime ever.' },
          { role: 'user', content: text }
        ]
      })
    });
    const data = await resp.json();
    const prompt = data.choices?.[0]?.message?.content?.trim() || text;
    res.json({ prompt });
  } catch (e) {
    res.json({ prompt: text });
  }
});

// ── Admin auto-login ──────────────────────────────────────────────────────
app.get('/api/admin-login/:userId', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'not found' });
  req.session.userId = user.id;
  res.json({ success: true });
});

// ── AI Story Generator ─────────────────────────────────────────────────────
app.post('/api/generate-story', async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'need description' });
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (process.env.GROQ_API_KEY || '') + '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0.85,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: 'You are the greatest anime story writer. Write ONLY in HEBREW. Rules: 1) Write 5-8 chapters each UNIQUE and different 2) NEVER repeat phrases or sentences 3) Describe battles with specific attacks movements and emotions 4) Build tension each chapter more intense 5) End with unforgettable climax 6) Use Dragon Ball terms correctly. Format HTML: h2 for chapter titles with emojis, strong for names attacks transformations, em for thoughts, blockquote for epic quotes, hr between chapters. After each h2 chapter title add exactly this tag: <img src="CHAPTER_IMAGE" style="width:100%;border-radius:12px;margin:10px 0">. Make it EPIC.' },
          { role: 'user', content: description }
        ]
      })
    });
    const data = await resp.json();
    const story = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
    res.json({ story });
  } catch (e) {
    console.error('[story-gen]', e.message);
    res.status(500).json({ error: 'error' });
  }
});

// ── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('/{*splat}', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🐉 Dragon Ball Community → http://localhost:${PORT}`));
