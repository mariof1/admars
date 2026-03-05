import { Router, Response, Request } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { getSettings } from '../config/database.js';
import { searchUsers, getUser, updateUser, updateUserPhoto, deleteUserPhoto, resetPassword, createUser } from '../services/ldap.js';
import { AuthRequest, authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// List users (admin only)
router.get('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const query = req.query.q as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const result = await searchUsers(settings, query, page, pageSize);
    res.json(result);
  } catch (err: any) {
    console.error('Search users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new user (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const { sAMAccountName, givenName, sn, displayName, userPrincipalName, mail, password, ou, enabled } = req.body;

    if (!sAMAccountName || !givenName || !sn || !displayName || !userPrincipalName || !password) {
      res.status(400).json({ error: 'Required fields: sAMAccountName, givenName, sn, displayName, userPrincipalName, password' });
      return;
    }

    // Check if user already exists
    const existing = await getUser(settings, sAMAccountName);
    if (existing) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    await createUser(settings, { sAMAccountName, givenName, sn, displayName, userPrincipalName, mail, password, ou, enabled });
    res.status(201).json({ success: true, sAMAccountName });
  } catch (err: any) {
    console.error('Create user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single user
router.get('/:username', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    // Non-admins can only view themselves
    if (!req.user?.isAdmin && req.user?.sAMAccountName !== String(req.params.username)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    res.json(user);
  } catch (err: any) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update user
router.put('/:username', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    // Non-admins can only edit themselves (limited fields)
    const isSelf = req.user?.sAMAccountName === String(req.params.username);
    if (!req.user?.isAdmin && !isSelf) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const allowedSelfFields = ['telephoneNumber', 'mobile', 'streetAddress', 'l', 'st', 'postalCode', 'co', 'wWWHomePage'];
    const changes: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'dn' || key === 'sAMAccountName' || key === 'thumbnailPhoto') continue;
      if (!req.user?.isAdmin && !allowedSelfFields.includes(key)) continue;
      changes[key] = value as string | null;
    }

    await updateUser(settings, user.dn, changes, user);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload photo
router.post('/:username/photo', authMiddleware, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const isSelf = req.user?.sAMAccountName === String(req.params.username);
    if (!req.user?.isAdmin && !isSelf) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    // Resize to 96x96 JPEG for AD thumbnailPhoto (max ~10KB recommended)
    const resized = await sharp(req.file.buffer)
      .resize(96, 96, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();

    await updateUserPhoto(settings, user.dn, resized);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Upload photo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete photo
router.delete('/:username/photo', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const isSelf = req.user?.sAMAccountName === String(req.params.username);
    if (!req.user?.isAdmin && !isSelf) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await deleteUserPhoto(settings, user.dn);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset password (admin or self)
router.post('/:username/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const isSelf = req.user?.sAMAccountName === String(req.params.username);
    if (!req.user?.isAdmin && !isSelf) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await resetPassword(settings, user.dn, newPassword);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
