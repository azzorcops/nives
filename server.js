'use strict';

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ---------- Configurazione ----------
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || 'cambiami';
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(16).toString('hex');
const COUPLE_NAME = process.env.COUPLE_NAME || 'Noi due';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 15);

// ---------- Percorsi ----------
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Storage su file JSON ----------
const DEFAULT_DB = {
  settings: { anniversary: '', reunion: '', name1: '', name2: '' },
  events: [], photos: [], notes: [], wishes: [], reasons: [],
  countdowns: [], ideas: [], places: [], capsules: [],
};

function loadDb() {
  let db;
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { db = {}; }
  return {
    settings: Object.assign({}, DEFAULT_DB.settings, db.settings || {}),
    events: db.events || [],
    photos: db.photos || [],
    notes: db.notes || [],
    wishes: db.wishes || [],
    reasons: db.reasons || [],
    countdowns: db.countdowns || [],
    ideas: db.ideas || [],
    places: db.places || [],
    capsules: db.capsules || [],
  };
}
function saveDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
if (!fs.existsSync(DB_FILE)) saveDb(DEFAULT_DB);

function newId() { return crypto.randomBytes(8).toString('hex'); }
const nowIso = () => new Date().toISOString();
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ---------- App ----------
const app = express();
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 60 },
}));

function passwordOk(input) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function requireAuth(req, res, next) {
  if (req.session && req.session.auth) return next();
  return res.status(401).json({ error: 'Serve la password.' });
}

// ---------- Pubbliche ----------
app.get('/api/config', (req, res) => {
  res.json({ coupleName: COUPLE_NAME, authed: !!(req.session && req.session.auth) });
});
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (passwordOk(password)) { req.session.auth = true; return res.json({ ok: true }); }
  return res.status(401).json({ error: 'Password sbagliata.' });
});
app.post('/api/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

app.get('/', (req, res) => {
  if (req.session && req.session.auth) return res.sendFile(path.join(__dirname, 'public', 'app.html'));
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ---------- SETTINGS ----------
app.get('/api/settings', requireAuth, (req, res) => res.json(loadDb().settings));
app.put('/api/settings', requireAuth, (req, res) => {
  const db = loadDb();
  const { anniversary, reunion, name1, name2 } = req.body || {};
  db.settings = {
    anniversary: anniversary != null ? String(anniversary) : db.settings.anniversary,
    reunion: reunion != null ? String(reunion) : db.settings.reunion,
    name1: name1 != null ? String(name1).trim() : db.settings.name1,
    name2: name2 != null ? String(name2).trim() : db.settings.name2,
  };
  saveDb(db);
  res.json(db.settings);
});

// ---------- EVENTI ----------
app.get('/api/events', requireAuth, (req, res) => {
  res.json([...loadDb().events].sort((x, y) => (x.date < y.date ? -1 : 1)));
});
app.post('/api/events', requireAuth, (req, res) => {
  const { date, title, note, category } = req.body || {};
  if (!date || !title || !String(title).trim()) return res.status(400).json({ error: 'Servono data e titolo.' });
  const db = loadDb();
  const ev = { id: newId(), date: String(date), title: String(title).trim(), note: note ? String(note).trim() : '', category: category ? String(category) : '', createdAt: nowIso() };
  db.events.push(ev); saveDb(db); res.json(ev);
});
app.delete('/api/events/:id', requireAuth, (req, res) => {
  const db = loadDb(); db.events = db.events.filter((e) => e.id !== req.params.id); saveDb(db); res.json({ ok: true });
});

// ---------- FOTO ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => { const ext = (path.extname(file.originalname) || '.jpg').toLowerCase(); cb(null, newId() + ext); },
});
const upload = multer({
  storage, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => { if (/^image\//.test(file.mimetype)) cb(null, true); else cb(new Error('Solo immagini.')); },
});
app.get('/api/photos', requireAuth, (req, res) => {
  res.json([...loadDb().photos].sort((x, y) => ((x.date || x.createdAt) < (y.date || y.createdAt) ? 1 : -1)));
});
app.post('/api/photos', requireAuth, (req, res) => {
  upload.array('photos', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const caption = req.body && req.body.caption ? String(req.body.caption).trim() : '';
    const date = req.body && req.body.date ? String(req.body.date) : '';
    const db = loadDb();
    const added = (req.files || []).map((f) => { const p = { id: newId(), file: f.filename, caption, date, createdAt: nowIso() }; db.photos.push(p); return p; });
    saveDb(db); res.json(added);
  });
});
app.delete('/api/photos/:id', requireAuth, (req, res) => {
  const db = loadDb(); const photo = db.photos.find((p) => p.id === req.params.id);
  if (photo) { fs.unlink(path.join(UPLOAD_DIR, photo.file), () => {}); db.photos = db.photos.filter((p) => p.id !== req.params.id); saveDb(db); }
  res.json({ ok: true });
});
app.get('/media/:file', requireAuth, (req, res) => {
  const safe = path.basename(req.params.file); const full = path.join(UPLOAD_DIR, safe);
  if (!fs.existsSync(full)) return res.status(404).end(); res.sendFile(full);
});

// ---------- BACHECA ----------
app.get('/api/notes', requireAuth, (req, res) => res.json([...loadDb().notes].sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))));
app.post('/api/notes', requireAuth, (req, res) => {
  const { text, author } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Scrivi qualcosa.' });
  const db = loadDb(); const n = { id: newId(), text: String(text).trim(), author: author ? String(author).trim() : '', createdAt: nowIso() };
  db.notes.push(n); saveDb(db); res.json(n);
});
app.delete('/api/notes/:id', requireAuth, (req, res) => { const db = loadDb(); db.notes = db.notes.filter((n) => n.id !== req.params.id); saveDb(db); res.json({ ok: true }); });

// ---------- DESIDERI ----------
app.get('/api/wishes', requireAuth, (req, res) => res.json(loadDb().wishes));
app.post('/api/wishes', requireAuth, (req, res) => {
  const { text } = req.body || {}; if (!text || !String(text).trim()) return res.status(400).json({ error: 'Scrivi un desiderio.' });
  const db = loadDb(); const w = { id: newId(), text: String(text).trim(), done: false, createdAt: nowIso() }; db.wishes.push(w); saveDb(db); res.json(w);
});
app.patch('/api/wishes/:id', requireAuth, (req, res) => {
  const db = loadDb(); const w = db.wishes.find((x) => x.id === req.params.id);
  if (w) { if (typeof req.body.done === 'boolean') w.done = req.body.done; saveDb(db); } res.json(w || { ok: false });
});
app.delete('/api/wishes/:id', requireAuth, (req, res) => { const db = loadDb(); db.wishes = db.wishes.filter((w) => w.id !== req.params.id); saveDb(db); res.json({ ok: true }); });

// ---------- MOTIVI ----------
app.get('/api/reasons', requireAuth, (req, res) => res.json([...loadDb().reasons].sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))));
app.post('/api/reasons', requireAuth, (req, res) => {
  const { text } = req.body || {}; if (!text || !String(text).trim()) return res.status(400).json({ error: 'Scrivi un motivo.' });
  const db = loadDb(); const r = { id: newId(), text: String(text).trim(), createdAt: nowIso() }; db.reasons.push(r); saveDb(db); res.json(r);
});
app.delete('/api/reasons/:id', requireAuth, (req, res) => { const db = loadDb(); db.reasons = db.reasons.filter((r) => r.id !== req.params.id); saveDb(db); res.json({ ok: true }); });

// ---------- CONTI ALLA ROVESCIA ----------
app.get('/api/countdowns', requireAuth, (req, res) => res.json([...loadDb().countdowns].sort((x, y) => (x.date < y.date ? -1 : 1))));
app.post('/api/countdowns', requireAuth, (req, res) => {
  const { title, date } = req.body || {};
  if (!title || !String(title).trim() || !date) return res.status(400).json({ error: 'Servono titolo e data.' });
  const db = loadDb(); const c = { id: newId(), title: String(title).trim(), date: String(date), createdAt: nowIso() }; db.countdowns.push(c); saveDb(db); res.json(c);
});
app.delete('/api/countdowns/:id', requireAuth, (req, res) => { const db = loadDb(); db.countdowns = db.countdowns.filter((c) => c.id !== req.params.id); saveDb(db); res.json({ ok: true }); });

// ---------- BARATTOLO DELLE IDEE ----------
app.get('/api/ideas', requireAuth, (req, res) => res.json([...loadDb().ideas].sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))));
app.post('/api/ideas', requireAuth, (req, res) => {
  const { text } = req.body || {}; if (!text || !String(text).trim()) return res.status(400).json({ error: 'Scrivi un\'idea.' });
  const db = loadDb(); const i = { id: newId(), text: String(text).trim(), createdAt: nowIso() }; db.ideas.push(i); saveDb(db); res.json(i);
});
app.delete('/api/ideas/:id', requireAuth, (req, res) => { const db = loadDb(); db.ideas = db.ideas.filter((i) => i.id !== req.params.id); saveDb(db); res.json({ ok: true }); });

// ---------- MAPPA DEI POSTI ----------
app.get('/api/places', requireAuth, (req, res) => res.json(loadDb().places));
app.post('/api/places', requireAuth, (req, res) => {
  const { name, note, kind, lat, lng } = req.body || {};
  const la = Number(lat), ln = Number(lng);
  if (!name || !String(name).trim() || !isFinite(la) || !isFinite(ln)) return res.status(400).json({ error: 'Servono nome e posizione.' });
  const db = loadDb();
  const p = { id: newId(), name: String(name).trim(), note: note ? String(note).trim() : '', kind: kind === 'wish' ? 'wish' : 'been', lat: la, lng: ln, createdAt: nowIso() };
  db.places.push(p); saveDb(db); res.json(p);
});
app.delete('/api/places/:id', requireAuth, (req, res) => { const db = loadDb(); db.places = db.places.filter((p) => p.id !== req.params.id); saveDb(db); res.json({ ok: true }); });

// ---------- CAPSULA DEL TEMPO (blocco lato server) ----------
app.get('/api/capsules', requireAuth, (req, res) => {
  const today = todayStr();
  const list = [...loadDb().capsules]
    .sort((x, y) => (x.openDate < y.openDate ? -1 : 1))
    .map((c) => {
      const unlocked = c.openDate <= today;
      return { id: c.id, title: c.title, openDate: c.openDate, author: c.author, createdAt: c.createdAt, unlocked, text: unlocked ? c.text : null };
    });
  res.json(list);
});
app.post('/api/capsules', requireAuth, (req, res) => {
  const { title, text, openDate, author } = req.body || {};
  if (!title || !String(title).trim() || !text || !String(text).trim() || !openDate) return res.status(400).json({ error: 'Servono titolo, messaggio e data di apertura.' });
  const db = loadDb();
  const c = { id: newId(), title: String(title).trim(), text: String(text).trim(), openDate: String(openDate), author: author ? String(author).trim() : '', createdAt: nowIso() };
  db.capsules.push(c); saveDb(db);
  const today = todayStr(); const unlocked = c.openDate <= today;
  res.json({ id: c.id, title: c.title, openDate: c.openDate, author: c.author, createdAt: c.createdAt, unlocked, text: unlocked ? c.text : null });
});
app.delete('/api/capsules/:id', requireAuth, (req, res) => { const db = loadDb(); db.capsules = db.capsules.filter((c) => c.id !== req.params.id); saveDb(db); res.json({ ok: true }); });

app.listen(PORT, () => {
  console.log(`\n  ${COUPLE_NAME} è in ascolto su http://localhost:${PORT}`);
  if (PASSWORD === 'cambiami') console.log('  ATTENZIONE: password di default "cambiami". Impostane una con APP_PASSWORD.\n');
});