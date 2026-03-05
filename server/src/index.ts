import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './config/database.js';
import { setupMiddleware } from './middleware/auth.js';
import settingsRouter from './routes/settings.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000');

// Init database
initDb();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/settings', settingsRouter);
app.use('/api/auth', setupMiddleware, authRouter);
app.use('/api/users', setupMiddleware, usersRouter);

// API error handler — return JSON for any /api errors (e.g. multer file size)
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API error:', err.message);
  const status = err.status || err.statusCode || 500;
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 20MB)' : err.message;
  res.status(status).json({ error: message });
});

// Serve static files from client build
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ADMars server running on http://0.0.0.0:${PORT}`);
});
