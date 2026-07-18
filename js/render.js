'use strict';

/* Darstellung: Gelände-Cache, Gebietsfärbung, Gebäude, Einheiten, Minimap. */
const Render = (() => {

  const TS = CFG.TS;
  let canvas, ctx, mini, mctx;
  let terrainC, terrainCtx;      // Gelände (nur schmutzige Kacheln neu zeichnen)
  let terrC, terrCtx;            // Gebietsüberzug
  let cam = { x: 0, y: 0, z: 1 };
  let firstDraw = true;
  let miniTimer = 0;

  const TCOL = {
    [CFG.T.GRASS]: '#4c8a3f',
    [CFG.T.WATER]: '#2b6cb0',
    [CFG.T.MOUNTAIN]: '#8a8578',
    [CFG.T.SAND]: '#c9b877',
  };

  function init() {
    canvas = document.getElementById('world');
    ctx = canvas.getContext('2d');
    mini = document.getElementById('minimap');
    mctx = mini.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._dpr = dpr;
  }

  function startGame() {
    resize();   // #game war beim Init noch unsichtbar (Größe 0)
    const st = Game.st;
    terrainC = document.createElement('canvas');
    terrainC.width = st.w * TS; terrainC.height = st.h * TS;
    terrainCtx = terrainC.getContext('2d');
    terrC = document.createElement('canvas');
    terrC.width = st.w * TS; terrC.height = st.h * TS;
    terrCtx = terrC.getContext('2d');
    firstDraw = true;

    // Kamera auf das eigene Hauptquartier
    const hq = st.buildings.find(b => b.owner === 0 && b.type === 'hq');
    cam.x = (hq.x + 0.5) * TS;
    cam.y = (hq.y + 0.5) * TS;
    cam.z = 1.1;
  }

  /* ------------------------------------------------ Gelände */

  function drawTile(i) {
    const st = Game.st;
    const x = i % st.w, y = (i / st.w) | 0;
    const t = st.terrain[i];
    terrainCtx.fillStyle = TCOL[t];
    terrainCtx.fillRect(x * TS, y * TS, TS, TS);

    // dezente Struktur
    if (t === CFG.T.GRASS) {
      terrainCtx.fillStyle = ((x * 7 + y * 13) % 5 === 0) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
      terrainCtx.fillRect(x * TS, y * TS, TS, TS);
    } else if (t === CFG.T.MOUNTAIN) {
      terrainCtx.fillStyle = '#6f6a5e';
      terrainCtx.beginPath();
      terrainCtx.moveTo(x * TS + 4, y * TS + TS - 5);
      terrainCtx.lineTo(x * TS + TS / 2, y * TS + 5);
      terrainCtx.lineTo(x * TS + TS - 4, y * TS + TS - 5);
      terrainCtx.closePath();
      terrainCtx.fill();
      terrainCtx.fillStyle = '#e8e4da';
      terrainCtx.beginPath();
      terrainCtx.moveTo(x * TS + TS / 2 - 4, y * TS + 11);
      terrainCtx.lineTo(x * TS + TS / 2, y * TS + 5);
      terrainCtx.lineTo(x * TS + TS / 2 + 4, y * TS + 11);
      terrainCtx.closePath();
      terrainCtx.fill();
    } else if (t === CFG.T.WATER) {
      terrainCtx.fillStyle = 'rgba(255,255,255,0.08)';
      terrainCtx.fillRect(x * TS + 4, y * TS + ((x + y) % 3) * 9 + 4, TS - 8, 2);
    }

    // Bäume
    const n = st.trees[i];
    for (let k = 0; k < n; k++) {
      const tx = x * TS + 6 + (k % 2) * 14 + ((x + y + k) % 3) * 2;
      const ty = y * TS + 6 + ((k / 2) | 0) * 13;
      terrainCtx.fillStyle = '#5b4326';
      terrainCtx.fillRect(tx + 3, ty + 10, 3, 5);
      terrainCtx.fillStyle = '#2f6b2a';
      terrainCtx.beginPath();
      terrainCtx.moveTo(tx, ty + 11);
      terrainCtx.lineTo(tx + 4.5, ty);
      terrainCtx.lineTo(tx + 9, ty + 11);
      terrainCtx.closePath();
      terrainCtx.fill();
    }
  }

  function redrawTerritory() {
    const st = Game.st;
    terrCtx.clearRect(0, 0, terrC.width, terrC.height);
    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) {
        const o = st.owner[y * st.w + x];
        if (o < 0) continue;
        terrCtx.fillStyle = CFG.COLORS[o] + '30';
        terrCtx.fillRect(x * TS, y * TS, TS, TS);
        // Grenzlinien
        terrCtx.fillStyle = CFG.COLORS[o] + 'aa';
        const oAt = (xx, yy) => (Game.inB(xx, yy) ? st.owner[yy * st.w + xx] : -1);
        if (oAt(x - 1, y) !== o) terrCtx.fillRect(x * TS, y * TS, 2, TS);
        if (oAt(x + 1, y) !== o) terrCtx.fillRect(x * TS + TS - 2, y * TS, 2, TS);
        if (oAt(x, y - 1) !== o) terrCtx.fillRect(x * TS, y * TS, TS, 2);
        if (oAt(x, y + 1) !== o) terrCtx.fillRect(x * TS, y * TS + TS - 2, TS, 2);
      }
    }
  }

  /* ------------------------------------------------ Hauptzeichnung */

  function draw(dt) {
    const st = Game.st;
    if (!st) return;

    if (firstDraw) {
      for (let i = 0; i < st.w * st.h; i++) drawTile(i);
      st.dirty.clear();
      firstDraw = false;
    } else if (st.dirty.size) {
      for (const i of st.dirty) drawTile(i);
      st.dirty.clear();
    }
    if (st.territoryDirty) {
      st.territoryDirty = false;   // Game hat bereits neu berechnet
      redrawTerritory();
      drawMinimap();
    }

    const W = canvas.clientWidth, H = canvas.clientHeight;
    clampCam(W, H);
    ctx.fillStyle = '#101a24';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrainC, 0, 0);
    ctx.drawImage(terrC, 0, 0);

    drawBuildings();
    drawUnits();
    drawSelection();

    ctx.restore();

    miniTimer -= dt;
    if (miniTimer <= 0) { miniTimer = 0.8; drawMinimap(); }
  }

  function clampCam(W, H) {
    const st = Game.st;
    cam.z = Math.max(0.35, Math.min(2.5, cam.z));
    const hw = W / 2 / cam.z, hh = H / 2 / cam.z;
    cam.x = Math.max(hw - TS * 4, Math.min(st.w * TS - hw + TS * 4, cam.x));
    cam.y = Math.max(hh - TS * 4, Math.min(st.h * TS - hh + TS * 4, cam.y));
  }

  function drawBuildings() {
    const st = Game.st;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of st.buildings) {
      if (!b.alive) continue;
      const def = CFG.BUILDINGS[b.type];
      const px = b.x * TS, py = b.y * TS;
      const big = b.type === 'hq';
      const pad = big ? -6 : 2;

      ctx.fillStyle = CFG.COLORS_DARK[b.owner];
      roundRect(px + pad, py + pad, TS - pad * 2, TS - pad * 2, 5);
      ctx.fill();
      ctx.strokeStyle = CFG.COLORS[b.owner];
      ctx.lineWidth = 2;
      ctx.stroke();

      if (!b.done) {
        // Baustelle: Gerüst + Fortschritt
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(px + pad, py + pad, TS - pad * 2, TS - pad * 2, 5);
        ctx.fill();
        ctx.font = `${big ? 22 : 16}px sans-serif`;
        ctx.fillText('🏗️', px + TS / 2, py + TS / 2);
        ctx.fillStyle = '#222';
        ctx.fillRect(px + 3, py + TS - 6, TS - 6, 4);
        ctx.fillStyle = '#ffd27f';
        ctx.fillRect(px + 3, py + TS - 6, (TS - 6) * b.progress, 4);
      } else {
        ctx.font = `${big ? 26 : 18}px sans-serif`;
        ctx.fillText(def.icon, px + TS / 2, py + TS / 2 + 1);
        if (b.hp < b.maxHp) {
          ctx.fillStyle = '#222';
          ctx.fillRect(px + 3, py - 5, TS - 6, 4);
          ctx.fillStyle = b.hp / b.maxHp > 0.4 ? '#3dbb5a' : '#e04343';
          ctx.fillRect(px + 3, py - 5, (TS - 6) * (b.hp / b.maxHp), 4);
        }
        if (b.done && b.status && b.owner === 0) {
          ctx.font = '11px sans-serif';
          ctx.fillText('💤', px + TS - 6, py + 7);
        }
      }
    }
  }

  function drawUnits() {
    const st = Game.st;
    for (const u of st.units) {
      const px = u.x * TS, py = u.y * TS;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(px, py + 5, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CFG.COLORS[u.owner];
      ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif';
      ctx.fillText('⚔', px, py + 1);
      if (u.hp < u.maxHp) {
        ctx.fillStyle = '#222';
        ctx.fillRect(px - 8, py - 12, 16, 3);
        ctx.fillStyle = '#3dbb5a';
        ctx.fillRect(px - 8, py - 12, 16 * (u.hp / u.maxHp), 3);
      }
    }
  }

  function drawSelection() {
    for (const u of UI.selected) {
      if (u.hp <= 0) continue;
      ctx.strokeStyle = '#ffd27f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(u.x * TS, u.y * TS, 9.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ------------------------------------------------ Minimap */

  function drawMinimap() {
    const st = Game.st;
    if (!st) return;
    const s = mini.width / Math.max(st.w, st.h);
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, mini.width, mini.height);
    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) {
        const i = y * st.w + x;
        mctx.fillStyle = st.trees[i] > 0 ? '#2f6b2a' : TCOL[st.terrain[i]];
        mctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
        const o = st.owner[i];
        if (o >= 0) {
          mctx.fillStyle = CFG.COLORS[o] + '55';
          mctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
        }
      }
    }
    for (const b of st.buildings) {
      if (!b.alive) continue;
      mctx.fillStyle = CFG.COLORS[b.owner];
      mctx.fillRect(b.x * s - 1, b.y * s - 1, s + 2, s + 2);
    }
    // Sichtfenster
    const W = canvas.clientWidth, H = canvas.clientHeight;
    mctx.strokeStyle = '#fff';
    mctx.lineWidth = 1;
    mctx.strokeRect(
      (cam.x - W / 2 / cam.z) / TS * s,
      (cam.y - H / 2 / cam.z) / TS * s,
      W / cam.z / TS * s,
      H / cam.z / TS * s);
  }

  function miniToWorld(mx, my) {
    const st = Game.st;
    const s = mini.width / Math.max(st.w, st.h);
    return { x: mx / s * TS, y: my / s * TS };
  }

  function screenToWorld(sx, sy) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    return {
      x: (sx - W / 2) / cam.z + cam.x,
      y: (sy - H / 2) / cam.z + cam.y,
    };
  }

  return { init, startGame, draw, drawMinimap, screenToWorld, miniToWorld, cam, get canvas() { return canvas; } };
})();
