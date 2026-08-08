// Stable per-plan colour palette. Used by the Weeks tab to tag each week
// header with a pill identifying which plan it belongs to.

const PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#FFE0B2', fg: '#E65100'},
  {bg: '#C8E6C9', fg: '#1B5E20'},
  {bg: '#BBDEFB', fg: '#0D47A1'},
  {bg: '#E1BEE7', fg: '#4A148C'},
  {bg: '#FFCDD2', fg: '#B71C1C'},
  {bg: '#D7CCC8', fg: '#3E2723'},
];

export function planColor(planId: number): {bg: string; fg: string} {
  const idx = Math.abs(planId - 1) % PALETTE.length;
  return PALETTE[idx];
}

// Activity palette: deliberately hue-distant from the plan palette above AND
// internally (cyan / pink / teal / deep-purple families), so activities read
// differently from plans in the heatmap and pairwise blends stay tellable.
const ACTIVITY_PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#B2EBF2', fg: '#006064'}, // cyan — surf
  {bg: '#F8BBD0', fg: '#880E4F'}, // pink — altinha
  {bg: '#B2DFDB', fg: '#004D40'}, // teal
  {bg: '#D1C4E9', fg: '#311B92'}, // deep purple
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
