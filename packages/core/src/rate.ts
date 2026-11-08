export const VELOCIDADES = [0.75, 1, 1.5, 2] as const;

/** Snaps any rate to the nearest supported step; ties go to the lower step. */
export function snapRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  let best: number = VELOCIDADES[0];
  let bestDist = Math.abs(rate - best);
  for (const v of VELOCIDADES) {
    const d = Math.abs(rate - v);
    if (d < bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best;
}

/** Index of the current rate in the steps; unknown rates count as index 1 (x1). */
export function rateIndex(rate: number): number {
  const i = (VELOCIDADES as readonly number[]).indexOf(rate);
  return i < 0 ? 1 : i;
}

/** Moves one step (clamped). */
export function stepRate(rate: number, dir: 1 | -1): number {
  const i = Math.min(VELOCIDADES.length - 1, Math.max(0, rateIndex(rate) + dir));
  return VELOCIDADES[i] ?? 1;
}
