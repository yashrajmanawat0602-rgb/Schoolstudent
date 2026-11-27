import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { ensureSeeded } from './src/db/seed.ts';
import { requireAuth } from './src/middleware/auth.ts';
import adminRoutes from './src/routes/adminRoutes.ts';
import authRoutes from './src/routes/authRoutes.ts';
import portalRoutes from './src/routes/portalRoutes.ts';
import teacherRoutes from './src/routes/teacherRoutes.ts';
import {
  attachLiveAssistantWebSocket,
  handleAssistantTextAsk,
} from './src/services/liveAssistant.ts';
import { resolveSafeUploadPath } from './src/utils/security.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false, // Required for AI Studio preview iframe embedding
    crossOriginOpenerPolicy: false, // Allow Firebase Google Sign-In popup communication
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait a moment and try again.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// Lazy DB initialization on first API traffic (avoids startup probes)
app.use('/api', apiLimiter, async (_req, res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(503).json({ error: 'Database service temporarily unavailable.' });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.post('/api/assistant/ask', handleAssistantTextAsk);
app.use('/api', portalRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/admin', adminRoutes);

// Secure sample study guide downloads (allowlisted static study materials)
const SAMPLE_STUDY_NOTES: Record<string, string> = {
  'Physics_Electricity_Notes.txt': [
    'SCHOOLCONNECT DIGITAL NOTES LIBRARY — CLASS 10 SCIENCE (PHYSICS)',
    'Chapter 12: Electricity — Ohm’s Law & Circuit Analysis',
    '================================================================',
    '',
    '1. Electric Current (I): Rate of flow of electric charge. I = Q / t (Unit: Ampere, A).',
    '2. Potential Difference (V): Work done per unit charge. V = W / Q (Unit: Volt, V).',
    '3. Ohm’s Law: At constant temperature, V = I * R.',
    '4. Series Combination: R_eq = R1 + R2 + R3 (Current remains same; voltage divides).',
    '5. Parallel Combination: 1/R_eq = 1/R1 + 1/R2 + 1/R3 (Voltage remains same).',
    '6. Joule’s Law of Heating: H = I^2 * R * t.',
  ].join('\n'),
  'Math_Quadratic_Formula_Sheet.txt': [
    'SCHOOLCONNECT DIGITAL NOTES LIBRARY — CLASS 10 MATHEMATICS',
    'Chapter 4: Quadratic Equations — Discriminant & Roots Formula Sheet',
    '================================================================',
    '',
    '1. Standard Form: ax^2 + bx + c = 0 (a != 0).',
    '2. Quadratic Formula: x = (-b +/- sqrt(b^2 - 4ac)) / (2a).',
    '3. Discriminant D = b^2 - 4ac:',
    '   - D > 0: Two distinct real roots',
    '   - D = 0: Two equal real roots',
    '   - D < 0: No real roots',
  ].join('\n'),
  'History_Timeline_Deck.txt': [
    'SCHOOLCONNECT DIGITAL NOTES LIBRARY — CLASS 10 SOCIAL SCIENCE',
    'Chapter 3: Nationalism in India (1919–1947 Key Milestones)',
    '================================================================',
    '',
    '1919 — Rowlatt Act & Jallianwala Bagh',
    '1920 — Non-Cooperation Movement launched',
    '1930 — Dandi Salt March & Civil Disobedience Movement',
    '1942 — Quit India Movement',
    '1947 — Independence & Constituent Assembly',
  ].join('\n'),
  'Grade7_Geometry_Reference.txt': [
    'SCHOOLCONNECT DIGITAL NOTES LIBRARY — CLASS 7 MATHEMATICS',
    'Chapter 6: Lines and Angles',
    '================================================================',
    '',
    '1. Complementary Angles sum to 90 degrees.',
    '2. Supplementary Angles sum to 180 degrees.',
    '3. Parallel lines cut by a transversal create equal alternate interior angles.',
  ].join('\n'),
  'Quadratic_Worksheet_Ch4.txt': [
    'HOMEWORK WORKSHEET — CHAPTER 4: QUADRATIC EQUATIONS',
    'Solve Questions 1-10 and verify roots using the discriminant D = b^2 - 4ac.',
    'Q1. x^2 - 7x + 12 = 0',
    'Q2. 2x^2 + 5x - 3 = 0',
    'Q3. 4x^2 - 12x + 9 = 0',
  ].join('\n'),
  'Physics_Circuits_Guide.txt': [
    'HOMEWORK GUIDE — CIRCUIT RESISTANCE NUMERICALS',
    'Draw clean circuit diagrams and calculate equivalent resistance for Problems 1-6.',
  ].join('\n'),
};

app.get('/api/files/sample/:filename', (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  const content = SAMPLE_STUDY_NOTES[filename];
  if (!content) {
    return res.status(404).json({ error: 'Document not found.' });
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(content);
});

app.get('/api/files/uploads/:filename', requireAuth, (req, res) => {
  const safePath = resolveSafeUploadPath(UPLOADS_DIR, String(req.params.filename || ''));
  if (!safePath || !fs.existsSync(safePath)) {
    return res.status(404).json({ error: 'Uploaded file not found.' });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.download(safePath);
});

const IMAGE_MEDIA_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
app.get('/api/media/:filename', (req, res) => {
  const filename = String(req.params.filename || '');
  const ext = path.extname(filename).toLowerCase();
  if (!IMAGE_MEDIA_EXTS.has(ext)) {
    return res.status(403).json({ error: 'Invalid media file type.' });
  }
  const safePath = resolveSafeUploadPath(UPLOADS_DIR, filename);
  if (!safePath || !fs.existsSync(safePath)) {
    return res.status(404).json({ error: 'Media file not found.' });
  }
  return res.sendFile(safePath);
});

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  server.requestTimeout = 0; // Allow large (1GB+) student activity video uploads
  server.headersTimeout = 60 * 1000;
  attachLiveAssistantWebSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Macro Vision Academy Burhanpur server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Macro Vision Academy Burhanpur server:', err);
  process.exit(1);
});
