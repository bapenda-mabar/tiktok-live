/* 3D Wireframe Head with lip-sync jaw movement */

let scene, camera, renderer, headGroup;
let jawPivot, leftEye, rightEye;
let currentJawAngle = 0;
let targetJawAngle = 0;
let blinkTimer = 0;
let nextBlink = 3000 + Math.random() * 2000;
let isSpeaking = false;

const BLUE = 0x3b4cca;
const ORANGE = 0xff7b00;

function lerp(a, b, t) { return a + (b - a) * t; }

export function initHead(canvasEl) {
  const W = canvasEl.clientWidth;
  const H = canvasEl.clientHeight;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  headGroup = new THREE.Group();
  scene.add(headGroup);

  _buildHead();
  requestAnimationFrame(_animate);
}

function _wireMat(color = BLUE) {
  return new THREE.MeshBasicMaterial({ color, wireframe: true });
}

function _buildHead() {
  // ── Skull ──────────────────────────────────────────────────────
  const skullGeo = new THREE.SphereGeometry(1, 18, 14);
  skullGeo.scale(0.88, 1.12, 0.92);
  headGroup.add(new THREE.Mesh(skullGeo, _wireMat()));

  // ── Jaw (lower face — pivot at top of jaw = hinge point) ───────
  jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.55, 0.12);
  headGroup.add(jawPivot);

  const jawGeo = new THREE.BoxGeometry(0.72, 0.32, 0.68, 4, 2, 4);
  const jaw = new THREE.Mesh(jawGeo, _wireMat());
  jaw.position.y = -0.16; // offset down so pivot is at top edge
  jawPivot.add(jaw);

  // ── Cheekbones (decorative rings) ─────────────────────────────
  [-0.38, 0.38].forEach(x => {
    const geo = new THREE.TorusGeometry(0.28, 0.03, 6, 16);
    const m = new THREE.Mesh(geo, _wireMat());
    m.position.set(x, -0.18, 0.72);
    m.rotation.y = Math.PI / 2;
    headGroup.add(m);
  });

  // ── Eyes ───────────────────────────────────────────────────────
  const eyeMat = new THREE.MeshBasicMaterial({ color: ORANGE, wireframe: true });
  [[-0.32, 0.18], [0.32, 0.18]].forEach(([x, y], i) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(x, y, 0.82);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeMat);
    eyeGroup.add(ball);
    headGroup.add(eyeGroup);
    if (i === 0) leftEye = eyeGroup;
    else rightEye = eyeGroup;
  });

  // ── Glasses frames ─────────────────────────────────────────────
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x7788ff, wireframe: true });
  [[-0.32, 0.18], [0.32, 0.18]].forEach(([x, y]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 6, 20),
      glassMat
    );
    ring.position.set(x, y, 0.83);
    headGroup.add(ring);
  });
  // Bridge
  const bridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.16, 4),
    glassMat
  );
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 0.18, 0.83);
  headGroup.add(bridge);

  // ── Nose (simple wedge) ────────────────────────────────────────
  const noseGeo = new THREE.ConeGeometry(0.07, 0.18, 4);
  const nose = new THREE.Mesh(noseGeo, _wireMat());
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 0.95);
  headGroup.add(nose);

  // ── Neck ───────────────────────────────────────────────────────
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.45, 8),
    _wireMat()
  );
  neck.position.set(0, -1.2, 0);
  headGroup.add(neck);
}

function _animate(now) {
  requestAnimationFrame(_animate);

  const t = now * 0.001;

  // Idle head movement
  headGroup.rotation.y = Math.sin(t * 0.38) * 0.08;
  headGroup.rotation.z = Math.sin(t * 0.21) * 0.03;
  headGroup.position.y = Math.sin(t * 0.5) * 0.04;

  // Blink
  blinkTimer += 16;
  if (blinkTimer > nextBlink) {
    _doBlink();
    blinkTimer = 0;
    nextBlink = 3000 + Math.random() * 2500;
  }

  // Jaw: smooth toward target
  if (!isSpeaking) targetJawAngle = 0;
  currentJawAngle = lerp(currentJawAngle, targetJawAngle, 0.25);
  jawPivot.rotation.x = currentJawAngle;

  renderer.render(scene, camera);
}

function _doBlink() {
  if (!leftEye || !rightEye) return;
  leftEye.scale.y = 0.08;
  rightEye.scale.y = 0.08;
  setTimeout(() => {
    leftEye.scale.y = 1;
    rightEye.scale.y = 1;
  }, 110);
}

/**
 * Called every animation frame while audio is playing.
 * analyser: Web Audio AnalyserNode
 * dataArray: Uint8Array of size analyser.frequencyBinCount
 */
export function updateLipSync(analyser, dataArray) {
  isSpeaking = true;
  analyser.getByteFrequencyData(dataArray);

  // Voice frequency bins 2–14 (roughly 85–600 Hz at 44.1kHz, fftSize 1024)
  let sum = 0;
  const binStart = 2, binEnd = 14;
  for (let i = binStart; i < binEnd; i++) sum += dataArray[i];
  const amplitude = sum / ((binEnd - binStart) * 255);

  // Map to jaw open angle (max ~0.45 rad ≈ 26°)
  targetJawAngle = amplitude * 0.45;
}

export function stopLipSync() {
  isSpeaking = false;
}
