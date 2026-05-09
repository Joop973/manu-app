export const palette = {
  royalBlueDeep: '#0A0E1A',
  royalBlue: '#131B35',
  royalBlueAccent: '#2A3D6F',
  imperialGold: '#D4AF37',
  imperialGoldLight: '#F4D878',
  imperialGoldDark: '#8A6D1D',
  marbleWhite: '#F4F1EA',
  marbleWhiteMuted: 'rgba(244,241,234,0.65)',
  successGreen: '#2D8A4E',
  successGreenSoft: 'rgba(45,138,78,0.15)',
  dangerRed: '#C9302C',
  dangerRedSoft: 'rgba(201,48,44,0.15)',
  cardBorder: 'rgba(212,175,55,0.35)',
  overlay: 'rgba(0,0,0,0.55)',
} as const;

export const objectColors = [
  '#D4AF37',
  '#7A4FBF',
  '#C9302C',
  '#2D8A4E',
  '#1F77B4',
  '#E07B0A',
  '#16A8A0',
  '#B83280',
] as const;

export type ObjectColor = (typeof objectColors)[number];
