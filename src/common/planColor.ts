// Per-plan and per-activity colour palettes. Concept: warm tones for plans
// (gym — the app's orange accent family), cool water/nature tones for
// activities, so the two never look alike in the heatmap or legends. fg stays
// in the vivid 600–800 range: Material-900 fgs shipped once and read as
// near-black at small sizes (rails, bars, pills).

const PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#FFE0B2', fg: '#EF6C00'}, // orange — matches the app accent
  {bg: '#FFCDD2', fg: '#D32F2F'}, // red
  {bg: '#E1BEE7', fg: '#8E24AA'}, // violet
  {bg: '#F8BBD0', fg: '#C2185B'}, // magenta
  {bg: '#D7CCC8', fg: '#6D4C41'}, // bronze
  {bg: '#CFD8DC', fg: '#546E7A'}, // slate
];

export function planColor(planId: number): {bg: string; fg: string} {
  const idx = Math.abs(planId - 1) % PALETTE.length;
  return PALETTE[idx];
}

// Slot pairs are identity: surfing is ocean blue, altinha is all-yellow (a
// green fg shipped once and sat too close to the ocean blue at small sizes;
// the gold fg is ~2:1 on white — same league as the app's #FF9800 accent).
const ACTIVITY_PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#B3E5FC', fg: '#0277BD'}, // ocean blue — surf
  {bg: '#FFF59D', fg: '#F9A825'}, // sun gold on yellow — altinha
  {bg: '#B2DFDB', fg: '#00897B'}, // teal
  {bg: '#B2EBF2', fg: '#0097A7'}, // cyan
];

export function activityColor(activityId: number): {bg: string; fg: string} {
  const idx = Math.abs(activityId - 1) % ACTIVITY_PALETTE.length;
  return ACTIVITY_PALETTE[idx];
}

// Trailing zeros stripped so 50 reads "50%", not "50.0000%".
const pct = (x: number) => `${Number(x.toFixed(4))}%`;

/** A CSS `linear-gradient` painting `colors` as equal-width **hard-edged**
 * diagonal bands, first color at the top-left, last at the bottom-right.
 * Returns null below two colors — one source is a plain `backgroundColor`,
 * which is cheaper than a gradient drawable.
 *
 * This replaced averaging the colors of a multi-source day: the palettes are
 * deliberately warm (plans) vs. cool (activities), and averaging complementary
 * hues lands near gray no matter the color space, so a day with a gym session
 * *and* a surf rendered as an olive-brown that belonged to neither. Bands keep
 * every source's identity.
 *
 * Each color gets two stops at the same pair of offsets, which is what makes
 * the boundary a hard edge instead of a blur. 135deg points the gradient axis
 * at the bottom-right corner, so the bands themselves run bottom-left →
 * top-right, stacked along the top-left → bottom-right diagonal.
 *
 * Consumed via RN 0.85's `experimental_backgroundImage`. Callers must also set
 * a plain `backgroundColor` (the first band) so a cell degrades to one solid
 * color rather than to nothing if that experimental prop ever no-ops. */
export function diagonalBands(colors: string[]): string | null {
  if (colors.length < 2) return null;
  const n = colors.length;
  const stops: string[] = [];
  colors.forEach((color, i) => {
    stops.push(`${color} ${pct((i / n) * 100)}`);
    stops.push(`${color} ${pct(((i + 1) / n) * 100)}`);
  });
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}
