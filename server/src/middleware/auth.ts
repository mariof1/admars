import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb, getSettings } from '../config/database.js';
import { isAdmin, AdUser } from '../services/ldap.js';

function getJwtSecret(): string {
  const env = process.env.JWT_SECRET;
  if (env) return env;

  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('jwt_secret') as { value: string } | undefined;
  if (row) return row.value;

  const secret = crypto.randomBytes(64).toString('hex');
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('jwt_secret', secret);
  return secret;
}

let _jwtSecret: string | null = null;
function jwtSecret(): string {
  if (!_jwtSecret) _jwtSecret = getJwtSecret();
  return _jwtSecret;
}

export interface AuthPayload {
  sAMAccountName: string;
  displayName: string;
  mail: string;
  dn: string;
  isAdmin: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: '8h' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret()) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function setupMiddleware(req: Request, res: Response, next: NextFunction): void {
  const settings = getSettings();
  if (!settings) {
    // Allow setup-related routes even without settings
    const allowedPaths = ['/api/settings', '/api/settings/test'];
    if (allowedPaths.includes(req.path)) {
      next();
      return;
    }
    res.status(503).json({ error: 'Application not configured', needsSetup: true });
    return;
  }
  next();
}
