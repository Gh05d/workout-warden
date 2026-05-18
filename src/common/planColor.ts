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
