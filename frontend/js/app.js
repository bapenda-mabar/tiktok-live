import { initHead, updateLipSync, stopLipSync } from './head3d.js';
import { drawBars, clearBars } from './visualizer.js';
import { initPanel, updateStatus } from './panel.js';

// ── DOM refs ───────────────────────────────────────────────────────
const threeCanvas = document.getElementById('three-canvas');
const vizCanvas = document.getElementById('viz-canvas');
const bgCanvas = document.getElementById('bg-canvas');
const speakingEl = document.getElementById('speaking-indicator');
const subtitleEl = document.getElementById('subtitle');

// ── Audio context ──────────────────────────────────────────────────
let audioCtx = null;
let analyser = null;
let dataArray = null;
let isSpeaking = false;

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ── WebSocket ──────────────────────────────────────────────────────
const WS_URL = `ws://${location.host}/ws`;
let ws;

function connectWS() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[WS] Connected');
    initPanel(ws);
  };

  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'speak') {
      await playSpeech(msg);
    } else if (msg.type === 'status') {
      updateStatus(msg.connected, msg.username || '');
    } else if (msg.type === 'config_saved') {
      console.log('[Config] Saved');
    }
  };

  ws.onclose = () => {
    console.log('[WS] Closed, retrying in 3s…');
    setTimeout(connectWS, 3000);
  };

  ws.onerror = (err) => console.error('[WS] Error', err);
}

async function playSpeech(msg) {
  ensureAudioCtx();

  subtitleEl.textContent = msg.text || '';

  // Decode base64 MP3
  const binary = atob(msg.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  let buffer;
  try {
    buffer = await audioCtx.decodeAudioData(bytes.buffer);
  } catch (err) {
    console.error('[Audio] Decode error', err);
    ws.send(JSON.stringify({ type: 'done' }));
    return;
  }

  // Build audio graph: source → analyser → destination
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.5;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  isSpeaking = true;
  speakingEl.classList.add('active');

  source.start(0);
  source.onended = () => {
    isSpeaking = false;
    speakingEl.classList.remove('active');
    stopLipSync();
    clearBars(vizCanvas);
    subtitleEl.textContent = '';
    ws.send(JSON.stringify({ type: 'done' }));
    analyser = null;
    dataArray = null;
  };
}

// ── Background particles ───────────────────────────────────────────
const particles = [];
const PARTICLE_COUNT = 120;

function initBg() {
  bgCanvas.width = 1080;
  bgCanvas.height = 1920;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * 1080,
      y: Math.random() * 1920,
      r: 1 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: 0.2 + Math.random() * 0.5,
    });
  }
}

function drawBg() {
  const ctx = bgCanvas.getContext('2d');
  ctx.clearRect(0, 0, 1080, 1920);

  // Dark radial vignette
  const grad = ctx.createRadialGradient(540, 960, 200, 540, 960, 1000);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,5,20,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Particles
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = 1080;
    if (p.x > 1080) p.x = 0;
    if (p.y < 0) p.y = 1920;
    if (p.y > 1920) p.y = 0;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60, 100, 255, ${p.alpha})`;
    ctx.fill();
  }
}

// ── Main loop ──────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);

  drawBg();

  if (isSpeaking && analyser && dataArray) {
    updateLipSync(analyser, dataArray);
    drawBars(analyser, dataArray, vizCanvas);
  }
}

// ── Scale stage to viewport ────────────────────────────────────────
function scaleStage() {
  const stage = document.getElementById('stage');
  const scaleX = window.innerWidth / 1080;
  const scaleY = window.innerHeight / 1920;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (window.innerWidth - 1080 * scale) / 2;
  const offsetY = (window.innerHeight - 1920 * scale) / 2;
  stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

// ── Init ───────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  scaleStage();
  window.addEventListener('resize', scaleStage);

  vizCanvas.width = 900;
  vizCanvas.height = 120;

  initBg();
  initHead(threeCanvas);
  connectWS();
  loop();

  // Unlock AudioContext on first user gesture
  document.addEventListener('click', ensureAudioCtx, { once: true });
  document.addEventListener('keydown', ensureAudioCtx, { once: true });
});
