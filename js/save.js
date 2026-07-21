'use strict';

/* Spielstände: Speichern/Laden über localStorage, 3 manuelle Slots + Autosave. */
const SaveGame = (() => {

  const SLOTS = ['1', '2', '3', 'auto'];
  const VERSION = 2;                 // Modell mit Waren/Werkzeug/Trägern/Türmen
  const key = slot => 'ns-save-' + slot;

  /* Serialisierbaren Spielzustand erzeugen (Typed Arrays → normale Arrays).
     Unterwegs befindliche Träger-Waren werden dem Pool gutgeschrieben, damit
     nichts verloren geht (Träger werden nicht mitgespeichert). */
  function snapshot() {
    const st = Game.st;
    const players = st.players.map(p => ({ ...p, res: { ...p.res } }));
    for (const c of st.carriers) {
      if (c.kind === 'goods' && c.payload) {
        for (const [r, n] of Object.entries(c.payload)) players[c.owner].res[r] = (players[c.owner].res[r] || 0) + n;
      }
    }
    // hasCarrier zurücksetzen, damit gepufferte Waren nach dem Laden neu ausgeliefert werden
    const buildings = st.buildings.map(b => ({ ...b, hasCarrier: false, firing: null }));
    return {
      v: VERSION,
      opts: st.opts,
      w: st.w, h: st.h,
      terrain: Array.from(st.terrain),
      trees: Array.from(st.trees),
      time: st.time, nextId: st.nextId, over: st.over,
      players, buildings, units: st.units,
    };
  }

  function meta() {
    const st = Game.st;
    const preset = MapGen.PRESETS.find(m => m.id === st.opts.mapId);
    const min = Math.floor(st.time / 60);
    return {
      date: Date.now(),
      map: preset ? preset.name : st.opts.mapId,
      minutes: min,
      players: st.players.map(p =>
        `${p.name} (${(CFG.TRIBES[p.tribe] || {}).name || '?'})${p.defeated ? ' ✝' : ''}`).join(' · '),
    };
  }

  function save(slot) {
    if (!Game.st) return false;
    try {
      localStorage.setItem(key(slot), JSON.stringify({ meta: meta(), state: snapshot() }));
      return true;
    } catch (e) {
      return false;   // Speicher voll o. Ä.
    }
  }

  function load(slot) {
    try {
      const raw = localStorage.getItem(key(slot));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.state || data.state.v !== VERSION) return { incompatible: true, meta: data.meta };
      return data;
    } catch (e) {
      return null;
    }
  }

  function info(slot) {
    const d = load(slot);
    if (!d || !d.meta) return null;
    return { ...d.meta, incompatible: !!d.incompatible };
  }

  function remove(slot) {
    localStorage.removeItem(key(slot));
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* Autosave-Intervall (Minuten) merken. */
  function getAutosaveMin() {
    const v = parseInt(localStorage.getItem('ns-autosave-min'), 10);
    return [5, 10, 15].includes(v) ? v : 10;
  }

  function setAutosaveMin(min) {
    localStorage.setItem('ns-autosave-min', String(min));
  }

  return { SLOTS, save, load, info, remove, fmtDate, getAutosaveMin, setAutosaveMin };
})();
