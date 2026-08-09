export const RITUAL_START_HOLD_MS = 700;

export function getRitualStartHoldProgress(
  startedAt: number,
  now: number,
  duration = RITUAL_START_HOLD_MS,
): number {
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, (now - startedAt) / duration));
}
