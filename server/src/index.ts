import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDb } from './config/database.js';
import { setupMiddleware } from './middleware/auth.js';
import settingsRouter from './routes/settings.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import { logInfo } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000');

// Init database
initDb();

const app = express();

// Trust reverse proxy (nginx/traefik) for accurate rate-limiting by real client IP
app.set('trust proxy', 1);

// Security headers
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
}));

// Global rate limit — 200 requests per minute per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
}));

// Strict rate limit on login — 10 attempts per 15 minutes per IP
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

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
  logInfo(`🚀 ADMars server running on http://0.0.0.0:${PORT}`);
  logInfo('Security: helmet, rate-limiting, input validation enabled');
});
