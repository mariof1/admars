import { Router, Response, Request } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { getSettings } from '../config/database.js';
import { searchUsers, getUser, updateUser, updateUserPhoto, deleteUserPhoto, resetPassword, createUser, searchGroups, addUserToGroup, removeUserFromGroup, setUserEnabled, deleteUser, unlockUser } from '../services/ldap.js';
import { AuthRequest, authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { validateUsername, validateCreateUser, validateFieldLengths, validateGroupDn } from '../middleware/validate.js';
import { logAction, logError } from '../utils/logger.js';

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
router.post('/', authMiddleware, adminMiddleware, validateCreateUser, async (req: AuthRequest, res: Response) => {
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
    logAction(req.user!.sAMAccountName, 'CREATE_USER', sAMAccountName, displayName);
    res.status(201).json({ success: true, sAMAccountName });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'CREATE_USER', err.message);
    console.error('Create user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single user
router.get('/:username', authMiddleware, validateUsername, async (req: AuthRequest, res: Response) => {
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
router.put('/:username', authMiddleware, validateUsername, validateFieldLengths, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    // Only admins can edit users
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required to edit users' });
      return;
    }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const changes: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'dn' || key === 'sAMAccountName' || key === 'thumbnailPhoto') continue;
      changes[key] = value as string | null;
    }

    const changedKeys = Object.keys(changes).filter((k) => changes[k] !== (user as any)[k]);
    await updateUser(settings, user.dn, changes, user);
    logAction(req.user!.sAMAccountName, 'UPDATE_USER', String(req.params.username), changedKeys.join(', '));
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'UPDATE_USER', err.message);
    console.error('Update user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Enable/disable user (admin only)
router.post('/:username/toggle', authMiddleware, adminMiddleware, validateUsername, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled (boolean) is required' });
      return;
    }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await setUserEnabled(settings, user.dn, enabled);
    logAction(req.user!.sAMAccountName, enabled ? 'ENABLE_USER' : 'DISABLE_USER', String(req.params.username));
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'TOGGLE_USER', err.message);
    console.error('Toggle user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unlock user account (admin only)
router.post('/:username/unlock', authMiddleware, adminMiddleware, validateUsername, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await unlockUser(settings, user.dn);
    logAction(req.user!.sAMAccountName, 'UNLOCK_USER', String(req.params.username));
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'UNLOCK_USER', err.message);
    console.error('Unlock user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
router.delete('/:username', authMiddleware, adminMiddleware, validateUsername, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    // Prevent self-deletion
    if (req.user?.sAMAccountName === user.sAMAccountName) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await deleteUser(settings, user.dn);
    logAction(req.user!.sAMAccountName, 'DELETE_USER', String(req.params.username), user.displayName);
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'DELETE_USER', err.message);
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload photo
router.post('/:username/photo', authMiddleware, validateUsername, upload.single('photo'), async (req: AuthRequest, res: Response) => {
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

    // Resize to max 648x648 JPEG, ensuring it fits within 100KB for AD thumbnailPhoto
    let resized = await sharp(req.file.buffer)
      .resize(648, 648, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Reduce quality iteratively if over 100KB
    const MAX_BYTES = 100 * 1024;
    let quality = 85;
    while (resized.length > MAX_BYTES && quality >= 30) {
      resized = await sharp(req.file.buffer)
        .resize(648, 648, { fit: 'cover' })
        .jpeg({ quality })
        .toBuffer();
      quality -= 5;
    }

    await updateUserPhoto(settings, user.dn, resized);
    logAction(req.user!.sAMAccountName, 'UPLOAD_PHOTO', String(req.params.username), `${Math.round(resized.length / 1024)}KB`);
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'UPLOAD_PHOTO', err.message);
    console.error('Upload photo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete photo
router.delete('/:username/photo', authMiddleware, validateUsername, async (req: AuthRequest, res: Response) => {
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
    logAction(req.user!.sAMAccountName, 'DELETE_PHOTO', String(req.params.username));
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'DELETE_PHOTO', err.message);
    console.error('Delete photo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset password (admin or self)
router.post('/:username/password', authMiddleware, validateUsername, async (req: AuthRequest, res: Response) => {
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
    logAction(req.user!.sAMAccountName, 'RESET_PASSWORD', String(req.params.username));
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'RESET_PASSWORD', err.message);
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search groups (admin only)
router.get('/:username/groups/search', authMiddleware, adminMiddleware, validateUsername, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const query = req.query.q as string | undefined;
    const groups = await searchGroups(settings, query || undefined);
    res.json({ groups });
  } catch (err: any) {
    console.error('Search groups error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add user to group (admin only)
router.post('/:username/groups', authMiddleware, adminMiddleware, validateUsername, validateGroupDn, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const { groupDn } = req.body;
    if (!groupDn) { res.status(400).json({ error: 'groupDn is required' }); return; }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await addUserToGroup(settings, user.dn, groupDn);
    const groupCn = groupDn.match(/^CN=([^,]+)/)?.[1] || groupDn;
    logAction(req.user!.sAMAccountName, 'ADD_TO_GROUP', String(req.params.username), groupCn);
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'ADD_TO_GROUP', err.message);
    console.error('Add to group error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Remove user from group (admin only)
router.delete('/:username/groups', authMiddleware, adminMiddleware, validateUsername, validateGroupDn, async (req: AuthRequest, res: Response) => {
  try {
    const settings = getSettings();
    if (!settings) { res.status(503).json({ error: 'Not configured' }); return; }

    const { groupDn } = req.body;
    if (!groupDn) { res.status(400).json({ error: 'groupDn is required' }); return; }

    const user = await getUser(settings, String(req.params.username));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await removeUserFromGroup(settings, user.dn, groupDn);
    const groupCn = groupDn.match(/^CN=([^,]+)/)?.[1] || groupDn;
    logAction(req.user!.sAMAccountName, 'REMOVE_FROM_GROUP', String(req.params.username), groupCn);
    res.json({ success: true });
  } catch (err: any) {
    logError(req.user?.sAMAccountName || 'unknown', 'REMOVE_FROM_GROUP', err.message);
    console.error('Remove from group error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
