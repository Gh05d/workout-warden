// src/common/theme.ts
//
// Single source of truth for app-wide colour tokens. The visual language is
// "Tactical Logbook": dark surfaces, bright orange accents, sharp corners,
// off-white paper. Use these tokens instead of hard-coded hex elsewhere.

export const colors = {
  primary: '#FF9800', // orange — active / progress / highlight
  primaryDeep: '#E68A00', // pressed-state orange
  secondary: '#4CAF50', // green — completion / success

  ink: '#111111', // dark surface backgrounds (cards, tab bar)
  inkSoft: '#1F1F22', // slightly raised dark surface
  paper: '#FFFFFF', // pure white inputs, modal sheets
  cream: '#FAFAF7', // off-white app background
  rule: '#E5E5E5', // hairline borders
  muted: '#666666', // secondary body text
  faint: '#999999', // tertiary text / placeholders
  ghost: '#BBBBBB', // placeholder text in inputs

  warn: '#F57C00',
  warnBg: '#FFF3E0',
  hintAccent: '#FFC080',
};
