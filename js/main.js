'use strict';

/* Einstieg: Spielschleife (feste Logik-Takte, flüssiges Zeichnen) + Autosave. */
const Main = {
  running: false,
  paused: false,
  speed: 1,
  _last: 0,
  _acc: 0,
  _autoT: 0,          // Echtzeit-Sekunden seit letztem Autosave
  STEP: 0.1,          // Logiktakt: 10 Hz

  resetAutosave() { this._autoT = 0; },
};

function autosaveNow(silent) {
  if (!Main.running || !Game.st || Game.st.over) return;
  if (SaveGame.save('auto') && !silent) UI.toast('💾 Automatisch gespeichert');
  Main.resetAutosave();
}

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

    Main._autoT += dtRaw;
    if (Main._autoT >= SaveGame.getAutosaveMin() * 60) autosaveNow(false);
  }
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
  Render.init();
  UI.initSetup();
  UI.initGameUI();
  requestAnimationFrame(loop);

  // iPad/Safari: beim Verlassen oder Wegwischen den Stand sichern
  window.addEventListener('pagehide', () => autosaveNow(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autosaveNow(true);
  });

  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
