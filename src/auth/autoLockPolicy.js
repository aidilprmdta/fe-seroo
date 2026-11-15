export const AUTO_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export function shouldAutoLock(lastActivityAt, now, timeoutMs = AUTO_LOCK_TIMEOUT_MS) {
  if (!Number.isFinite(lastActivityAt) || !Number.isFinite(now)) return false;
  return now - lastActivityAt >= timeoutMs;
}
