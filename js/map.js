'use strict';

/* Kartengenerierung: gewürfelte Karten aus Vorlagen (Seed-basiert, reproduzierbar). */
const MapGen = (() => {

  const PRESETS = [
    { id: 'ebene',    name: 'Grüne Ebene', size: 64,
      desc: 'Weites Grasland mit lichten Wäldern und wenigen Bergen. Ideal für Einsteiger.',
      water: 0.16, mountain: 0.80, forest: 0.60, octScale: 10 },
    { id: 'seenland', name: 'Seenland', size: 80,
      desc: 'Viele Seen und Fischgründe. Wachtürme sichern die Landbrücken.',
      water: 0.34, mountain: 0.84, forest: 0.56, octScale: 9 },
    { id: 'bergland', name: 'Bergland', size: 80,
      desc: 'Schroffe Gebirgszüge voller Stein und Eisenerz – aber wenig Ackerland.',
      water: 0.12, mountain: 0.62, forest: 0.52, octScale: 8 },
    { id: 'flusstal', name: 'Flusstal', size: 72,
      desc: 'Ein großer Fluss teilt das Land. Wer die Furten hält, kontrolliert die Karte.',
      water: 0.14, mountain: 0.80, forest: 0.55, octScale: 10, river: true },
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Wert-Rauschen: grobes Zufallsgitter, bilinear interpoliert, 2 Oktaven. */
  function makeNoise(rnd, size, scale) {
    const gw = Math.ceil(size / scale) + 2;
    const grid = new Float32Array(gw * gw);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const smooth = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const gx = x / scale, gy = y / scale;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = smooth(gx - x0), fy = smooth(gy - y0);
      const v = (xx, yy) => grid[yy * gw + xx];
      return v(x0, y0) * (1 - fx) * (1 - fy) + v(x0 + 1, y0) * fx * (1 - fy)
           + v(x0, y0 + 1) * (1 - fx) * fy + v(x0 + 1, y0 + 1) * fx * fy;
    };
  }

  const START_SPOTS = [
    [0.18, 0.18], [0.82, 0.82], [0.82, 0.18], [0.18, 0.82],
  ];

  function generate(presetId, seed, nPlayers) {
    const p = PRESETS.find(m => m.id === presetId) || PRESETS[0];
    const rnd = mulberry32(seed);
    const w = p.size, h = p.size;
    const terrain = new Uint8Array(w * h);
    const trees = new Uint8Array(w * h);

    const elev = makeNoise(rnd, w, p.octScale);
    const elev2 = makeNoise(rnd, w, p.octScale / 2.2);
    const moist = makeNoise(rnd, w, p.octScale * 0.9);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const e = elev(x, y) * 0.7 + elev2(x, y) * 0.3;
        if (e < p.water) terrain[i] = CFG.T.WATER;
        else if (e < p.water + 0.035) terrain[i] = CFG.T.SAND;
        else if (e > p.mountain) terrain[i] = CFG.T.MOUNTAIN;
        else {
          terrain[i] = CFG.T.GRASS;
          const m = moist(x, y);
          if (m > p.forest) trees[i] = 1 + Math.min(2, Math.floor((m - p.forest) * 12));
        }
      }
    }

    /* Fluss: geschlängeltes Band von Nord nach Süd mit zwei Furten. */
    if (p.river) {
      const mid = w / 2 + (rnd() - 0.5) * w * 0.2;
      const fords = [Math.floor(h * (0.28 + rnd() * 0.1)), Math.floor(h * (0.62 + rnd() * 0.1))];
      for (let y = 0; y < h; y++) {
        const cx = mid + Math.sin(y * 0.13 + seed % 7) * 6;
        const isFord = fords.some(f => Math.abs(y - f) <= 1);
        for (let x = Math.floor(cx - 2); x <= Math.ceil(cx + 2); x++) {
          if (x < 0 || x >= w) continue;
          const i = y * w + x;
          if (isFord) { if (terrain[i] === CFG.T.WATER) terrain[i] = CFG.T.SAND; terrain[i] = CFG.T.SAND; trees[i] = 0; }
          else { terrain[i] = CFG.T.WATER; trees[i] = 0; }
        }
      }
    }

    /* Startplätze wählen und begehbar machen. */
    const starts = [];
    for (let s = 0; s < nPlayers; s++) {
      const sx = Math.floor(START_SPOTS[s][0] * w);
      const sy = Math.floor(START_SPOTS[s][1] * h);
      clearArea(terrain, trees, w, h, sx, sy, 4);
      starts.push({ x: sx, y: sy });
    }

    /* Alle Startplätze auf Landweg verbinden (Furten/Passagen freischneiden). */
    for (let s = 1; s < starts.length; s++) carvePath(terrain, trees, w, h, starts[0], starts[s]);

    /* Jedem Start Wald und Berg in erreichbarer Nähe garantieren. */
    for (const st of starts) {
      ensureFeature(terrain, trees, w, h, st, rnd, 'trees');
      ensureFeature(terrain, trees, w, h, st, rnd, 'mountain');
    }

    return { w, h, terrain, trees, starts, preset: p };
  }

  function clearArea(terrain, trees, w, h, cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const i = y * w + x;
        terrain[i] = CFG.T.GRASS;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= 4) trees[i] = 0;
      }
    }
  }

  function carvePath(terrain, trees, w, h, a, b) {
    let x = a.x, y = a.y;
    let guard = w * h;
    while ((x !== b.x || y !== b.y) && guard-- > 0) {
      if (Math.abs(b.x - x) > Math.abs(b.y - y)) x += Math.sign(b.x - x);
      else y += Math.sign(b.y - y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const i = ny * w + nx;
          if (terrain[i] === CFG.T.WATER) { terrain[i] = CFG.T.SAND; trees[i] = 0; }
          else if (terrain[i] === CFG.T.MOUNTAIN) { terrain[i] = CFG.T.GRASS; }
        }
      }
    }
  }

  /* Stellt sicher, dass in Startnähe Bäume bzw. ein kleiner Berg vorhanden sind. */
  function ensureFeature(terrain, trees, w, h, st, rnd, kind) {
    const R = kind === 'trees' ? 7 : 10;
    for (let y = st.y - R; y <= st.y + R; y++) {
      for (let x = st.x - R; x <= st.x + R; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (kind === 'trees' && trees[i] > 0) return;
        if (kind === 'mountain' && terrain[i] === CFG.T.MOUNTAIN) return;
      }
    }
    // Nicht gefunden: kleines Feature in Distanz 5–7 anlegen.
    const ang = rnd() * Math.PI * 2;
    const cx = Math.max(2, Math.min(w - 3, st.x + Math.round(Math.cos(ang) * 6)));
    const cy = Math.max(2, Math.min(h - 3, st.y + Math.round(Math.sin(ang) * 6)));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = (cy + dy) * w + (cx + dx);
        if (kind === 'trees') { if (terrain[i] === CFG.T.GRASS) trees[i] = 3; }
        else { terrain[i] = CFG.T.MOUNTAIN; trees[i] = 0; }
      }
    }
  }

  /* Kleine Vorschau auf ein Canvas zeichnen (Setup-Bildschirm). */
  function drawPreview(canvas, map) {
    const ctx = canvas.getContext('2d');
    const s = canvas.width / map.w;
    const cols = { [CFG.T.GRASS]: '#4c8a3f', [CFG.T.WATER]: '#2b6cb0', [CFG.T.MOUNTAIN]: '#8a8578', [CFG.T.SAND]: '#c9b877' };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        ctx.fillStyle = map.trees[i] > 0 ? '#2f6b2a' : cols[map.terrain[i]];
        ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
      }
    }
    map.starts.forEach((st, k) => {
      ctx.fillStyle = CFG.COLORS[k];
      ctx.beginPath();
      ctx.arc((st.x + 0.5) * s, (st.y + 0.5) * s, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  return { PRESETS, generate, drawPreview };
})();
