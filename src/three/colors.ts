// Colors for the 3D scene. three.js cannot read the app's CSS variables (oklch), so these are sRGB equivalents of
// --efficient (blue), --heat (amber) and --loss (red), used for the same cost scale as the 2D twin.

export const SCENE_COLORS = {
  efficient: '#5b85f0',
  heat: '#f0a43c',
  loss: '#e9605a',
  savings: '#3ccf96',
  windowLit: '#ffd68a',
  windowAway: '#7a6a4a',
  windowDark: '#1c2433',
  setbackRing: '#5b85f0',
  glass: '#9fb4d9',
  ground: '#0e1522',
  structure: '#2a3446',
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}
function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Blue (0) → amber (0.5) → red (1), the same scale as the 2D twin's `intensityColor`. */
export function sceneIntensityColor(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  return x < 0.5 ? mix(SCENE_COLORS.efficient, SCENE_COLORS.heat, x * 2) : mix(SCENE_COLORS.heat, SCENE_COLORS.loss, (x - 0.5) * 2);
}
