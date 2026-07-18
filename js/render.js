'use strict';

/* Darstellung in 2.5D: schattiertes Gelände, prozedurale Gebäude-Sprites im
   Volksstil (mit Dächern, Schatten, Y-Sortierung), Soldatenfiguren, Minimap. */
const Render = (() => {

  const TS = CFG.TS;
  const SS = 2;                  // Supersampling der Sprites (für scharfes Zoomen)
  let canvas, ctx, mini, mctx;
  let terrainC, terrainCtx;      // Gelände-Cache (nur schmutzige Kacheln neu)
  let terrC, terrCtx;            // Gebietsüberzug
  let cam = { x: 0, y: 0, z: 1 };
  let firstDraw = true;
  let miniTimer = 0;
  const sprites = new Map();     // Gebäude-Sprites je (Typ, Volk)
  const unitSprites = new Map(); // Soldaten-Sprites je Spieler

  const TCOL = {
    [CFG.T.GRASS]: '#4c8a3f',
    [CFG.T.WATER]: '#2b6cb0',
    [CFG.T.MOUNTAIN]: '#7d7767',
    [CFG.T.SAND]: '#c9b877',
  };

  /* Farbe aufhellen/abdunkeln (f > 1 heller, f < 1 dunkler). */
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }

  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

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

    const hq = st.buildings.find(b => b.owner === 0 && b.type === 'hq');
    cam.x = (hq.x + 0.5) * TS;
    cam.y = (hq.y + 0.5) * TS;
    cam.z = 1.1;
  }

  /* ==================================================== Gelände */

  function terrainAt(x, y) {
    const st = Game.st;
    if (x < 0 || y < 0 || x >= st.w || y >= st.h) return -1;
    return st.terrain[y * st.w + x];
  }

  /* Kachelfüllung, deren Ecken abgerundet sind, wo das Nachbar-Gelände anders
     ist – lässt Wasser- und Bergränder organisch statt klotzig wirken. */
  function blob(g, px, py, r, round) {
    const x1 = px + TS, y1 = py + TS;
    g.beginPath();
    g.moveTo(px + (round.tl ? r : 0), py);
    g.lineTo(x1 - (round.tr ? r : 0), py);
    if (round.tr) g.quadraticCurveTo(x1, py, x1, py + r);
    g.lineTo(x1, y1 - (round.br ? r : 0));
    if (round.br) g.quadraticCurveTo(x1, y1, x1 - r, y1);
    g.lineTo(px + (round.bl ? r : 0), y1);
    if (round.bl) g.quadraticCurveTo(px, y1, px, y1 - r);
    g.lineTo(px, py + (round.tl ? r : 0));
    if (round.tl) g.quadraticCurveTo(px, py, px + r, py);
    g.closePath();
    g.fill();
  }

  /* Helle Linie entlang der Ufer-Kanten (nur wo Nachbar kein Wasser ist). */
  function blobStroke(g, px, py, r, rc, x, y, isSame) {
    g.beginPath();
    if (!isSame(terrainAt(x - 1, y))) { g.moveTo(px + 1, py + (rc.tl ? r : 0)); g.lineTo(px + 1, py + TS - (rc.bl ? r : 0)); }
    if (!isSame(terrainAt(x + 1, y))) { g.moveTo(px + TS - 1, py + (rc.tr ? r : 0)); g.lineTo(px + TS - 1, py + TS - (rc.br ? r : 0)); }
    if (!isSame(terrainAt(x, y - 1))) { g.moveTo(px + (rc.tl ? r : 0), py + 1); g.lineTo(px + TS - (rc.tr ? r : 0), py + 1); }
    if (!isSame(terrainAt(x, y + 1))) { g.moveTo(px + (rc.bl ? r : 0), py + TS - 1); g.lineTo(px + TS - (rc.br ? r : 0), py + TS - 1); }
    g.stroke();
  }

  function corners(x, y, isSame) {
    const L = isSame(terrainAt(x - 1, y)), R = isSame(terrainAt(x + 1, y));
    const T = isSame(terrainAt(x, y - 1)), B = isSame(terrainAt(x, y + 1));
    return { tl: !L && !T, tr: !R && !T, bl: !L && !B, br: !R && !B };
  }

  function grassTone(h) { return ['#4c8a3f', '#4a873c', '#4e8c41'][h % 3]; }

  function drawTile(i) {
    const st = Game.st;
    const x = i % st.w, y = (i / st.w) | 0;
    const t = st.terrain[i];
    const px = x * TS, py = y * TS;
    const h = hash(x, y);
    const g = terrainCtx;

    if (t === CFG.T.GRASS) {
      g.fillStyle = grassTone(h);
      g.fillRect(px, py, TS, TS);
      // Grasbüschel
      g.fillStyle = 'rgba(255,255,255,0.045)';
      g.fillRect(px + (h % 5) * 5 + 2, py + ((h >> 3) % 5) * 5 + 2, 3, 2);
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(px + ((h >> 5) % 5) * 5 + 4, py + ((h >> 7) % 5) * 5 + 6, 3, 2);
      // Bergschatten von Norden
      if (terrainAt(x, y - 1) === CFG.T.MOUNTAIN) {
        g.fillStyle = 'rgba(0,0,0,0.15)';
        g.fillRect(px, py, TS, 5);
      }
    } else if (t === CFG.T.WATER) {
      // Untergrund Strand, Wasser mit runden Uferecken darüber
      g.fillStyle = '#c9b877';
      g.fillRect(px, py, TS, TS);
      const isW = n => n === CFG.T.WATER || n === -1;
      const rc = corners(x, y, isW);
      const shore = !isW(terrainAt(x - 1, y)) || !isW(terrainAt(x + 1, y)) ||
                    !isW(terrainAt(x, y - 1)) || !isW(terrainAt(x, y + 1));
      g.fillStyle = shore ? '#3878ba' : '#2b6cb0';
      blob(g, px, py, 9, rc);
      if (!shore) {   // tiefes Wasser: dunkler Kern
        g.fillStyle = 'rgba(0,0,30,0.10)';
        g.fillRect(px + 4, py + 4, TS - 8, TS - 8);
      } else {        // helle Uferlinie
        g.strokeStyle = 'rgba(255,255,255,0.28)';
        g.lineWidth = 1.5;
        blobStroke(g, px, py, 9, rc, x, y, isW);
      }
    } else if (t === CFG.T.SAND) {
      g.fillStyle = grassTone(h);
      g.fillRect(px, py, TS, TS);
      const isS = n => n === CFG.T.SAND || n === CFG.T.WATER || n === -1;
      g.fillStyle = ['#c9b877', '#c5b370', '#cdbc7e'][h % 3];
      blob(g, px, py, 8, corners(x, y, isS));
      g.fillStyle = 'rgba(120,100,50,0.22)';
      g.fillRect(px + (h % 6) * 4 + 2, py + ((h >> 4) % 6) * 4 + 2, 2, 2);
      g.fillRect(px + ((h >> 6) % 6) * 4 + 4, py + ((h >> 9) % 6) * 4 + 4, 2, 2);
    } else if (t === CFG.T.MOUNTAIN) {
      // Untergrund kargeres Gras, Felsplateau mit runden Ecken darüber
      g.fillStyle = '#5e7040';
      g.fillRect(px, py, TS, TS);
      const isM = n => n === CFG.T.MOUNTAIN || n === -1;
      g.fillStyle = TCOL[CFG.T.MOUNTAIN];
      blob(g, px, py, 8, corners(x, y, isM));
      // Felsmassiv mit Licht- (NW) und Schattenflanke (SO)
      const peakX = px + TS / 2 + (h % 5) - 2;
      const peakY = py + 5 + (h % 3);
      g.fillStyle = '#8f887a';
      g.beginPath();
      g.moveTo(px + 4, py + TS - 4);
      g.lineTo(peakX, peakY);
      g.lineTo(px + TS - 4, py + TS - 4);
      g.closePath();
      g.fill();
      g.fillStyle = '#5d574c';
      g.beginPath();
      g.moveTo(peakX, peakY);
      g.lineTo(px + TS - 4, py + TS - 4);
      g.lineTo(px + TS / 2 + 2, py + TS - 4);
      g.closePath();
      g.fill();
      if (h % 4 === 0) {   // Schneekuppe
        g.fillStyle = '#eceae2';
        g.beginPath();
        g.moveTo(peakX - 4, peakY + 6);
        g.lineTo(peakX, peakY);
        g.lineTo(peakX + 4, peakY + 6);
        g.closePath();
        g.fill();
      }
    }

    // Bäume (mit Schatten und zweistufiger Krone, leicht verstreut)
    const n = st.trees[i];
    for (let k = 0; k < n; k++) {
      const tx = px + 8 + (k % 2) * 13 + ((h >> (k * 3)) % 7) - 3;
      const ty = py + 10 + ((k / 2) | 0) * 12 + ((h >> (k * 3 + 2)) % 5) - 2;
      g.fillStyle = 'rgba(0,0,0,0.20)';
      g.beginPath(); g.ellipse(tx + 1.5, ty + 4.5, 5, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5b4326';
      g.fillRect(tx - 1.2, ty, 2.4, 5);
      g.fillStyle = '#275c23';
      g.beginPath(); g.arc(tx, ty - 3, 5.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#37782f';
      g.beginPath(); g.arc(tx - 1, ty - 4.5, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.arc(tx - 2.2, ty - 6, 1.5, 0, Math.PI * 2); g.fill();
    }
  }

  function redrawTerritory() {
    const st = Game.st;
    terrCtx.clearRect(0, 0, terrC.width, terrC.height);
    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) {
        const o = st.owner[y * st.w + x];
        if (o < 0) continue;
        terrCtx.fillStyle = CFG.COLORS[o] + '28';
        terrCtx.fillRect(x * TS, y * TS, TS, TS);
        terrCtx.fillStyle = CFG.COLORS[o] + 'aa';
        const oAt = (xx, yy) => (Game.inB(xx, yy) ? st.owner[yy * st.w + xx] : -1);
        if (oAt(x - 1, y) !== o) terrCtx.fillRect(x * TS, y * TS, 2, TS);
        if (oAt(x + 1, y) !== o) terrCtx.fillRect(x * TS + TS - 2, y * TS, 2, TS);
        if (oAt(x, y - 1) !== o) terrCtx.fillRect(x * TS, y * TS, TS, 2);
        if (oAt(x, y + 1) !== o) terrCtx.fillRect(x * TS, y * TS + TS - 2, TS, 2);
      }
    }
  }

  /* ==================================================== Gebäude-Sprites */

  const DIMS = {
    hq:       { w: 1.7,  h: 2.3 },
    wachturm: { w: 0.85, h: 2.2 },
    kaserne:  { w: 1.25, h: 1.7 },
    default:  { w: 1.1,  h: 1.55 },
  };

  function getSprite(type, tribeKey) {
    const key = type + '|' + tribeKey;
    let s = sprites.get(key);
    if (!s) { s = makeSprite(type, tribeKey); sprites.set(key, s); }
    return s;
  }

  function makeSprite(type, tribeKey) {
    const def = CFG.BUILDINGS[type];
    const tribe = CFG.TRIBES[tribeKey] || CFG.TRIBES.roemer;
    const style = tribe.style;
    const dim = DIMS[type] || DIMS.default;
    const W = Math.round(dim.w * TS * SS), H = Math.round(dim.h * TS * SS);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    const groundY = H - 3 * SS;
    // Bodenschatten
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.ellipse(W / 2 + 2 * SS, groundY, W * 0.44, 5 * SS, 0, 0, Math.PI * 2);
    g.fill();

    if (type === 'wachturm') drawTower(g, W, H, groundY, style);
    else if (type === 'hq') drawKeep(g, W, H, groundY, style);
    else drawHouse(g, W, H, groundY, style, type);

    // Typ-Emblem (kleines Schild an der Wand)
    if (type !== 'hq') {
      const ex = W / 2, ey = groundY - (type === 'wachturm' ? H * 0.42 : H * 0.20);
      g.fillStyle = 'rgba(245,240,225,0.92)';
      g.beginPath(); g.arc(ex, ey, 7.2 * SS, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(60,50,30,0.55)';
      g.lineWidth = SS; g.stroke();
      g.font = `${9 * SS}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(def.icon, ex, ey + SS);
    }
    return { c, w: W / SS, h: H / SS };
  }

  /* Normales Haus: Wandblock + volksspezifisches Dach. */
  function drawHouse(g, W, H, groundY, style, type) {
    const wallW = W * 0.78, x0 = (W - wallW) / 2;
    const wallH = H * 0.40;
    const wallTop = groundY - wallH;

    g.fillStyle = style.wall;
    g.fillRect(x0, wallTop, wallW, wallH);
    g.fillStyle = shade(style.wall, 0.78);            // Schattenseite rechts
    g.fillRect(x0 + wallW * 0.8, wallTop, wallW * 0.2, wallH);
    g.strokeStyle = 'rgba(40,30,20,0.5)';
    g.lineWidth = SS;
    g.strokeRect(x0, wallTop, wallW, wallH);

    // Tür + Fenster
    g.fillStyle = 'rgba(45,32,20,0.9)';
    g.beginPath();
    g.arc(W / 2, groundY, 5.5 * SS, Math.PI, 0);
    g.rect(W / 2 - 5.5 * SS, groundY - 0.5, 11 * SS, 0.5);
    g.fill();
    g.fillStyle = 'rgba(35,28,18,0.85)';
    g.fillRect(x0 + wallW * 0.15, wallTop + wallH * 0.28, 4 * SS, 5 * SS);
    g.fillRect(x0 + wallW * 0.68, wallTop + wallH * 0.28, 4 * SS, 5 * SS);

    drawRoof(g, style, x0 - 3 * SS, x0 + wallW + 3 * SS, wallTop, 4 * SS);
  }

  /* Wachturm: hoher schmaler Turm mit Zinnenkranz. */
  function drawTower(g, W, H, groundY, style) {
    const wallW = W * 0.62, x0 = (W - wallW) / 2;
    const wallH = H * 0.72;
    const wallTop = groundY - wallH;

    g.fillStyle = style.wall;
    g.fillRect(x0, wallTop, wallW, wallH);
    g.fillStyle = shade(style.wall, 0.78);
    g.fillRect(x0 + wallW * 0.78, wallTop, wallW * 0.22, wallH);
    g.strokeStyle = 'rgba(40,30,20,0.5)';
    g.lineWidth = SS;
    g.strokeRect(x0, wallTop, wallW, wallH);

    // Kragplatte + Zinnen
    const platY = wallTop - 3 * SS;
    g.fillStyle = shade(style.wall, 0.9);
    g.fillRect(x0 - 3 * SS, platY, wallW + 6 * SS, 4 * SS);
    g.fillStyle = style.roof;
    for (let k = 0; k < 4; k++) {
      g.fillRect(x0 - 3 * SS + k * (wallW + 6 * SS) / 3.6, platY - 5 * SS, 4.5 * SS, 5 * SS);
    }
    // Schießscharten
    g.fillStyle = 'rgba(35,28,18,0.85)';
    g.fillRect(W / 2 - 1.5 * SS, wallTop + wallH * 0.15, 3 * SS, 7 * SS);
    g.fillRect(W / 2 - 1.5 * SS, wallTop + wallH * 0.62, 3 * SS, 7 * SS);
    g.beginPath();
    g.arc(W / 2, groundY, 5 * SS, Math.PI, 0);
    g.fill();
  }

  /* Hauptquartier: Bergfried mit Mauerring und Seitenturm. */
  function drawKeep(g, W, H, groundY, style) {
    // Mauerring
    const mW = W * 0.9, mx = (W - mW) / 2, mH = H * 0.22;
    g.fillStyle = shade(style.wall, 0.92);
    g.fillRect(mx, groundY - mH, mW, mH);
    g.fillStyle = shade(style.wall, 0.72);
    g.fillRect(mx, groundY - mH, mW, 2.5 * SS);
    g.strokeStyle = 'rgba(40,30,20,0.5)';
    g.lineWidth = SS;
    g.strokeRect(mx, groundY - mH, mW, mH);
    // Tor
    g.fillStyle = 'rgba(45,32,20,0.95)';
    g.beginPath(); g.arc(W / 2, groundY, 7 * SS, Math.PI, 0); g.fill();

    // Bergfried (Hauptturm)
    const kW = W * 0.52, kx = (W - kW) / 2;
    const kH = H * 0.52, kTop = groundY - mH - kH + 6 * SS;
    g.fillStyle = style.wall;
    g.fillRect(kx, kTop, kW, kH);
    g.fillStyle = shade(style.wall, 0.78);
    g.fillRect(kx + kW * 0.78, kTop, kW * 0.22, kH);
    g.strokeRect(kx, kTop, kW, kH);
    g.fillStyle = 'rgba(35,28,18,0.85)';
    g.fillRect(W / 2 - 2 * SS, kTop + kH * 0.3, 4 * SS, 6 * SS);
    g.fillRect(W / 2 - 2 * SS, kTop + kH * 0.6, 4 * SS, 6 * SS);
    drawRoof(g, style, kx - 3 * SS, kx + kW + 3 * SS, kTop, 3 * SS);

    // Seitenturm mit Zinnen
    const tW = W * 0.2, tx = mx + 2 * SS;
    const tTop = groundY - mH - H * 0.28;
    g.fillStyle = shade(style.wall, 0.95);
    g.fillRect(tx, tTop, tW, groundY - tTop);
    g.strokeRect(tx, tTop, tW, groundY - tTop);
    g.fillStyle = style.roof;
    g.fillRect(tx - 1.5 * SS, tTop - 3 * SS, tW + 3 * SS, 3.5 * SS);
    g.fillRect(tx - 1.5 * SS, tTop - 6.5 * SS, 3 * SS, 4 * SS);
    g.fillRect(tx + tW - 1.5 * SS, tTop - 6.5 * SS, 3 * SS, 4 * SS);
  }

  /* Volksspezifische Dachformen. */
  function drawRoof(g, style, xL, xR, baseY, topY) {
    const cx = (xL + xR) / 2;
    const roof = style.roof;
    g.strokeStyle = 'rgba(40,30,20,0.45)';
    g.lineWidth = SS;

    switch (style.form) {
      case 'walm': {   // Römer: Walmdach mit First
        g.fillStyle = roof;
        poly(g, [[xL, baseY], [xR, baseY], [cx + (xR - xL) * 0.18, topY + 6 * SS], [cx - (xR - xL) * 0.18, topY + 6 * SS]]);
        g.fillStyle = shade(roof, 1.25);
        g.fillRect(cx - (xR - xL) * 0.18, topY + 5 * SS, (xR - xL) * 0.36, 2 * SS);
        break;
      }
      case 'sattel': {   // Wikinger: steiles Satteldach mit Giebelbalken
        g.fillStyle = roof;
        poly(g, [[xL, baseY], [cx, topY], [xR, baseY]]);
        g.fillStyle = shade(roof, 0.75);
        poly(g, [[cx, topY], [xR, baseY], [cx + (xR - cx) * 0.5, baseY]]);
        g.strokeStyle = shade(style.wall, 0.6);
        g.lineWidth = 2 * SS;
        g.beginPath();
        g.moveTo(cx - 5 * SS, topY + 7 * SS); g.lineTo(cx + 3 * SS, topY - 3 * SS);
        g.moveTo(cx + 5 * SS, topY + 7 * SS); g.lineTo(cx - 3 * SS, topY - 3 * SS);
        g.stroke();
        break;
      }
      case 'stufen': {   // Maya: Stufenpyramide
        const hh = (baseY - topY) / 3;
        for (let k = 0; k < 3; k++) {
          const inset = (xR - xL) * 0.14 * k;
          g.fillStyle = shade(roof, 1 - k * 0.1);
          g.fillRect(xL + inset, baseY - hh * (k + 1), (xR - xL) - inset * 2, hh + 1);
          g.strokeRect(xL + inset, baseY - hh * (k + 1), (xR - xL) - inset * 2, hh + 1);
        }
        break;
      }
      case 'zinnen': {   // Trojaner: Flachdach mit Zinnenkranz
        g.fillStyle = shade(style.wall, 0.9);
        g.fillRect(xL, baseY - 3 * SS, xR - xL, 4 * SS);
        g.fillStyle = roof;
        const n = 4, seg = (xR - xL) / (n * 1.7);
        for (let k = 0; k < n; k++) {
          g.fillRect(xL + k * (xR - xL - seg) / (n - 1), baseY - 8 * SS, seg, 5.5 * SS);
        }
        break;
      }
      case 'flach': {   // Ägypter: Flachdach mit Sims
        g.fillStyle = roof;
        g.fillRect(xL, baseY - 5 * SS, xR - xL, 6 * SS);
        g.strokeRect(xL, baseY - 5 * SS, xR - xL, 6 * SS);
        g.fillStyle = shade(roof, 1.2);
        g.fillRect(xL, baseY - 5 * SS, xR - xL, 1.5 * SS);
        break;
      }
      case 'pagode': {   // Chinesen: geschwungenes Doppeldach
        pagodaTier(g, roof, xL, xR, baseY, baseY - (baseY - topY) * 0.5);
        const inset = (xR - xL) * 0.18;
        pagodaTier(g, roof, xL + inset, xR - inset, baseY - (baseY - topY) * 0.55, topY);
        break;
      }
      case 'kuppel': {   // Nubier: Lehmkuppel
        const r = (xR - xL) * 0.42;
        g.fillStyle = roof;
        g.beginPath();
        g.arc(cx, baseY, r, Math.PI, 0);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = shade(roof, 1.25);
        g.beginPath();
        g.arc(cx - r * 0.3, baseY - r * 0.45, r * 0.28, 0, Math.PI * 2);
        g.fill();
        break;
      }
    }
  }

  function pagodaTier(g, roof, xL, xR, baseY, topY) {
    const cx = (xL + xR) / 2;
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(xL - 3 * SS, baseY);
    g.quadraticCurveTo(xL + (cx - xL) * 0.5, topY + (baseY - topY) * 0.25, cx, topY);
    g.quadraticCurveTo(xR - (xR - cx) * 0.5, topY + (baseY - topY) * 0.25, xR + 3 * SS, baseY);
    g.quadraticCurveTo(cx, baseY - (baseY - topY) * 0.35, xL - 3 * SS, baseY);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(40,30,20,0.45)';
    g.stroke();
  }

  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.closePath();
    g.fill();
  }

  /* ==================================================== Soldaten-Sprites */

  function getUnitSprite(owner) {
    let s = unitSprites.get(owner);
    if (!s) { s = makeUnitSprite(owner); unitSprites.set(owner, s); }
    return s;
  }

  function makeUnitSprite(owner) {
    const col = CFG.COLORS[owner];
    const W = 18 * SS, H = 24 * SS;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const cx = W / 2;

    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(cx, H - 2 * SS, 6 * SS, 2.2 * SS, 0, 0, Math.PI * 2); g.fill();
    // Beine
    g.strokeStyle = '#3a2c1c'; g.lineWidth = 2 * SS;
    g.beginPath();
    g.moveTo(cx - 2 * SS, H - 8 * SS); g.lineTo(cx - 2.5 * SS, H - 2.5 * SS);
    g.moveTo(cx + 2 * SS, H - 8 * SS); g.lineTo(cx + 2.5 * SS, H - 2.5 * SS);
    g.stroke();
    // Speer
    g.strokeStyle = '#6b4e2e'; g.lineWidth = 1.6 * SS;
    g.beginPath(); g.moveTo(cx + 5.5 * SS, H - 3 * SS); g.lineTo(cx + 5.5 * SS, 3 * SS); g.stroke();
    g.fillStyle = '#c8c8cc';
    g.beginPath();
    g.moveTo(cx + 5.5 * SS, SS); g.lineTo(cx + 7 * SS, 4.5 * SS); g.lineTo(cx + 4 * SS, 4.5 * SS);
    g.closePath(); g.fill();
    // Rumpf (Spielerfarbe) – ohne roundRect (ältere iPad-Safaris)
    g.fillStyle = col;
    g.fillRect(cx - 4 * SS, H - 15 * SS, 8 * SS, 8 * SS);
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = SS;
    g.strokeRect(cx - 4 * SS, H - 15 * SS, 8 * SS, 8 * SS);
    // Schild
    g.fillStyle = shade(col, 0.65);
    g.beginPath(); g.ellipse(cx - 5 * SS, H - 11 * SS, 2.6 * SS, 3.4 * SS, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.stroke();
    // Kopf + Helm
    g.fillStyle = '#e8c39e';
    g.beginPath(); g.arc(cx, H - 18 * SS, 3.2 * SS, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7d848c';
    g.beginPath(); g.arc(cx, H - 18.6 * SS, 3.4 * SS, Math.PI, 0); g.fill();
    g.fillRect(cx - 0.8 * SS, H - 18.6 * SS, 1.6 * SS, 3 * SS);
    return { c, w: W / SS, h: H / SS };
  }

  /* ==================================================== Hauptzeichnung */

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

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrainC, 0, 0);
    ctx.drawImage(terrC, 0, 0);

    drawWaterGlints(W, H);
    drawScene();
    drawOverlays();

    ctx.restore();

    miniTimer -= dt;
    if (miniTimer <= 0) { miniTimer = 0.8; drawMinimap(); }
  }

  function visibleTiles(W, H) {
    const st = Game.st;
    return {
      x0: Math.max(0, Math.floor((cam.x - W / 2 / cam.z) / TS)),
      x1: Math.min(st.w - 1, Math.ceil((cam.x + W / 2 / cam.z) / TS)),
      y0: Math.max(0, Math.floor((cam.y - H / 2 / cam.z) / TS)),
      y1: Math.min(st.h - 1, Math.ceil((cam.y + H / 2 / cam.z) / TS)),
    };
  }

  /* Sanft wandernde Glanzlichter auf sichtbarem Wasser. */
  function drawWaterGlints(W, H) {
    if (cam.z < 0.55) return;
    const st = Game.st;
    const v = visibleTiles(W, H);
    const t = st.time;
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        if (st.terrain[y * st.w + x] !== CFG.T.WATER) continue;
        const h = hash(x, y);
        if (h % 3 !== 0) continue;
        const ph = (h % 100) / 100;
        const a = Math.sin((t * 0.35 + ph) * Math.PI * 2);
        if (a <= 0.2) continue;
        ctx.strokeStyle = `rgba(255,255,255,${(0.06 + 0.16 * a).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        const gx = x * TS + 5 + (h % 12), gy = y * TS + 8 + ((h >> 4) % 16);
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.quadraticCurveTo(gx + 5, gy - 2, gx + 10, gy);
        ctx.stroke();
      }
    }
  }

  /* Gebäude und Einheiten Y-sortiert zeichnen (Painter's Algorithm). */
  function drawScene() {
    const st = Game.st;
    const items = [];

    for (const b of st.buildings) {
      if (!b.alive) continue;
      items.push({ y: (b.y + 1) * TS, b });
    }
    for (const u of st.units) {
      items.push({ y: u.y * TS + 2, u });
    }
    items.sort((a, bb) => a.y - bb.y);

    for (const it of items) {
      if (it.b) drawBuilding(it.b);
      else drawUnit(it.u);
    }
  }

  function drawBuilding(b) {
    const st = Game.st;
    const tribeKey = st.players[b.owner].tribe;
    const spr = getSprite(b.type, tribeKey);
    const x = (b.x + 0.5) * TS - spr.w / 2;
    const y = (b.y + 1) * TS - spr.h;

    if (!b.done) {
      // Baustelle: blasser Rohbau + Gerüst
      ctx.globalAlpha = 0.30;
      ctx.drawImage(spr.c, x, y, spr.w, spr.h);
      ctx.globalAlpha = 1;
      const gx = b.x * TS + 3, gy = b.y * TS + 3, gs = TS - 6;
      ctx.strokeStyle = '#8a6a40';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(gx, gy, gs, gs);
      ctx.beginPath();
      ctx.moveTo(gx, gy); ctx.lineTo(gx + gs, gy + gs);
      ctx.moveTo(gx + gs, gy); ctx.lineTo(gx, gy + gs);
      ctx.stroke();
    } else {
      ctx.drawImage(spr.c, x, y, spr.w, spr.h);
      // Wimpel in Spielerfarbe
      const px = x + spr.w * 0.86, py = y + spr.h * 0.18;
      ctx.strokeStyle = '#4a3a26';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, py + 12); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = CFG.COLORS[b.owner];
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px + 8, py + 2.5); ctx.lineTo(px, py + 5);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawUnit(u) {
    const spr = getUnitSprite(u.owner);
    ctx.drawImage(spr.c, u.x * TS - spr.w / 2, u.y * TS - spr.h + 4, spr.w, spr.h);
  }

  /* Lebensbalken, Baufortschritt, Status, Auswahl – über allen Sprites. */
  function drawOverlays() {
    const st = Game.st;

    for (const b of st.buildings) {
      if (!b.alive) continue;
      const px = b.x * TS, py = b.y * TS;
      if (!b.done) {
        ctx.fillStyle = 'rgba(20,20,20,0.7)';
        ctx.fillRect(px + 3, py + TS - 6, TS - 6, 4);
        ctx.fillStyle = '#ffd27f';
        ctx.fillRect(px + 3, py + TS - 6, (TS - 6) * b.progress, 4);
      } else {
        if (b.hp < b.maxHp) {
          const spr = getSprite(b.type, st.players[b.owner].tribe);
          const top = (b.y + 1) * TS - spr.h - 6;
          ctx.fillStyle = 'rgba(20,20,20,0.7)';
          ctx.fillRect(px + 2, top, TS - 4, 4);
          ctx.fillStyle = b.hp / b.maxHp > 0.4 ? '#3dbb5a' : '#e04343';
          ctx.fillRect(px + 2, top, (TS - 4) * (b.hp / b.maxHp), 4);
        }
        if (b.status && b.owner === 0) {
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💤', px + TS - 5, py + 6);
        }
      }
    }

    for (const u of st.units) {
      if (u.hp < u.maxHp) {
        ctx.fillStyle = 'rgba(20,20,20,0.7)';
        ctx.fillRect(u.x * TS - 8, u.y * TS - 24, 16, 3);
        ctx.fillStyle = '#3dbb5a';
        ctx.fillRect(u.x * TS - 8, u.y * TS - 24, 16 * (u.hp / u.maxHp), 3);
      }
    }

    for (const u of UI.selected) {
      if (u.hp <= 0) continue;
      ctx.strokeStyle = '#ffd27f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(u.x * TS, u.y * TS + 2, 9, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function clampCam(W, H) {
    const st = Game.st;
    cam.z = Math.max(0.35, Math.min(2.5, cam.z));
    const hw = W / 2 / cam.z, hh = H / 2 / cam.z;
    cam.x = Math.max(hw - TS * 4, Math.min(st.w * TS - hw + TS * 4, cam.x));
    cam.y = Math.max(hh - TS * 4, Math.min(st.h * TS - hh + TS * 4, cam.y));
  }

  /* ==================================================== Minimap */

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
