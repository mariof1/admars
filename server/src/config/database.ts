import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '..', 'data');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function initDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(path.join(DATA_DIR, 'admars.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      ip TEXT,
      success INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Index for common queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);`);

  return db;
}

export interface AdSettings {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  adminGroup: string;
  useTLS: boolean;
}

export function getSettings(): AdSettings | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('ad_config') as { value: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.value);
}

export function saveSettings(settings: AdSettings): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ad_config', JSON.stringify(settings));
}
