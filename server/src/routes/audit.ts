import { Router, Response } from 'express';
import { getDb, getSettings } from '../config/database.js';
import { searchUsers } from '../services/ldap.js';
import { AuthRequest, authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAction } from '../utils/logger.js';

const router = Router();

// Activity logs with filtering + pagination
router.get('/logs', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(String(req.query.pageSize)) || 50));
    const offset = (page - 1) * pageSize;

    const filters: string[] = [];
    const params: any[] = [];

    if (req.query.actor) {
      filters.push('actor LIKE ?');
      params.push(`%${req.query.actor}%`);
    }
    if (req.query.action) {
      filters.push('action = ?');
      params.push(String(req.query.action));
    }
    if (req.query.success !== undefined && req.query.success !== '') {
      filters.push('success = ?');
      params.push(req.query.success === 'true' ? 1 : 0);
    }
    if (req.query.from) {
      filters.push('timestamp >= ?');
      params.push(String(req.query.from));
    }
    if (req.query.to) {
      filters.push('timestamp <= ?');
      params.push(String(req.query.to));
    }
    if (req.query.search) {
      filters.push('(actor LIKE ? OR target LIKE ? OR detail LIKE ? OR ip LIKE ?)');
      const s = `%${req.query.search}%`;
      params.push(s, s, s, s);
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${where}`).get(...params) as any).count;
    const logs = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

    res.json({ logs, total, page, pageSize });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Distinct action types for filter dropdown
router.get('/actions', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const actions = db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all() as { action: string }[];
    res.json({ actions: actions.map((a) => a.action) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
router.get('/stats', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const settings = getSettings();

    // Total events today
    const today = new Date().toISOString().slice(0, 10);
    const eventsToday = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ?").get(today) as any).count;

    // Failed events today
    const failedToday = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND success = 0").get(today) as any).count;

    // Login attempts today
    const loginsToday = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND action = 'LOGIN'").get(today) as any).count;

    // Failed logins today
    const failedLoginsToday = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND action = 'LOGIN' AND success = 0").get(today) as any).count;

    // Actions breakdown (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const actionBreakdown = db.prepare(
      "SELECT action, COUNT(*) as count FROM audit_logs WHERE timestamp >= ? GROUP BY action ORDER BY count DESC"
    ).all(thirtyDaysAgo) as { action: string; count: number }[];

    // Daily activity (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const dailyActivity = db.prepare(
      "SELECT date(timestamp) as day, COUNT(*) as total, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed FROM audit_logs WHERE timestamp >= ? GROUP BY date(timestamp) ORDER BY day"
    ).all(fourteenDaysAgo) as { day: string; total: number; failed: number }[];

    // Top actors (last 30 days)
    const topActors = db.prepare(
      "SELECT actor, COUNT(*) as count FROM audit_logs WHERE timestamp >= ? GROUP BY actor ORDER BY count DESC LIMIT 10"
    ).all(thirtyDaysAgo) as { actor: string; count: number }[];

    // Recent failed logins with IPs
    const recentFailedLogins = db.prepare(
      "SELECT actor, ip, timestamp FROM audit_logs WHERE action = 'LOGIN' AND success = 0 ORDER BY timestamp DESC LIMIT 20"
    ).all() as { actor: string; ip: string; timestamp: string }[];

    // Unique IPs today
    const uniqueIpsToday = (db.prepare("SELECT COUNT(DISTINCT ip) as count FROM audit_logs WHERE timestamp >= ? AND ip IS NOT NULL").get(today) as any).count;

    // AD user stats
    let userStats = { total: 0, enabled: 0, disabled: 0, locked: 0 };
    if (settings) {
      try {
        const { users, total } = await searchUsers(settings, '', 1, 9999);
        userStats.total = total;
        userStats.enabled = users.filter((u: any) => !u.disabled).length;
        userStats.disabled = users.filter((u: any) => u.disabled).length;
        userStats.locked = users.filter((u: any) => u.locked).length;
      } catch {}
    }

    res.json({
      eventsToday,
      failedToday,
      loginsToday,
      failedLoginsToday,
      uniqueIpsToday,
      actionBreakdown,
      dailyActivity,
      topActors,
      recentFailedLogins,
      userStats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Prune old logs
router.delete('/logs', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const olderThan = String(req.query.olderThan || '');

    if (!olderThan) {
      res.status(400).json({ error: 'olderThan query parameter is required (ISO date or number of days)' });
      return;
    }

    // Accept either ISO date string or number of days
    let cutoff: string;
    const days = parseInt(olderThan);
    if (!isNaN(days) && days > 0) {
      cutoff = new Date(Date.now() - days * 86400000).toISOString();
    } else {
      cutoff = olderThan;
    }

    const result = db.prepare('DELETE FROM audit_logs WHERE timestamp < ?').run(cutoff);
    logAction(req.user!.sAMAccountName, 'PRUNE_LOGS', undefined, `${result.changes} entries older than ${olderThan}`, req.ip);
    res.json({ deleted: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
