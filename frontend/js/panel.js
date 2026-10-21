/* Control / simulation panel — toggle with D key */

let ws = null;
let panelOpen = false;

export function initPanel(wsRef) {
  ws = wsRef;

  document.addEventListener('keydown', e => {
    if (e.key === 'd' || e.key === 'D') togglePanel();
  });

  document.getElementById('btn-connect').addEventListener('click', () => {
    const u = document.getElementById('inp-username').value.trim();
    if (u) _send({ type: 'connect', username: u });
  });

  document.getElementById('btn-disconnect').addEventListener('click', () => {
    _send({ type: 'disconnect' });
  });

  document.getElementById('btn-save-config').addEventListener('click', () => {
    _send({
      type: 'config',
      gemini_key: document.getElementById('inp-gemini').value.trim(),
      system_prompt: document.getElementById('inp-prompt').value.trim(),
      host_name: document.getElementById('inp-hostname').value.trim(),
    });
  });

  document.getElementById('btn-sim-comment').addEventListener('click', () => {
    _send({
      type: 'simulate_comment',
      name: document.getElementById('inp-sim-name').value.trim() || 'Tester',
      text: document.getElementById('inp-sim-text').value.trim() || 'halo kak!',
    });
  });

  document.getElementById('btn-sim-gift').addEventListener('click', () => {
    _send({
      type: 'simulate_gift',
      name: document.getElementById('inp-sim-name').value.trim() || 'Tester',
      gift: document.getElementById('inp-sim-gift').value.trim() || 'Rose',
      count: 1,
    });
  });
}

export function updateStatus(connected, username) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  dot.className = connected ? 'connected' : '';
  txt.textContent = connected ? `@${username}` : 'Tidak terhubung';
}

function togglePanel() {
  panelOpen = !panelOpen;
  document.getElementById('panel').classList.toggle('open', panelOpen);
}

function _send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
