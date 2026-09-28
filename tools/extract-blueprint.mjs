import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IMG_DIR = path.resolve(ROOT, '../Astra_Roadster');
const OUT_DIR = path.join(ROOT, 'tools/out');
export const N = 121;
export const TEMPLATE_N = 33;
export const LENGTH = 4.0;

export const loadPng = (file) => PNG.sync.read(fs.readFileSync(file));

export function isPaint(r, g, b) {
  const d = r - Math.max(g, b);
  return r > 70 && d > 45 && d > 0.35 * r;
}

export function paintMask(png) {
  const { width: w, height: h, data } = png;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = isPaint(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0;
  return { w, h, mask };
}

export function dilate({ w, h, mask }, r) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && X < w && Y >= 0 && Y < h) out[Y * w + X] = 1;
    }
  }
  return { w, h, mask: out };
}

// 共通のラベリング（フラッドフィル）。label[i] は連結成分ID（0=背景）、sizes[id] はその成分の画素数
export function labelComponents({ w, h, mask }) {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let cur = 0;
  const sizes = [0];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i]) continue;
    cur++;
    let sp = 0, size = 0;
    stack[sp++] = i; label[i] = cur;
    while (sp) {
      const p = stack[--sp]; size++;
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && mask[q] && !label[q]) { label[q] = cur; stack[sp++] = q; }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

export function largestComponent({ w, h, mask }) {
  const { label, sizes } = labelComponents({ w, h, mask });
  let best = 0, bestSize = 0;
  for (let id = 1; id < sizes.length; id++) if (sizes[id] > bestSize) { bestSize = sizes[id]; best = id; }
  const out = new Uint8Array(w * h);
  if (best === 0) return { w, h, mask: out }; // 成分なし: 全ゼロ（label 0 = 背景を「最大成分」と誤認しない）
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 1 : 0;
  return { w, h, mask: out };
}

// 最大成分だけでなく、その ratio 倍以上の大きさを持つ成分もすべて残す
// （フロントフードとキャビン+テールが窓枠等で分断され、別々の大きな連結成分になる場合の救済）
export function mergeLargeComponents({ w, h, mask }, ratio = 0.2) {
  const { label, sizes } = labelComponents({ w, h, mask });
  let bestSize = 0;
  for (let id = 1; id < sizes.length; id++) if (sizes[id] > bestSize) bestSize = sizes[id];
  const keep = new Set();
  for (let id = 1; id < sizes.length; id++) if (sizes[id] >= ratio * bestSize) keep.add(id);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = keep.has(label[i]) ? 1 : 0;
  return { w, h, mask: out };
}

export function bbox({ w, h, mask }) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1 };
}

export function smooth(arr, win = 2) {
  return arr.map((_, i) => {
    let s = 0, n = 0;
    for (let k = i - win; k <= i + win; k++) if (k >= 0 && k < arr.length) { s += arr[k]; n++; }
    return s / n;
  });
}

// 両端で奇関数反射（端点まわりの点対称）をして移動平均をとる。端点の値と端の傾きを保つので、
// 窓が縮む通常の smooth と違い、ノーズ/テール端の形を引きずらない。
export function smoothKeepEnds(arr, win) {
  const n = arr.length;
  if (n < 2) return [...arr];
  const at = (k) => {
    if (k < 0) return 2 * arr[0] - arr[Math.min(n - 1, -k)];
    if (k >= n) return 2 * arr[n - 1] - arr[Math.max(0, 2 * (n - 1) - k)];
    return arr[k];
  };
  return arr.map((_, i) => {
    let t = 0;
    for (let k = i - win; k <= i + win; k++) t += at(k);
    return t / (2 * win + 1);
  });
}

// 画素量子化の波打ちを消す強い平滑化: 従来の軽い平滑化(win=2)のあと、端点保持の移動平均(win=4)を2回。
export const smoothStrong = (arr) => smoothKeepEnds(smoothKeepEnds(smooth(arr), 4), 4);

// mask[i] が真の連続区間ごとに、区間内だけで smoothStrong をかける（区間の端点の値は変わらない）。
// mask が偽の要素は軽い平滑化(win=2)の値を返す（ホイールアーチを丸めないため）。
export function smoothOutside(arr, mask) {
  const out = smooth(arr);
  let i = 0;
  while (i < arr.length) {
    if (!mask[i]) { i++; continue; }
    let j = i; while (j + 1 < arr.length && mask[j + 1]) j++;
    const seg = smoothStrong(arr.slice(i, j + 1));
    for (let k = i; k <= j; k++) out[k] = seg[k - i];
    i = j + 1;
  }
  return out;
}

// 2階差分（曲率）の符号反転回数。画素量子化による細かな波打ちがあると多数反転する。
// |2階差分| < tol は直線とみなす（blueprint は小数4桁に丸めて保存されるため、その丸め誤差 ~2e-4 を無視する）。
export function curvatureSignFlips(a, { i0 = 8, i1 = a.length - 9, tol = 3e-4 } = {}) {
  let flips = 0, prev = 0;
  for (let i = i0; i <= i1; i++) {
    const d = a[i + 1] - 2 * a[i] + a[i - 1];
    const sgn = Math.abs(d) < tol ? 0 : Math.sign(d);
    if (sgn && prev && sgn !== prev) flips++;
    if (sgn) prev = sgn;
  }
  return flips;
}

// 配列の「先頭と末尾の非ゼロ要素の間」にある内側の0を、両側の最近傍の非ゼロ値で線形補間して埋める
// （先頭より前・末尾より後ろの0はそのまま残す）
export function fillGaps(arr) {
  const out = [...arr];
  const idxs = [];
  for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) idxs.push(i);
  if (idxs.length === 0) return out;
  const first = idxs[0], last = idxs[idxs.length - 1];
  let i = first;
  while (i < last) {
    if (out[i + 1] === 0) {
      let j = i + 1;
      while (out[j] === 0) j++;
      const a = out[i], b = out[j];
      for (let k = i + 1; k < j; k++) out[k] = a + (b - a) * (k - i) / (j - i);
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

const carMask = (file, { merge = false } = {}) => {
  const dilated = dilate(paintMask(loadPng(path.join(IMG_DIR, file))), 2);
  return merge ? mergeLargeComponents(dilated) : largestComponent(dilated);
};

// 横画像: 前が左。各列（±2px）で上端と下端の行を求める
export function sideProfile(m) {
  const b = bbox(m);
  const top = [], bottom = [];
  for (let i = 0; i < N; i++) {
    const xa = Math.round(b.x0 + (b.x1 - b.x0) * i / (N - 1));
    let t = Infinity, bt = -Infinity;
    for (let dx = -2; dx <= 2; dx++) {
      const x = Math.min(b.x1, Math.max(b.x0, xa + dx));
      for (let y = b.y0; y <= b.y1; y++) if (m.mask[y * m.w + x]) { t = Math.min(t, y); break; }
      for (let y = b.y1; y >= b.y0; y--) if (m.mask[y * m.w + x]) { bt = Math.max(bt, y); break; }
    }
    top.push(t); bottom.push(bt);
  }
  return { bbox: b, top, bottom };
}

// 下端が基準線より持ち上がる連続区間 = ホイールアーチ（長い順に2つ、u順に並べる）
export function findArches(bottom, lengthPx) {
  const sorted = [...bottom].sort((a, b) => b - a);
  const baseline = sorted[Math.floor(sorted.length * 0.15)];
  const isArch = bottom.map((v) => baseline - v > 0.04 * lengthPx);
  const runs = [];
  for (let i = 0; i < N; i++) {
    if (!isArch[i]) continue;
    let j = i; while (j + 1 < N && isArch[j + 1]) j++;
    runs.push({ i0: i, i1: j }); i = j;
  }
  return runs.sort((a, b) => (b.i1 - b.i0) - (a.i1 - a.i0)).slice(0, 2).sort((a, b) => a.i0 - b.i0);
}

// 上画像: 前が上。各行の左右端と中心をまたぐ最長の非塗装区間
export function topProfile(m) {
  const b = bbox(m);
  const half = [], hole = [];
  for (let i = 0; i < N; i++) {
    const y = Math.round(b.y0 + (b.y1 - b.y0) * i / (N - 1));
    let l = -1, r = -1;
    for (let x = b.x0; x <= b.x1; x++) if (m.mask[y * m.w + x]) { l = x; break; }
    for (let x = b.x1; x >= b.x0; x--) if (m.mask[y * m.w + x]) { r = x; break; }
    half.push(l < 0 ? 0 : (r - l) / 2);
    let best = 0;
    if (l >= 0) {
      const cx = (l + r) / 2;
      let run = 0, start = 0;
      for (let x = l; x <= r + 1; x++) {
        const paint = x <= r && m.mask[y * m.w + x];
        if (!paint && x <= r) { if (run === 0) start = x; run++; }
        else { if (run > best && start < cx && x > cx) best = run; run = 0; }
      }
    }
    hole.push(l >= 0 && best > 0.25 * (r - l) ? best / 2 : 0);
  }
  // ウィンドシールド～カウル部の行は塗装が一切なく、開口幅を直接測れない
  // （抽出上のギャップ）。開口区間の先頭・末尾の非ゼロ値の間だけを線形補間で埋め、
  // コックピット開口に穴（膜）ができないようにする。
  return { bbox: b, half: fillGaps(half), hole: fillGaps(hole) };
}

// 正面画像: 下端→上端の各行の半幅（最大=1、最小0.35）
export function frontTemplate(m) {
  const b = bbox(m);
  const hs = [];
  for (let k = 0; k < TEMPLATE_N; k++) {
    const y = Math.round(b.y1 - (b.y1 - b.y0) * k / (TEMPLATE_N - 1));
    let l = -1, r = -1;
    for (let x = b.x0; x <= b.x1; x++) if (m.mask[y * m.w + x]) { l = x; break; }
    for (let x = b.x1; x >= b.x0; x--) if (m.mask[y * m.w + x]) { r = x; break; }
    hs.push(l < 0 ? 0 : (r - l) / 2);
  }
  const sm = smooth(hs, 1);
  const max = Math.max(...sm);
  return { bbox: b, template: sm.map((v) => Math.max(0.35, v / max)) };
}

const round = (v) => Math.round(v * 10000) / 10000;

export function extract() {
  const side = sideProfile(carMask('Astra_Roadster横.png'));
  const lengthPx = side.bbox.x1 - side.bbox.x0;
  const s = LENGTH / lengthPx;
  const arches = findArches(side.bottom, lengthPx);
  if (arches.length !== 2) throw new Error(`ホイールアーチを2つ検出できません（${arches.length}）`);

  const wheelsPx = arches.map(({ i0, i1 }) => {
    const archTop = Math.min(...side.bottom.slice(i0, i1 + 1));
    const chordPx = ((i1 - i0 + 1) / (N - 1)) * lengthPx;
    const D = Math.min(0.22, Math.max(0.14, (1.05 * chordPx) / lengthPx)) * lengthPx;
    return { u: (i0 + i1) / 2 / (N - 1), D, archTop };
  });
  const groundRow = wheelsPx.reduce((a, w) => a + w.archTop + 0.06 * w.D + w.D, 0) / 2;

  // 画素量子化による細かな波打ち（曲率の符号反転）がボディ表面の凸凹になるため、上端は強く平滑化する。
  const top = smoothStrong(side.top.map((r) => (groundRow - r) * s));
  // 下端はホイールアーチ区間（±2ステーションの余裕を含む）を従来どおり軽く平滑化し、
  // それ以外の区間だけを区間内で強く平滑化する（アーチの形を丸めない）。
  const archZone = side.bottom.map((_, i) => arches.some(({ i0, i1 }) => i >= i0 - 2 && i <= i1 + 2));
  const bottomOuter = smoothOutside(side.bottom.map((r) => (groundRow - r) * s), archZone.map((a) => !a));
  const bottomCenter = [...bottomOuter];
  for (const { i0, i1 } of arches) {
    const a = bottomOuter[Math.max(0, i0 - 2)], b = bottomOuter[Math.min(N - 1, i1 + 2)];
    for (let i = i0 - 1; i <= i1 + 1; i++) {
      if (i < 0 || i >= N) continue;
      const t = (i - (i0 - 1)) / (i1 - i0 + 2);
      bottomCenter[i] = Math.min(bottomOuter[i], a + (b - a) * t);
    }
  }
  for (let i = 0; i < N; i++) bottomCenter[i] = Math.min(bottomOuter[i], Math.max(0.1, bottomCenter[i]));

  const topView = topProfile(carMask('Astra_Roadster上.png', { merge: true }));
  const ts = LENGTH / (topView.bbox.y1 - topView.bbox.y0);
  const halfWidth = smoothStrong(topView.half.map((v) => v * ts));
  const holeHalfWidth = smooth(topView.hole.map((v) => v * ts), 1).map((v, i) => (topView.hole[i] > 0 ? v : 0));

  const front = frontTemplate(carMask('Astra_Roadster正面.png'));

  const holeIdx = holeHalfWidth.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  const cockpitFloor = holeIdx.reduce((a, i) => a + bottomCenter[i], 0) / Math.max(1, holeIdx.length) + 0.12;

  return {
    length: LENGTH,
    width: round(2 * Math.max(...halfWidth)),
    samples: N,
    top: top.map(round),
    bottomOuter: bottomOuter.map(round),
    bottomCenter: bottomCenter.map(round),
    halfWidth: halfWidth.map(round),
    holeHalfWidth: holeHalfWidth.map(round),
    template: front.template.map(round),
    wheels: wheelsPx.map((w) => ({ u: round(w.u), radius: round((w.D / 2) * s) })),
    cockpitFloor: round(cockpitFloor),
    _debug: { side, topView, front, groundRow },
  };
}

// 元画像にマスク（シアン）と輪郭点（黄）を重ねた確認用画像を出力する
function writeDebug(file, outName, m, points) {
  const png = loadPng(path.join(IMG_DIR, file));
  for (let i = 0; i < m.w * m.h; i++) if (m.mask[i]) { png.data[i * 4 + 1] = Math.min(255, png.data[i * 4 + 1] + 70); png.data[i * 4 + 2] = Math.min(255, png.data[i * 4 + 2] + 70); }
  for (const [x, y] of points) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const X = Math.round(x) + dx, Y = Math.round(y) + dy;
    if (X < 0 || Y < 0 || X >= m.w || Y >= m.h) continue;
    const k = (Y * m.w + X) * 4; png.data[k] = 255; png.data[k + 1] = 230; png.data[k + 2] = 0;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, outName), PNG.sync.write(png));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bp = extract();
  const { side, topView, front, groundRow } = bp._debug;
  delete bp._debug;
  const col = (b, i) => b.x0 + (b.x1 - b.x0) * i / (N - 1);
  const row = (b, i) => b.y0 + (b.y1 - b.y0) * i / (N - 1);
  writeDebug('Astra_Roadster横.png', 'side-debug.png', carMask('Astra_Roadster横.png'), [
    ...side.top.map((y, i) => [col(side.bbox, i), y]),
    ...side.bottom.map((y, i) => [col(side.bbox, i), y]),
    ...Array.from({ length: 60 }, (_, k) => [side.bbox.x0 + (side.bbox.x1 - side.bbox.x0) * k / 59, groundRow]),
  ]);
  writeDebug('Astra_Roadster上.png', 'top-debug.png', carMask('Astra_Roadster上.png', { merge: true }), topView.half.flatMap((h, i) => {
    const y = row(topView.bbox, i), cx = (topView.bbox.x0 + topView.bbox.x1) / 2;
    const pts = [[cx - h, y], [cx + h, y]];
    if (topView.hole[i] > 0) pts.push([cx - topView.hole[i], y], [cx + topView.hole[i], y]);
    return pts;
  }));
  writeDebug('Astra_Roadster正面.png', 'front-debug.png', carMask('Astra_Roadster正面.png'), []);
  const body = `// Generated by tools/extract-blueprint.mjs — do not edit by hand.\nexport const BLUEPRINT = ${JSON.stringify(bp)};\n`;
  fs.writeFileSync(path.join(ROOT, 'src/blueprint.js'), body);
  console.log({ width: bp.width, wheels: bp.wheels, maxTop: Math.max(...bp.top), cockpitFloor: bp.cockpitFloor, holeStations: bp.holeHalfWidth.filter((v) => v > 0).length });
}
