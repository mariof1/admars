import { getDb } from '../config/database.js';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

function ts(): string {
  return new Date().toISOString();
}

function writeAudit(actor: string, action: string, target?: string, detail?: string, ip?: string, success = true) {
  try {
    getDb().prepare(
      'INSERT INTO audit_logs (timestamp, actor, action, target, detail, ip, success) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(ts(), actor, action, target || null, detail || null, ip || null, success ? 1 : 0);
  } catch {
    // Don't let audit writes break the app
  }
}

export function logAction(actor: string, action: string, target?: string, detail?: string, ip?: string) {
  const parts = [`${DIM}${ts()}${RESET}`, `${GREEN}▶${RESET}`, `${CYAN}${actor}${RESET}`, action];
  if (target) parts.push(`→ ${YELLOW}${target}${RESET}`);
  if (detail) parts.push(`${DIM}(${detail})${RESET}`);
  console.log(parts.join(' '));
  writeAudit(actor, action, target, detail, ip, true);
}

export function logError(actor: string, action: string, error: string, ip?: string) {
  console.error(`${DIM}${ts()}${RESET} ${RED}✖${RESET} ${CYAN}${actor}${RESET} ${action} ${RED}FAILED${RESET}: ${error}`);
  writeAudit(actor, action, undefined, error, ip, false);
}

export function logInfo(message: string) {
  console.log(`${DIM}${ts()}${RESET} ${DIM}ℹ${RESET} ${message}`);
}
