'use strict';

/* Spielstände: Speichern/Laden über localStorage, 3 manuelle Slots + Autosave. */
const SaveGame = (() => {

  const SLOTS = ['1', '2', '3', 'auto'];
  const key = slot => 'ns-save-' + slot;

  /* Serialisierbaren Spielzustand erzeugen (Typed Arrays → normale Arrays). */
  function snapshot() {
    const st = Game.st;
    return {
      v: 1,
      opts: st.opts,
      w: st.w, h: st.h,
      terrain: Array.from(st.terrain),
      trees: Array.from(st.trees),
      time: st.time, nextId: st.nextId, over: st.over,
      players: st.players,
      buildings: st.buildings,
      units: st.units,
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
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function info(slot) {
    const d = load(slot);
    return d ? d.meta : null;
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
