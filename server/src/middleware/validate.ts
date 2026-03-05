import { Request, Response, NextFunction } from 'express';

// Strict username pattern: alphanumeric, dots, hyphens, underscores
const USERNAME_RE = /^[a-zA-Z0-9._-]{1,64}$/;
// DN-safe pattern: reject null bytes and control chars
const DN_SAFE_RE = /^[^\x00-\x1f]*$/;

export function validateUsername(req: Request, res: Response, next: NextFunction): void {
  const username = String(req.params.username || '');
  if (username && !USERNAME_RE.test(username)) {
    res.status(400).json({ error: 'Invalid username format' });
    return;
  }
  next();
}

export function validateCreateUser(req: Request, res: Response, next: NextFunction): void {
  const { sAMAccountName, givenName, sn, displayName, userPrincipalName, password } = req.body;

  if (!sAMAccountName || !USERNAME_RE.test(sAMAccountName)) {
    res.status(400).json({ error: 'Invalid username format (alphanumeric, dots, hyphens, underscores, max 64 chars)' });
    return;
  }
  if (!givenName || givenName.length > 64 || !DN_SAFE_RE.test(givenName)) {
    res.status(400).json({ error: 'Invalid first name' });
    return;
  }
  if (!sn || sn.length > 64 || !DN_SAFE_RE.test(sn)) {
    res.status(400).json({ error: 'Invalid last name' });
    return;
  }
  if (!displayName || displayName.length > 128 || !DN_SAFE_RE.test(displayName)) {
    res.status(400).json({ error: 'Invalid display name' });
    return;
  }
  if (!userPrincipalName || userPrincipalName.length > 256 || !userPrincipalName.includes('@')) {
    res.status(400).json({ error: 'Invalid UPN format (must contain @)' });
    return;
  }
  if (!password || password.length < 8 || password.length > 256) {
    res.status(400).json({ error: 'Password must be 8-256 characters' });
    return;
  }

  next();
}

export function validateFieldLengths(req: Request, res: Response, next: NextFunction): void {
  const MAX_FIELD_LENGTH = 1024;
  for (const [key, value] of Object.entries(req.body)) {
    if (typeof value === 'string') {
      if (value.length > MAX_FIELD_LENGTH) {
        res.status(400).json({ error: `Field '${key}' exceeds maximum length (${MAX_FIELD_LENGTH} chars)` });
        return;
      }
      if (!DN_SAFE_RE.test(value)) {
        res.status(400).json({ error: `Field '${key}' contains invalid characters` });
        return;
      }
    }
  }
  next();
}

export function validateGroupDn(req: Request, res: Response, next: NextFunction): void {
  const { groupDn } = req.body;
  if (!groupDn || typeof groupDn !== 'string' || groupDn.length > 2048 || !DN_SAFE_RE.test(groupDn)) {
    res.status(400).json({ error: 'Invalid group DN' });
    return;
  }
  next();
}
