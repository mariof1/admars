import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSettings } from '../config/database.js';
import { isAdmin, AdUser } from '../services/ldap.js';

const JWT_SECRET = process.env.JWT_SECRET || 'admars-secret-change-in-production-' + Math.random().toString(36);

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
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
