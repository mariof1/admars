import { Router, Response } from 'express';
import { getSettings } from '../config/database.js';
import { authenticate, isAdmin } from '../services/ldap.js';
import { AuthRequest, authMiddleware, signToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const settings = getSettings();
    if (!settings) {
      res.status(503).json({ error: 'Application not configured', needsSetup: true });
      return;
    }

    const user = await authenticate(settings, username, password);
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Check if disabled
    const UAC_ACCOUNTDISABLE = 0x0002;
    if (user.userAccountControl & UAC_ACCOUNTDISABLE) {
      res.status(403).json({ error: 'Account is disabled' });
      return;
    }

    const admin = await isAdmin(settings, user);

    const token = signToken({
      sAMAccountName: user.sAMAccountName,
      displayName: user.displayName,
      mail: user.mail,
      dn: user.dn,
      isAdmin: admin,
    });

    res.json({
      token,
      user: {
        sAMAccountName: user.sAMAccountName,
        displayName: user.displayName,
        mail: user.mail,
        isAdmin: admin,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
