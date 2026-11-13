export const FULL_TURN = Math.PI * 2;
export function wrapAngle(angle: number): number {
  return ((((angle + Math.PI) % FULL_TURN) + FULL_TURN) % FULL_TURN) - Math.PI;
}
// Select the equivalent angle nearest the rendered phase, including last↔first.
export function closestPhaseForIndex(
  phase: number,
  index: number,
  count: number,
): number {
  const canonical = (-index * FULL_TURN) / Math.max(1, count);
  return canonical + Math.round((phase - canonical) / FULL_TURN) * FULL_TURN;
}
export function easeInOutCubic(progress: number): number {
  const value = Math.max(0, Math.min(1, progress));
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}
export function frontWeight(angle: number): number {
  return Math.exp(-((wrapAngle(angle) / 0.68) ** 2));
}
