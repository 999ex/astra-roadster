export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function sampleArray(arr, t) {
  const f = clamp(t) * (arr.length - 1);
  const i = Math.min(arr.length - 2, Math.floor(f));
  return lerp(arr[i], arr[i + 1], f - i);
}

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const approach = (cur, target, step) =>
  cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
