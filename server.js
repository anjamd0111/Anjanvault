// Anjan Digital Vault — upload any song/recording/file, only Anjan can view, play & download.
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'anjan123'; // Railway Variables e change koro!
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const META = path.join(UPLOAD_DIR, 'meta.json');
const BG_URL = process.env.BG_URL || '';
const VISITS = path.join(UPLOAD_DIR, 'visits.json');
const MAX_MB = parseInt(process.env.MAX_MB || '0', 10); // 0 = kono limit nai

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
let meta = [];
try { meta = JSON.parse(fs.readFileSync(META, 'utf8')); } catch (_) {}
const SETTINGS = path.join(UPLOAD_DIR, 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch (_) {}
let visits = [];
try { visits = JSON.parse(fs.readFileSync(VISITS, 'utf8')); } catch (_) {}
const saveVisits = () => fs.writeFileSync(VISITS, JSON.stringify(visits.slice(0, 5000)));
const save = () => fs.writeFileSync(META, JSON.stringify(meta, null, 2));

const TOKEN = crypto.createHash('sha256').update('vault:' + ADMIN_PASSWORD).digest('hex');
const isAdmin = (req) => req.cookies && req.cookies.vault === TOKEN;
const needAdmin = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: 'Login lagbe' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).slice(0, 10)),
  }),
  limits: MAX_MB > 0 ? { fileSize: MAX_MB * 1024 * 1024 } : {},
});

const app = express();
app.set('trust proxy', true);
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public: anyone can upload
app.post('/api/upload', (req, res) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const now = new Date().toISOString();
    const by = String(req.body.name || 'Anonymous').slice(0, 60);
    for (const f of req.files || []) {
      meta.unshift({ id: f.filename, original: f.originalname, mime: f.mimetype, size: f.size, by, at: now });
    }
    save();
    res.json({ ok: true, count: (req.files || []).length });
  });
});


// ---------- Visitor tracking ----------
function parseUA(ua = '') {
  let os = 'Unknown', device = 'Desktop', model = '', browser = 'Unknown', m;
  if ((m = ua.match(/Android ([\d.]+)/))) { os = 'Android ' + m[1]; device = 'Phone';
    const mm = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build|\)|;)/); if (mm) model = mm[1].trim(); }
  else if ((m = ua.match(/iPhone OS ([\d_]+)/))) { os = 'iOS ' + m[1].replace(/_/g, '.'); device = 'Phone'; model = 'iPhone'; }
  else if ((m = ua.match(/iPad.*OS ([\d_]+)/))) { os = 'iPadOS ' + m[1].replace(/_/g, '.'); device = 'Tablet'; model = 'iPad'; }
  else if ((m = ua.match(/Windows NT ([\d.]+)/))) os = 'Windows ' + ({ '10.0': '10/11', '6.3': '8.1', '6.1': '7' }[m[1]] || m[1]);
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  if (/Edg\//.test(ua)) browser = 'Edge'; else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet'; else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/FBAN|FBAV/.test(ua)) browser = 'Facebook App'; else if (/Instagram/.test(ua)) browser = 'Instagram App';
  else if (/Chrome\//.test(ua)) browser = 'Chrome'; else if (/Safari\//.test(ua)) browser = 'Safari';
  return { os, device, model, browser };
}
const cleanStr = (v, n = 80) => String(v == null ? '' : v).slice(0, n);

app.get('/api/config', (req, res) => res.json({
  bg: settings.bg !== undefined ? settings.bg : BG_URL,
  dim: settings.dim !== undefined ? settings.dim : 70,
  blur: settings.blur !== undefined ? settings.blur : 0,
  theme: settings.theme || 'neon',
}));
app.post('/api/settings', needAdmin, (req, res) => {
  const b = req.body || {};
  const bg = String(b.bg || '').trim().slice(0, 1000);
  if (bg && !/^https?:\/\//i.test(bg)) return res.status(400).json({ error: 'URL http:// ba https:// diye shuru hote hobe' });
  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const theme = ['neon', 'sunset', 'ocean', 'emerald', 'rose'].includes(b.theme) ? b.theme : 'neon';
  settings = { bg, dim: num(b.dim, 0, 95, 70), blur: num(b.blur, 0, 20, 0), theme };
  fs.writeFileSync(SETTINGS, JSON.stringify(settings));
  res.json({ ok: true });
});

app.post('/api/visit', (req, res) => {
  const b = req.body || {};
  const ua = req.headers['user-agent'] || '';
  const p = parseUA(ua);
  const vid = cleanStr(b.vid, 40);
  const prev = visits.filter((v) => v.vid === vid).length;
  visits.unshift({
    vid, n: prev + 1, at: new Date().toISOString(),
    ip: (req.ip || '').replace('::ffff:', ''),
    os: p.os, browser: p.browser, device: p.device,
    model: cleanStr(b.model) || p.model,
    screen: cleanStr(b.screen, 20), viewport: cleanStr(b.viewport, 20), dpr: cleanStr(b.dpr, 6),
    lang: cleanStr(b.lang, 20), tz: cleanStr(b.tz, 40), touch: !!b.touch,
    net: cleanStr(b.net, 10), ram: cleanStr(b.ram, 6), cores: cleanStr(b.cores, 4),
    ref: cleanStr(b.ref, 120),
  });
  if (visits.length > 5000) visits.length = 5000;
  saveVisits();
  res.json({ ok: true });
});

app.get('/api/count', (req, res) => res.json({ total: visits.length, unique: new Set(visits.map((v) => v.vid)).size }));

app.get('/api/stats', needAdmin, (req, res) => {
  const day = (d) => d.toISOString().slice(0, 10);
  const today = day(new Date());
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = day(new Date(Date.now() - i * 86400000));
    daily.push({ d, n: visits.filter((v) => v.at.slice(0, 10) === d).length });
  }
  const count = (k) => visits.reduce((a, v) => ((a[v[k] || 'Unknown'] = (a[v[k] || 'Unknown'] || 0) + 1), a), {});
  res.json({
    total: visits.length,
    unique: new Set(visits.map((v) => v.vid)).size,
    today: visits.filter((v) => v.at.slice(0, 10) === today).length,
    files: meta.length,
    storage: meta.reduce((a, m) => a + m.size, 0),
    daily, devices: count('device'), browsers: count('browser'),
  });
});
app.get('/api/visits', needAdmin, (req, res) => res.json(visits.slice(0, 300)));
app.delete('/api/visits', needAdmin, (req, res) => { visits = []; saveVisits(); res.json({ ok: true }); });

// Admin
app.post('/api/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Vul password' });
  res.cookie('vault', TOKEN, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { res.clearCookie('vault'); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ admin: isAdmin(req) }));
app.get('/api/files', needAdmin, (req, res) => res.json(meta));

const find = (id) => meta.find((m) => m.id === id);
app.get('/api/file/:id', needAdmin, (req, res) => {
  const m = find(req.params.id);
  if (!m) return res.sendStatus(404);
  res.type(m.mime);
  res.sendFile(path.join(UPLOAD_DIR, m.id)); // Range support => audio seek kaj kore
});
app.get('/api/download/:id', needAdmin, (req, res) => {
  const m = find(req.params.id);
  if (!m) return res.sendStatus(404);
  res.download(path.join(UPLOAD_DIR, m.id), m.original);
});
app.delete('/api/file/:id', needAdmin, (req, res) => {
  const i = meta.findIndex((m) => m.id === req.params.id);
  if (i < 0) return res.sendStatus(404);
  fs.unlink(path.join(UPLOAD_DIR, meta[i].id), () => {});
  meta.splice(i, 1);
  save();
  res.json({ ok: true });
});

const server = app.listen(PORT, () => console.log('Anjan Digital Vault running on port ' + PORT));
// boro file er jonno timeout bondho (Node default 5 min por upload kete dey)
server.requestTimeout = 0;
server.headersTimeout = 65000;
server.timeout = 0;
