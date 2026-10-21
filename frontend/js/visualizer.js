/* Symmetric audio bar visualizer */

const BAR_COUNT = 24; // bars per side (48 total, mirrored)

export function drawBars(analyser, dataArray, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  analyser.getByteFrequencyData(dataArray);

  const barW = Math.floor(W / (BAR_COUNT * 2 + 2));
  const gap = 3;
  const centerX = W / 2;

  for (let i = 0; i < BAR_COUNT; i++) {
    // Use lower frequency bins (voice range) for the bars
    const binIdx = Math.floor((i / BAR_COUNT) * 32);
    const value = dataArray[binIdx] / 255;
    const barH = Math.max(4, value * H * 0.9);

    const x = centerX + (i * (barW + gap));
    const xMirror = centerX - (i * (barW + gap)) - barW;

    const hue = 210 + i * 2; // blue→purple gradient
    const alpha = 0.6 + value * 0.4;
    ctx.fillStyle = `hsla(${hue}, 80%, 65%, ${alpha})`;

    // Right side
    ctx.fillRect(x, H / 2 - barH / 2, barW, barH);
    // Left mirror
    ctx.fillRect(xMirror, H / 2 - barH / 2, barW, barH);
  }
}

export function clearBars(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
