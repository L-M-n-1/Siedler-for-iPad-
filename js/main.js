'use strict';

/* Einstieg: Spielschleife (feste Logik-Takte, flüssiges Zeichnen). */
const Main = {
  running: false,
  paused: false,
  speed: 1,
  _last: 0,
  _acc: 0,
  STEP: 0.1,          // Logiktakt: 10 Hz
};

function loop(now) {
  const dtRaw = Math.min(0.25, (now - Main._last) / 1000 || 0);
  Main._last = now;

  if (Main.running && !Main.paused) {
    Main._acc += dtRaw * Main.speed;
    let guard = 12;
    while (Main._acc >= Main.STEP && guard-- > 0) {
      Game.update(Main.STEP);
      Main._acc -= Main.STEP;
    }
    Render.draw(dtRaw);
    UI.updateHUD(false);
  }
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
  Render.init();
  UI.initSetup();
  UI.initGameUI();
  requestAnimationFrame(loop);

  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
