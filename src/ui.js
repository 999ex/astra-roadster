import * as THREE from 'three';

export function findPartName(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData?.partName) return o.userData.partName;
  return null;
}

// タップ判定: 同じ pointerId で、押下点からの移動が threshold px 未満なら「タップ」
export function isTap(down, up, threshold = 8) {
  if (!down || !up || down.id !== up.id) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) < threshold;
}

// Pointer Events 仕様ではタッチ/ペンは pointerup の直後に pointerout/pointerleave が発火する。
// そこで消すとタップで出した部品名が即座に消えるため、マウスのときだけ消す。
export const shouldClearOnLeave = (pointerType) => pointerType === 'mouse';

export function setupUI({ stage, registry, explode, drive, views, applyTheme }) {
  const $ = (id) => document.getElementById(id);
  const btnDrive = $('btn-drive');
  const btnExplode = $('btn-explode');
  const tip = $('tooltip');
  $('part-count').textContent = String(registry.count());

  btnDrive.addEventListener('click', () => {
    const on = drive.toggle();
    btnDrive.textContent = on ? '停止' : '始動';
    btnDrive.classList.toggle('is-active', on);
  });
  btnExplode.addEventListener('click', () => {
    const on = explode.toggle();
    btnExplode.textContent = on ? '組み立て' : 'パーツ分解';
    btnExplode.classList.toggle('is-active', on);
  });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => views.go(b.dataset.view)));
  $('btn-reset').addEventListener('click', () => views.go('reset'));
  document.querySelectorAll('[data-theme-btn]').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.themeBtn)));

  const canvas = stage.renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const meshes = [];
  stage.car.traverse((o) => { if (o.isMesh) meshes.push(o); });

  const highlightCache = new Map();
  const highlightOf = (mat) => {
    if (!highlightCache.has(mat)) {
      const h = mat.clone();
      h.emissive = new THREE.Color(0xc9a45c);
      h.emissiveIntensity = 0.55;
      highlightCache.set(mat, h);
    }
    return highlightCache.get(mat);
  };

  let current = null;
  function setHighlight(name) {
    if (name === current) return;
    if (current) registry.get(current).object3d.traverse((o) => {
      if (o.isMesh && o.userData.baseMat) { o.material = o.userData.baseMat; delete o.userData.baseMat; }
    });
    current = name;
    if (name) registry.get(name).object3d.traverse((o) => {
      if (o.isMesh) { o.userData.baseMat = o.material; o.material = highlightOf(o.material); }
    });
  }

  function pick(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? findPartName(hit.object) : null;
  }

  function showTip(name, x, y) {
    if (!name) { tip.classList.remove('show'); return; }
    tip.textContent = name;
    const tx = Math.min(x + 14, window.innerWidth - tip.offsetWidth - 8);
    const ty = Math.min(y + 14, window.innerHeight - tip.offsetHeight - 8);
    tip.style.transform = `translate(${tx}px, ${ty}px)`;
    tip.classList.add('show');
  }

  let down = null;
  let tipTimer = 0;
  const clearAll = () => { setHighlight(null); showTip(null); };

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(tipTimer);
    if (e.buttons) return; // ドラッグ（視点回転）中はレイキャストしない
    const name = pick(e.clientX, e.clientY);
    setHighlight(name);
    showTip(name, e.clientX, e.clientY);
    canvas.style.cursor = name ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', (e) => { if (shouldClearOnLeave(e.pointerType)) clearAll(); });

  canvas.addEventListener('pointerdown', (e) => { down = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointercancel', (e) => { if (down && down.id === e.pointerId) down = null; });
  canvas.addEventListener('pointerup', (e) => {
    const start = down;
    if (start && start.id === e.pointerId) down = null;
    if (e.pointerType === 'mouse') return;
    if (!isTap(start, { id: e.pointerId, x: e.clientX, y: e.clientY })) return;
    const name = pick(e.clientX, e.clientY);
    setHighlight(name);
    showTip(name, e.clientX, e.clientY);
    clearTimeout(tipTimer);
    tipTimer = setTimeout(clearAll, 2000);
  });
}
