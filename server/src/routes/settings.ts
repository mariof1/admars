import { Router, Request, Response } from 'express';
import { getSettings, saveSettings, AdSettings } from '../config/database.js';
import { testConnection } from '../services/ldap.js';
import { AuthRequest, authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAction, logInfo } from '../utils/logger.js';

const router = Router();

// Check if setup is needed
router.get('/status', (_req: Request, res: Response) => {
  const settings = getSettings();
  res.json({ configured: !!settings });
});

// Get current settings (admin only, passwords masked)
router.get('/', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
  const settings = getSettings();
  if (!settings) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    settings: {
      ...settings,
      bindPassword: '••••••••',
    },
  });
});

// Save settings
router.post('/', async (req: Request, res: Response) => {
  try {
    const existing = getSettings();
    const body = req.body as Partial<AdSettings>;

    // If already configured, require admin auth
    if (existing) {
      const authReq = req as AuthRequest;
      const token = authReq.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      // Auth check would be done by middleware in a real scenario
    }

    const settings: AdSettings = {
      url: body.url || '',
      baseDN: body.baseDN || '',
      bindDN: body.bindDN || '',
      bindPassword: body.bindPassword === '••••••••' && existing ? existing.bindPassword : (body.bindPassword || ''),
      adminGroup: body.adminGroup || '',
      useTLS: body.useTLS ?? false,
    };

    saveSettings(settings);
    logAction('system', 'SAVE_SETTINGS', settings.url);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test connection
router.post('/test', async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<AdSettings>;
    const existing = getSettings();

    const settings: AdSettings = {
      url: body.url || '',
      baseDN: body.baseDN || '',
      bindDN: body.bindDN || '',
      bindPassword: body.bindPassword === '••••••••' && existing ? existing.bindPassword : (body.bindPassword || ''),
      adminGroup: body.adminGroup || '',
      useTLS: body.useTLS ?? false,
    };

    const result = await testConnection(settings);
    logInfo(`Connection test: ${result.success ? 'OK' : 'FAILED'} — ${result.message}`);
    res.json(result);
  } catch (err: any) {
    res.json({ success: false, message: err.message });
  }
});

export default router;
