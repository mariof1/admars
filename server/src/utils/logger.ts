const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

function ts(): string {
  return new Date().toISOString();
}

export function logAction(actor: string, action: string, target?: string, detail?: string) {
  const parts = [`${DIM}${ts()}${RESET}`, `${GREEN}▶${RESET}`, `${CYAN}${actor}${RESET}`, action];
  if (target) parts.push(`→ ${YELLOW}${target}${RESET}`);
  if (detail) parts.push(`${DIM}(${detail})${RESET}`);
  console.log(parts.join(' '));
}

export function logError(actor: string, action: string, error: string) {
  console.error(`${DIM}${ts()}${RESET} ${RED}✖${RESET} ${CYAN}${actor}${RESET} ${action} ${RED}FAILED${RESET}: ${error}`);
}

export function logInfo(message: string) {
  console.log(`${DIM}${ts()}${RESET} ${DIM}ℹ${RESET} ${message}`);
}
