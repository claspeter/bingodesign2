import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import './style.css';

// ─── Constants ───────────────────────────────────────────────────────────────
const DC = new THREE.Vector3(0, 0.8, 0); // drum center world pos
const DR = 1.8;                           // drum radius
const DI = 1.45;                          // drum inner (ball travel boundary)
const BALL_R = 0.17;
const TRAVEL_R = 0.26;
const RACK_R = 0.11;
const TILT = 0.3;                         // drum Z tilt (rad)
const RACK_N = 10;                        // balls per rack row
const RACK_SP = 0.29;                     // rack spacing

const BALL_COLORS = [
  0xe63946, 0xf4722b, 0xf9c74f, 0x43aa8b,
  0x26c6da, 0x4361ee, 0x8338ec, 0xf72585, 0xb0bec5,
];
const cIdx = n => Math.min(8, Math.floor((n - 1) / 10));

// stage = where current ball sits after exiting drum
const STAGE = new THREE.Vector3(0, -1.95, 1.6);

// drum exit in world space (bottom of tilted drum)
const EXIT = new THREE.Vector3(
  DC.x + Math.sin(TILT) * DR,
  DC.y - Math.cos(TILT) * DR - 0.08,
  DC.z
);

// ─── Renderer / Scene / Camera ────────────────────────────────────────────────
const wrap = document.getElementById('canvas-wrap');
const W = () => wrap.clientWidth;
const H = () => wrap.clientHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060612);
scene.fog = new THREE.FogExp2(0x060612, 0.032);

const camera = new THREE.PerspectiveCamera(58, W() / H(), 0.1, 80);
camera.position.set(0, 0.5, 9.5);
camera.lookAt(0, -1.5, 0);

// ─── Post-processing (bloom) ──────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.75, 0.4, 0.62);
composer.addPass(bloom);

// ─── Lighting (three-point) ───────────────────────────────────────────────────
const key = new THREE.DirectionalLight(0xfff4e0, 2.8);
key.position.set(5, 8, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 24;
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
scene.add(key);

const fill = new THREE.DirectionalLight(0x8ab4ff, 0.85);
fill.position.set(-5, 3, 4);
scene.add(fill);

const rim = new THREE.DirectionalLight(0x4422ff, 0.5);
rim.position.set(0, 5, -5);
scene.add(rim);

scene.add(new THREE.AmbientLight(0x111133, 0.75));

// Spotlight on current-ball stage
const spot = new THREE.SpotLight(0xffffff, 2.5, 12, Math.PI / 7, 0.35, 1.5);
spot.position.set(0, 2.5, 5);
spot.target.position.copy(STAGE);
scene.add(spot, spot.target);

// ─── Drum ──────────────────────────────────────────────────────────────────────
// drumTilt: positioned at DC, rotated TILT on Z (keeps tilt constant)
// drumSpin: child, rotates on local Y (spins cage around tilted axis)
// drumBalls InstancedMesh: sibling of drumSpin (balls don't spin with cage)
const drumTilt = new THREE.Group();
drumTilt.position.copy(DC);
drumTilt.rotation.z = TILT;
scene.add(drumTilt);

const drumSpin = new THREE.Group();
drumTilt.add(drumSpin);

// Shared metal material for rings
const ringMat = new THREE.MeshStandardMaterial({ color: 0x8899bb, metalness: 0.9, roughness: 0.2 });

// Equatorial + polar decorative rings
const ringGeo = new THREE.TorusGeometry(DR, 0.042, 8, 64);
const eq = new THREE.Mesh(ringGeo, ringMat);
eq.rotation.x = Math.PI / 2;
drumSpin.add(eq);

const pol = new THREE.Mesh(ringGeo, ringMat);
pol.rotation.y = Math.PI / 2;
drumSpin.add(pol);

// Axle caps at poles
const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
const capMat = new THREE.MeshStandardMaterial({ color: 0xaabbcc, metalness: 0.95, roughness: 0.15 });
[-1, 1].forEach(s => {
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = s * DR;
  drumSpin.add(cap);
});

// Cage wireframe (IcosahedronGeometry subdivided)
const cageGeo = new THREE.IcosahedronGeometry(DR, 2);
const cage = new THREE.LineSegments(
  new THREE.EdgesGeometry(cageGeo),
  new THREE.LineBasicMaterial({ color: 0x6688dd, opacity: 0.42, transparent: true })
);
drumSpin.add(cage);

// Glass sphere (MeshPhysicalMaterial transmission)
const glass = new THREE.Mesh(
  new THREE.SphereGeometry(DR, 32, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xaaccff,
    transmission: 0.93,
    thickness: 0.3,
    roughness: 0,
    metalness: 0,
    opacity: 0.07,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
drumSpin.add(glass);

// Drum shaft (tilted, connects to pedestal)
const shaft = new THREE.Mesh(
  new THREE.CylinderGeometry(0.09, 0.09, 0.55, 12),
  new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.9, roughness: 0.2 })
);
shaft.position.y = -DR - 0.28;
drumTilt.add(shaft);

// ─── Balls — InstancedMesh (in drumTilt local space, balls won't spin) ─────────
const ballGeo = new THREE.SphereGeometry(BALL_R, 14, 14);
const ballMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.12 });
const iBalls = new THREE.InstancedMesh(ballGeo, ballMat, 90);
drumTilt.add(iBalls);

const dummy = new THREE.Object3D();
const col3 = new THREE.Color();
for (let i = 0; i < 90; i++) {
  col3.setHex(BALL_COLORS[cIdx(i + 1)]);
  iBalls.setColorAt(i, col3);
}
iBalls.instanceColor.needsUpdate = true;

const ZERO_MTX = new THREE.Matrix4().makeScale(0, 0, 0);

// GSAP-animated ball positions (local to drumTilt)
function randSphere(r) {
  let v;
  do { v = new THREE.Vector3((Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2); }
  while (v.length() > 1);
  return v.multiplyScalar(r);
}

const bData = Array.from({ length: 90 }, () => {
  const p = randSphere(DI * 0.85);
  return { pos: { x: p.x, y: p.y, z: p.z }, active: true };
});

function tumble(i) {
  if (!bData[i].active) return;
  const p = randSphere(DI * 0.88);
  gsap.to(bData[i].pos, {
    x: p.x, y: p.y, z: p.z,
    duration: 1.0 + Math.random() * 2.2,
    ease: 'sine.inOut',
    onComplete: () => tumble(i),
  });
}
bData.forEach((_, i) => setTimeout(() => tumble(i), Math.random() * 2800));

// ─── Pedestal ─────────────────────────────────────────────────────────────────
const metalMat = new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.88, roughness: 0.22 });
const PT = DC.y - DR - 0.48; // pedestal top Y (world)
const PB = PT - 1.85;        // pedestal base Y (world)

// Top collar (mount under drum)
const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.2, 16), metalMat);
collar.position.set(0, PT, 0);
collar.castShadow = true;
scene.add(collar);

// Main pole
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.7, 12), metalMat);
pole.position.set(0, PT - 0.85, 0);
pole.castShadow = true;
scene.add(pole);

// Base plate
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.0, 0.1, 24), metalMat);
base.position.set(0, PB, 0);
base.castShadow = true;
base.receiveShadow = true;
scene.add(base);

// Three small feet
for (let i = 0; i < 3; i++) {
  const ang = (i / 3) * Math.PI * 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.055, 8), metalMat);
  foot.position.set(Math.cos(ang) * 0.72, PB - 0.07, Math.sin(ang) * 0.72);
  scene.add(foot);
}

// Floor (receives shadows)
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(9, 40),
  new THREE.MeshStandardMaterial({ color: 0x070714, roughness: 0.95, metalness: 0.04 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = PB - 0.12;
floor.receiveShadow = true;
scene.add(floor);

// ─── Track / Chute ─────────────────────────────────────────────────────────────
const trackCurve = new THREE.CatmullRomCurve3([
  EXIT.clone(),
  new THREE.Vector3(EXIT.x + 0.1, EXIT.y - 0.38, 0.4),
  new THREE.Vector3(0.3, PT - 0.3, 0.85),
  new THREE.Vector3(0.1, -1.6, 1.25),
  STAGE.clone(),
]);

// Translucent glass tube
scene.add(new THREE.Mesh(
  new THREE.TubeGeometry(trackCurve, 36, 0.095, 8, false),
  new THREE.MeshStandardMaterial({
    color: 0x99aacc, metalness: 0.6, roughness: 0.35,
    transparent: true, opacity: 0.32,
  })
));

// Chute exit ring
const exitRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.115, 0.022, 6, 24),
  new THREE.MeshStandardMaterial({ color: 0xaabbcc, metalness: 0.9, roughness: 0.2 })
);
exitRing.position.copy(EXIT);
scene.add(exitRing);

// ─── Rack frame ────────────────────────────────────────────────────────────────
const RACK_Y0 = PB - 0.28;
const RACK_X0 = -((RACK_N - 1) * RACK_SP) / 2;
const rackBarMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8, roughness: 0.3 });
const rackBarW = RACK_N * RACK_SP + 0.05;

for (let row = 0; row < 9; row++) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(rackBarW, 0.028, 0.028), rackBarMat);
  bar.position.set(0, RACK_Y0 - row * RACK_SP - RACK_SP, -0.055);
  scene.add(bar);
}
// Side rails
[-1, 1].forEach(s => {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 9 * RACK_SP + 0.1, 0.028), rackBarMat);
  rail.position.set(s * (rackBarW / 2 + 0.015), RACK_Y0 - 4.5 * RACK_SP, -0.055);
  scene.add(rail);
});

function getRackPos(idx) {
  return new THREE.Vector3(
    RACK_X0 + (idx % RACK_N) * RACK_SP,
    RACK_Y0 - Math.floor(idx / RACK_N) * RACK_SP,
    0
  );
}

// ─── Canvas textures for individual drawn balls ────────────────────────────────
function makeTex(num) {
  const C = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = C;
  const ctx = cv.getContext('2d');
  const ci = cIdx(num);
  const hex = BALL_COLORS[ci];
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;

  // Gradient background
  const gr = ctx.createRadialGradient(90, 86, 10, 128, 128, 110);
  gr.addColorStop(0, `rgb(${Math.min(r+85,255)},${Math.min(g+85,255)},${Math.min(b+85,255)})`);
  gr.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.fill();

  // Specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(100, 95, 35, 22, -0.4, 0, Math.PI * 2); ctx.fill();

  // White number stripe
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.ellipse(128, 128, 50, 36, 0, 0, Math.PI * 2); ctx.fill();

  // Number text
  ctx.fillStyle = '#111';
  ctx.font = `bold ${num >= 10 ? 48 : 56}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 128, 128);

  return new THREE.CanvasTexture(cv);
}

// ─── HTML board ────────────────────────────────────────────────────────────────
const DECADES = [
  [1,2,3,4,5,6,7,8,9],
  [10,11,12,13,14,15,16,17,18,19],
  [20,21,22,23,24,25,26,27,28,29],
  [30,31,32,33,34,35,36,37,38,39],
  [40,41,42,43,44,45,46,47,48,49],
  [50,51,52,53,54,55,56,57,58,59],
  [60,61,62,63,64,65,66,67,68,69],
  [70,71,72,73,74,75,76,77,78,79],
  [80,81,82,83,84,85,86,87,88,89,90],
];

(function buildBoard() {
  const board = document.getElementById('bingo-board');
  DECADES.forEach((nums, ci) => {
    const colEl = document.createElement('div');
    colEl.className = 'decade-col';
    const hexStr = BALL_COLORS[ci].toString(16).padStart(6, '0');
    nums.forEach(n => {
      const cell = document.createElement('div');
      cell.className = 'ball-cell';
      cell.textContent = n;
      cell.id = `bc${n}`;
      cell.style.setProperty('--bc', `#${hexStr}`);
      colEl.appendChild(cell);
    });
    board.appendChild(colEl);
  });
})();

function markBoard(num) {
  const cell = document.getElementById(`bc${num}`);
  if (!cell) return;
  document.querySelectorAll('.ball-cell.latest').forEach(c => c.classList.remove('latest'));
  cell.classList.add('called', 'latest');
}

function updateHUDBall(num) {
  const ci = cIdx(num);
  const hex = BALL_COLORS[ci];
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const light = `rgb(${Math.min(r+80,255)},${Math.min(g+80,255)},${Math.min(b+80,255)})`;

  const inner = document.getElementById('current-ball-inner');
  inner.style.setProperty('--ball-color', `rgb(${r},${g},${b})`);
  inner.style.setProperty('--ball-light', light);
  inner.style.setProperty('--ball-glow', `rgba(${r},${g},${b},0.55)`);
  document.getElementById('current-num').textContent = num;
  document.getElementById('current-label').textContent = 'Current Ball';
  gsap.fromTo(inner, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' });
}

// ─── State ────────────────────────────────────────────────────────────────────
const available = Array.from({ length: 90 }, (_, i) => i + 1);
const drawn = new Set();
const drawnMeshes = [];
let drawCount = 0;
let isDrawing = false;
let currentMesh = null;
let autoTimer = null;
let autoInterval = 5000;

// ─── Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  if (isDrawing || available.length === 0) return;
  isDrawing = true;

  const ri = Math.floor(Math.random() * available.length);
  const num = available.splice(ri, 1)[0];
  const idx = num - 1;

  // Stop this ball tumbling and hide from InstancedMesh
  bData[idx].active = false;
  gsap.killTweensOf(bData[idx].pos);
  drawn.add(idx);

  // Individual ball mesh with texture
  const ci = cIdx(num);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(TRAVEL_R, 22, 22),
    new THREE.MeshStandardMaterial({
      map: makeTex(num),
      emissive: new THREE.Color(BALL_COLORS[ci]),
      emissiveIntensity: 0.2,
      roughness: 0.28,
      metalness: 0.1,
    })
  );
  mesh.position.copy(EXIT);
  scene.add(mesh);
  drawnMeshes.push(mesh);

  // Move previous current ball to its rack slot
  if (currentMesh) {
    const prev = currentMesh;
    const rackPos = getRackPos(drawCount - 1);
    const s = RACK_R / TRAVEL_R;
    gsap.to(prev.scale, { x: s, y: s, z: s, duration: 0.38 });
    gsap.to(prev.position, {
      x: rackPos.x, y: rackPos.y, z: rackPos.z,
      duration: 0.6, ease: 'power2.inOut',
      onComplete: () => { prev.material.emissiveIntensity = 0.08; },
    });
    currentMesh = null;
  }

  // Animate new ball along track curve
  const prog = { t: 0 };
  gsap.to(prog, {
    t: 1, duration: 1.9, ease: 'power2.inOut',
    onUpdate() {
      mesh.position.copy(trackCurve.getPoint(prog.t));
      mesh.rotation.x += 0.045;
      mesh.rotation.z += 0.03;
    },
    onComplete() {
      mesh.position.copy(STAGE);
      gsap.to(mesh.scale, { x: 2.3, y: 2.3, z: 2.3, duration: 0.42, ease: 'back.out(2.2)' });
      mesh.material.emissiveIntensity = 0.55;

      currentMesh = mesh;
      drawCount++;

      updateHUDBall(num);
      markBoard(num);
      document.getElementById('count').textContent = drawCount;
      document.getElementById('progress-bar').style.width = `${(drawCount / 90) * 100}%`;

      if (available.length === 0) {
        document.getElementById('current-label').textContent = 'All 90 drawn!';
        document.getElementById('draw-btn').disabled = true;
        stopAuto();
      }

      isDrawing = false;
    },
  });
}

// ─── Auto-draw ────────────────────────────────────────────────────────────────
function startAuto() {
  stopAuto();
  autoTimer = setInterval(draw, autoInterval);
}
function stopAuto() {
  clearInterval(autoTimer);
  autoTimer = null;
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function reset() {
  stopAuto();
  isDrawing = false;
  drawCount = 0;
  currentMesh = null;
  drawn.clear();
  available.length = 0;
  for (let i = 1; i <= 90; i++) available.push(i);

  drawnMeshes.forEach(m => scene.remove(m));
  drawnMeshes.length = 0;

  bData.forEach((b, i) => {
    b.active = true;
    gsap.killTweensOf(b.pos);
    const p = randSphere(DI * 0.82);
    b.pos.x = p.x; b.pos.y = p.y; b.pos.z = p.z;
    setTimeout(() => tumble(i), Math.random() * 2400);
  });

  document.getElementById('count').textContent = '0';
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('current-num').textContent = '–';
  document.getElementById('current-label').textContent = 'Waiting...';
  document.getElementById('draw-btn').disabled = false;
  document.getElementById('auto-toggle').checked = false;

  const inner = document.getElementById('current-ball-inner');
  inner.style.setProperty('--ball-color', '#4361ee');
  inner.style.setProperty('--ball-light', '#6680ff');
  inner.style.setProperty('--ball-glow', 'rgba(67,97,238,0.5)');
  document.getElementById('current-num').textContent = '–';

  document.querySelectorAll('.ball-cell.called,.ball-cell.latest')
    .forEach(c => c.classList.remove('called', 'latest'));
}

// ─── UI Events ────────────────────────────────────────────────────────────────
document.getElementById('draw-btn').addEventListener('click', draw);
document.getElementById('reset-btn').addEventListener('click', reset);

document.getElementById('auto-toggle').addEventListener('change', e => {
  if (e.target.checked) startAuto(); else stopAuto();
});

document.getElementById('speed-slider').addEventListener('input', e => {
  autoInterval = +e.target.value * 1000;
  document.getElementById('speed-label').textContent = `${e.target.value}s`;
  if (autoTimer) { stopAuto(); startAuto(); }
});

// ─── Resize ───────────────────────────────────────────────────────────────────
function onResize() {
  const w = W(), h = H();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

// ─── Animation loop ────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  // Drum cage spin (around tilted local Y axis)
  drumSpin.rotation.y += dt * 0.44;

  // Very subtle drum bob
  drumTilt.position.y = DC.y + Math.sin(t * 0.55) * 0.013;

  // Update InstancedMesh ball positions
  for (let i = 0; i < 90; i++) {
    if (drawn.has(i)) {
      iBalls.setMatrixAt(i, ZERO_MTX);
    } else {
      const b = bData[i];
      dummy.position.set(b.pos.x, b.pos.y, b.pos.z);
      dummy.rotation.set(t * 0.5 + i * 0.7, t * 0.3 + i * 0.4, t * 0.4 + i * 0.6);
      dummy.updateMatrix();
      iBalls.setMatrixAt(i, dummy.matrix);
    }
  }
  iBalls.instanceMatrix.needsUpdate = true;

  // Subtle camera sway
  camera.position.x = Math.sin(t * 0.1) * 0.12;
  camera.position.y = 0.5 + Math.sin(t * 0.08) * 0.07;

  // Current ball pulse glow
  if (currentMesh) {
    currentMesh.material.emissiveIntensity = 0.45 + Math.sin(t * 2.8) * 0.12;
  }

  composer.render();
}

animate();
