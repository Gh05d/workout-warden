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

// Slot pairs are identity: surf is ocean blue, altinha is the Brazilian
// yellow-bg/green-fg pair (the combination reads as the flag).
const ACTIVITY_PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#B3E5FC', fg: '#0277BD'}, // ocean blue — surf
  {bg: '#FFF59D', fg: '#388E3C'}, // Brazil yellow/green — altinha
  {bg: '#B2DFDB', fg: '#00897B'}, // teal
  {bg: '#B2EBF2', fg: '#0097A7'}, // cyan
];

export function activityColor(activityId: number): {bg: string; fg: string} {
  const idx = Math.abs(activityId - 1) % ACTIVITY_PALETTE.length;
  return ACTIVITY_PALETTE[idx];
}

/** Per-channel sRGB mean of `#RRGGBB` colors, as an uppercase `#RRGGBB`.
 * Used for heatmap/strip cells on days with more than one color source. The
 * mix of 3+ sources drifts toward gray — accepted trade-off (see the design
 * spec); swapping this call site for a split-cell treatment is the escape
 * hatch if it reads too muddy in practice. */
export function mixHexColors(hexes: string[]): string {
  if (hexes.length === 0) {
    throw new Error('mixHexColors needs at least one color');
  }
  let r = 0;
  let g = 0;
  let b = 0;
  for (const hex of hexes) {
    const v = parseInt(hex.slice(1), 16);
    // eslint-disable-next-line no-bitwise
    r += (v >> 16) & 0xff;
    // eslint-disable-next-line no-bitwise
    g += (v >> 8) & 0xff;
    // eslint-disable-next-line no-bitwise
    b += v & 0xff;
  }
  const n = hexes.length;
  const toHex = (x: number) =>
    Math.round(x / n)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
