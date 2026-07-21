'use strict';

/* Spiellogik: Zustand, Produktion, Gebiet, Kampf, Sieg. */
const Game = (() => {

  let st = null;

  /* ------------------------------------------------ Neues Spiel */

  function newGame(opts) {
    const map = MapGen.generate(opts.mapId, opts.seed, opts.players.length);
    const diff = CFG.DIFF[opts.difficulty];

    st = {
      opts, diff,
      w: map.w, h: map.h,
      terrain: map.terrain, trees: map.trees,
      owner: new Int8Array(map.w * map.h).fill(-1),
      buildings: [], units: [], carriers: [],
      players: [],
      time: 0, speed: 1, over: null,
      nextId: 1,
      dirty: new Set(),          // Kacheln, die neu gezeichnet werden müssen
      territoryDirty: true,
      regrowTimer: 0, towerTimer: 0,
      toast: null,
    };

    opts.players.forEach((po, i) => {
      const res = {};
      for (const r of CFG.RES) {
        res[r] = CFG.START_RES[r] * (po.human ? 1 : st.diff.resMult) | 0;
      }
      st.players.push({
        id: i, human: po.human, team: po.team, tribe: po.tribe,
        name: po.human ? 'Du' : CFG.PLAYER_NAMES[i],
        color: CFG.COLORS[i],
        res, prodMult: po.human ? 1 : diff.prodMult,
        defeated: false,
        ai: po.human ? null : AI.newMemory(),
      });
      const s = map.starts[i];
      addBuilding(i, 'hq', s.x, s.y, true);
    });

    recomputeTerritory();
    return st;
  }

  /* Gespeicherten Spielstand wiederherstellen (Gegenstück zu SaveGame.snapshot). */
  function restore(s) {
    st = {
      opts: s.opts, diff: CFG.DIFF[s.opts.difficulty],
      w: s.w, h: s.h,
      terrain: Uint8Array.from(s.terrain),
      trees: Uint8Array.from(s.trees),
      owner: new Int8Array(s.w * s.h).fill(-1),
      buildings: s.buildings, units: s.units, carriers: [],
      players: s.players.map(p => ({ ...p, ai: p.human ? null : (p.ai || AI.newMemory()) })),
      time: s.time, speed: 1, over: s.over || null,
      nextId: s.nextId,
      dirty: new Set(), territoryDirty: true,
      regrowTimer: 0, towerTimer: 0, toast: null,
    };
    // In-Flight-Lieferungen wurden beim Speichern dem Pool gutgeschrieben → Träger neu starten
    for (const b of st.buildings) { b.hasCarrier = false; }
    recomputeTerritory();
    return st;
  }

  /* ------------------------------------------------ Völker */

  function tribeOf(pid) {
    return CFG.TRIBES[st.players[pid].tribe] || CFG.TRIBES.roemer;
  }

  /* Baukosten inkl. Volks-Rabatt. */
  function tribeCost(pid, type) {
    const cost = { ...CFG.BUILDINGS[type].cost };
    const off = tribeOf(pid).bonus.cost?.[type];
    if (off) for (const [r, n] of Object.entries(off)) cost[r] = Math.max(0, (cost[r] || 0) - n);
    return cost;
  }

  /* Gebietsradius inkl. Volks-Bonus. */
  function claimOf(b) {
    const def = CFG.BUILDINGS[b.type];
    if (!def.claim) return 0;
    return def.claim + (tribeOf(b.owner).bonus.claim?.[b.type] || 0);
  }

  /* Beansprucht dieses Gebäude gerade Land? Militär nur mit Besatzung. */
  function claimsLand(b) {
    const def = CFG.BUILDINGS[b.type];
    if (!b.alive || !b.done || !def.claim) return false;
    if (def.military) return (b.garrison || 0) > 0;
    return true;
  }

  const needsTool = type => !!CFG.TOOL_OF[type];

  /* ------------------------------------------------ Hilfen */

  const idx = (x, y) => y * st.w + x;
  const inB = (x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  const walkable = i => st.terrain[i] === CFG.T.GRASS || st.terrain[i] === CFG.T.SAND;

  function buildingAt(x, y) {
    if (!inB(x, y)) return null;
    const i = idx(x, y);
    return st.buildings.find(b => b.alive && b.x === x && b.y === y) || null;
  }

  function hasTerrainNear(x, y, need) {
    const r = need.r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inB(nx, ny) || dx * dx + dy * dy > r * r) continue;
        const i = idx(nx, ny);
        if (need.trees) { if (st.trees[i] > 0) return true; }
        else if (st.terrain[i] === need.t) return true;
      }
    }
    return false;
  }

  function canAfford(p, cost) {
    return Object.entries(cost).every(([r, n]) => p.res[r] >= n);
  }

  function pay(p, cost) {
    for (const [r, n] of Object.entries(cost)) p.res[r] -= n;
  }

  /* Warum kann hier nicht gebaut werden? null = alles ok. */
  function placeError(pid, type, x, y) {
    const def = CFG.BUILDINGS[type];
    if (!inB(x, y)) return 'Außerhalb der Karte';
    const i = idx(x, y);
    if (st.terrain[i] !== CFG.T.GRASS) return 'Nur auf Wiese baubar';
    if (st.trees[i] > 0) return 'Hier stehen Bäume';
    if (st.owner[i] !== pid) return 'Nicht dein Gebiet';
    if (buildingAt(x, y)) return 'Feld ist belegt';
    if (def.terrainNeed && !hasTerrainNear(x, y, def.terrainNeed)) {
      if (def.terrainNeed.trees) return 'Keine Bäume in der Nähe';
      if (def.terrainNeed.t === CFG.T.WATER) return 'Kein Wasser in der Nähe';
      return 'Kein Berg in der Nähe';
    }
    if (!canAfford(st.players[pid], tribeCost(pid, type))) return 'Zu wenig Rohstoffe';
    return null;
  }

  function addBuilding(pid, type, x, y, instant) {
    const def = CFG.BUILDINGS[type];
    const hp = Math.round(def.hp * (tribeOf(pid).bonus.buildingHp || 1));
    const b = {
      id: st.nextId++, type, owner: pid, x, y,
      hp, maxHp: hp,
      done: !!instant, progress: instant ? 1 : 0,
      timer: def.interval || 0, working: false, alive: true,
      staffed: !needsTool(type),     // Werkzeug-Gebäude erst nach Besetzung tätig
      out: {}, hasCarrier: false,     // Ausgangslager + laufende Lieferung
      garrison: 0, gtypes: [],        // Turm-Besatzung (Anzahl + Typen)
      toolType: null, trainType: 'lanze',
    };
    st.buildings.push(b);
    st.dirty.add(idx(x, y));
    if (b.done && def.claim) st.territoryDirty = true;
    return b;
  }

  function tryBuild(pid, type, x, y) {
    const err = placeError(pid, type, x, y);
    if (err) return err;
    pay(st.players[pid], tribeCost(pid, type));
    addBuilding(pid, type, x, y, false);
    return null;
  }

  function demolish(b) {
    destroyBuilding(b);
  }

  function destroyBuilding(b) {
    if (!b.alive) return;
    b.alive = false;
    st.dirty.add(idx(b.x, b.y));
    const def = CFG.BUILDINGS[b.type];
    if (def.claim) st.territoryDirty = true;
    for (const u of st.units) {
      if (u.tb === b.id) { u.tb = null; u.path = null; }
    }
    if (b.type === 'hq') defeatPlayer(st.players[b.owner]);
  }

  function defeatPlayer(p) {
    if (p.defeated) return;
    p.defeated = true;
    for (const b of st.buildings) if (b.owner === p.id) { b.alive = false; st.dirty.add(idx(b.x, b.y)); }
    st.units = st.units.filter(u => u.owner !== p.id);
    st.carriers = st.carriers.filter(c => c.owner !== p.id);
    recomputeTerritory();
    st.territoryDirty = true;   // Anzeige neu zeichnen
    st.toast = { text: `${p.name} wurde${p.human ? 'st' : ''} besiegt!`, t: 5 };
    checkVictory();
  }

  function checkVictory() {
    if (st.over) return;
    const alive = st.players.filter(p => !p.defeated);
    const teams = new Set(alive.map(p => p.team));
    const human = st.players.find(p => p.human);
    if (human.defeated) {
      st.over = { win: false };
    } else if (teams.size <= 1) {
      st.over = { win: teams.has(human.team) };
    }
  }

  /* ------------------------------------------------ Gebiet */

  function recomputeTerritory() {
    const { w, h, owner } = st;
    owner.fill(-1);
    const best = new Float32Array(w * h).fill(1e9);
    for (const b of st.buildings) {
      if (!claimsLand(b)) continue;
      const r = claimOf(b), r2 = r * r;
      for (let y = Math.max(0, b.y - r); y <= Math.min(h - 1, b.y + r); y++) {
        for (let x = Math.max(0, b.x - r); x <= Math.min(w - 1, b.x + r); x++) {
          const d2 = (x - b.x) ** 2 + (y - b.y) ** 2;
          if (d2 > r2) continue;
          const i = y * w + x;
          if (d2 < best[i]) { best[i] = d2; owner[i] = b.owner; }
        }
      }
    }
  }

  /* ------------------------------------------------ Wegfindung (A*) */

  function astar(sx, sy, tx, ty) {
    const { w, h } = st;
    if (!inB(tx, ty)) return null;
    if (!walkable(idx(tx, ty))) {
      const alt = nearestWalkable(tx, ty, 3);
      if (!alt) return null;
      tx = alt.x; ty = alt.y;
    }
    const size = w * h;
    const g = new Float32Array(size).fill(1e9);
    const from = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const heap = [];      // [f, index]
    const push = (f, i) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const par = (c - 1) >> 1;
        if (heap[par][0] <= heap[c][0]) break;
        [heap[par], heap[c]] = [heap[c], heap[par]]; c = par;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          let m = c; const l = 2 * c + 1, r = l + 1;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
        }
      }
      return top;
    };
    const hFn = i => {
      const x = i % w, y = (i / w) | 0;
      return Math.hypot(x - tx, y - ty);
    };
    const start = idx(sx, sy), goal = idx(tx, ty);
    g[start] = 0;
    push(hFn(start), start);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]];
    let expanded = 0;
    while (heap.length) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) break;
      if (++expanded > 6000) return null;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy, c] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!inB(nx, ny)) continue;
        const ni = ny * w + nx;
        if (!walkable(ni) || closed[ni]) continue;
        const ng = g[cur] + c;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; push(ng + hFn(ni), ni); }
      }
    }
    if (from[goal] === -1 && goal !== start) return null;
    const path = [];
    for (let i = goal; i !== -1 && i !== start; i = from[i]) path.push({ x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5 });
    path.reverse();
    return path;
  }

  function nearestWalkable(tx, ty, r) {
    for (let rad = 0; rad <= r; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = tx + dx, ny = ty + dy;
          if (inB(nx, ny) && walkable(idx(nx, ny))) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /* ------------------------------------------------ Soldaten */

  function countPop(pid) {
    return st.units.reduce((n, u) => n + (u.owner === pid ? 1 : 0), 0);
  }

  function maxPop(pid) {
    let n = CFG.POP_BASE;
    for (const b of st.buildings) {
      if (b.alive && b.done && b.owner === pid && CFG.BUILDINGS[b.type].pop) n += CFG.BUILDINGS[b.type].pop;
    }
    return n;
  }

  function spawnSoldier(pid, x, y, type) {
    const S = CFG.SOLDIERS[type] || CFG.SOLDIERS.lanze;
    const spot = nearestWalkable(x, y + 1, 3) || { x, y };
    const mult = tribeOf(pid).bonus.soldier || 1;
    const hp = Math.round(S.hp * mult);
    st.units.push({
      id: st.nextId++, owner: pid, type: type || 'lanze',
      x: spot.x + 0.5, y: spot.y + 0.5,
      hp, maxHp: hp,
      dmgU: S.dmgUnit * mult,
      dmgB: S.dmgBuilding * mult,
      range: S.range, speed: S.speed, cool: S.cooldown, aggro: S.aggro,
      path: null, pi: 0, tb: null, tu: null, tgGar: null,
      cd: 0, scan: Math.random() * 0.5,
    });
  }

  function isEnemy(a, b) {
    return st.players[a].team !== st.players[b].team;
  }

  function getBuilding(id) {
    return st.buildings.find(b => b.id === id && b.alive) || null;
  }

  function getUnit(id) {
    return st.units.find(u => u.id === id && u.hp > 0) || null;
  }

  /* Befehl: Einheiten zu Punkt schicken, Ziel angreifen oder eigenen Turm besetzen. */
  function commandUnits(units, tx, ty) {
    const tb = buildingAt(Math.floor(tx), Math.floor(ty));
    let tu = null;
    let bestD = 1.2;
    for (const u of st.units) {
      const d = Math.hypot(u.x - tx, u.y - ty);
      if (d < bestD) { bestD = d; tu = u; }
    }
    // Eigener Turm mit freiem Platz? → Besatzung schicken statt anzugreifen
    const ownTower = tb && !isEnemy(0, tb.owner) && CFG.BUILDINGS[tb.type].military ? tb : null;
    let attacked = false, garrisoned = false;
    units.forEach((u, k) => {
      u.tb = null; u.tu = null; u.tgGar = null;
      if (ownTower && u.owner === tb.owner) {
        u.tgGar = tb.id; garrisoned = true;
      } else if (tu && tu.owner !== u.owner && isEnemy(u.owner, tu.owner)) {
        u.tu = tu.id; attacked = true;
      } else if (tb && tb.owner !== u.owner && isEnemy(u.owner, tb.owner)) {
        u.tb = tb.id; attacked = true;
      }
      const off = spreadOffset(k);
      const gx = Math.max(0, Math.min(st.w - 1, Math.floor(tx + off.x)));
      const gy = Math.max(0, Math.min(st.h - 1, Math.floor(ty + off.y)));
      u.path = astar(Math.floor(u.x), Math.floor(u.y), gx, gy);
      u.pi = 0;
    });
    return { attacked, garrisoned };
  }

  function spreadOffset(k) {
    if (k === 0) return { x: 0, y: 0 };
    const ring = Math.ceil((Math.sqrt(k + 1) - 1) / 2);
    const ang = k * 2.4;
    return { x: Math.cos(ang) * ring, y: Math.sin(ang) * ring };
  }

  /* ------------------------------------------------ Takt */

  function update(dt) {
    if (!st || st.over) return;
    st.time += dt;
    if (st.toast) { st.toast.t -= dt; if (st.toast.t <= 0) st.toast = null; }

    if (st.territoryDirty) { recomputeTerritory(); }

    for (const b of st.buildings) if (b.alive) updateBuilding(b, dt);
    st.buildings = st.buildings.filter(b => b.alive);

    updateCarriers(dt);
    updateUnits(dt);
    towerDefense(dt);

    regrow(dt);

    for (const p of st.players) {
      if (!p.defeated && !p.human) AI.update(p, dt);
    }
  }

  /* ------------------------------------------------ Lastenträger / Logistik */

  function carrierCap(pid) {
    let n = CFG.CARRIERS_BASE;
    for (const b of st.buildings) {
      if (b.alive && b.done && b.owner === pid && CFG.BUILDINGS[b.type].carriers) n += CFG.BUILDINGS[b.type].carriers;
    }
    return Math.min(CFG.CARRIER_MAX, n);
  }

  function carriersBusy(pid) {
    let n = 0;
    for (const c of st.carriers) if (c.owner === pid && c.kind === 'goods') n++;
    return n;
  }

  /* Nächstes Lager (HQ oder Lagerhaus) des Spielers. */
  function nearestStore(pid, x, y) {
    let best = null, bestD = 1e9;
    for (const b of st.buildings) {
      if (!b.alive || !b.done || b.owner !== pid) continue;
      if (b.type !== 'hq' && !CFG.BUILDINGS[b.type].storage) continue;
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /* Produzierte Waren aus dem Ausgangslager eines Gebäudes per Träger ausliefern. */
  function dispatchGoods(b) {
    const p = st.players[b.owner];
    if (b.hasCarrier || !Object.keys(b.out).length) return;
    if (carriersBusy(b.owner) >= carrierCap(b.owner)) return;
    const store = nearestStore(b.owner, b.x, b.y);
    if (!store) { creditPool(p, b.out); b.out = {}; return; }   // Notfall
    const path = astar(b.x, b.y, store.x, store.y);
    const payload = b.out; b.out = {}; b.hasCarrier = true;
    if (!path) { creditPool(p, payload); b.hasCarrier = false; return; }
    st.carriers.push({
      id: st.nextId++, owner: b.owner, kind: 'goods',
      from: b.id, payload, res: firstKey(payload),
      x: b.x + 0.5, y: b.y + 0.5, path, pi: 0, speed: 2.2,
    });
  }

  /* Siedler bringt ein Werkzeug vom Lager zum neu besetzten Gebäude (nur Optik). */
  function dispatchStaff(b, tool) {
    const store = nearestStore(b.owner, b.x, b.y);
    if (!store) return;
    const path = astar(store.x, store.y, b.x, b.y);
    if (!path) return;
    st.carriers.push({
      id: st.nextId++, owner: b.owner, kind: 'staff',
      res: tool, x: store.x + 0.5, y: store.y + 0.5, path, pi: 0, speed: 2.4,
    });
  }

  function updateCarriers(dt) {
    for (const c of st.carriers) {
      const wp = c.path[c.pi];
      if (!wp) { c.done = true; continue; }
      const d = Math.hypot(wp.x - c.x, wp.y - c.y);
      const step = c.speed * dt;
      if (d <= step) { c.x = wp.x; c.y = wp.y; c.pi++; if (c.pi >= c.path.length) c.done = true; }
      else { c.x += (wp.x - c.x) / d * step; c.y += (wp.y - c.y) / d * step; }
      if (c.done && c.kind === 'goods') {
        creditPool(st.players[c.owner], c.payload);
        const src = st.buildings.find(b => b.id === c.from);
        if (src) src.hasCarrier = false;
      }
    }
    st.carriers = st.carriers.filter(c => !c.done);
  }

  function creditPool(p, bundle) {
    for (const [r, n] of Object.entries(bundle)) p.res[r] = (p.res[r] || 0) + n;
  }

  const firstKey = o => Object.keys(o)[0];

  const OUTBUF_CAP = 8;
  const bufTotal = b => Object.values(b.out).reduce((a, n) => a + n, 0);

  /* ------------------------------------------------ Turmverteidigung */

  function towerDefense(dt) {
    st.towerTimer -= dt;
    if (st.towerTimer > 0) return;
    st.towerTimer = 0.6;
    for (const b of st.buildings) {
      if (!b.alive || !b.done || !CFG.BUILDINGS[b.type].military || (b.garrison || 0) <= 0) continue;
      const range = 3.5 + b.garrison * 0.6;
      let tgt = null, bestD = range;
      for (const e of st.units) {
        if (e.owner === b.owner || !isEnemy(b.owner, e.owner)) continue;
        const d = Math.hypot(e.x - (b.x + 0.5), e.y - (b.y + 0.5));
        if (d < bestD) { bestD = d; tgt = e; }
      }
      if (tgt) { tgt.hp -= 3 * b.garrison; b.firing = tgt.id; }
      else b.firing = null;
    }
    st.units = st.units.filter(u => u.hp > 0);
  }

  function updateBuilding(b, dt) {
    const def = CFG.BUILDINGS[b.type];
    const p = st.players[b.owner];

    if (!b.done) {
      b.progress += dt / (def.buildTime * (tribeOf(b.owner).bonus.buildTime || 1)) * p.prodMult;
      if (b.progress >= 1) {
        b.progress = 1; b.done = true;
        st.dirty.add(idx(b.x, b.y));
        if (def.claim) st.territoryDirty = true;
      }
      return;
    }

    // Fertige Waren zum Lager schaffen (auch für nicht-produzierende Zustände)
    dispatchGoods(b);

    if (def.trains) { trainAtBarracks(b, dt, def, p); return; }
    if (!def.interval) return;   // Lager, Wohnhaus, Militär: keine Produktion

    b.timer -= dt * p.prodMult;
    if (b.timer > 0) return;
    b.working = false;
    b.status = null;

    // Werkzeug-Gate: ohne Werkzeug kein Arbeiter → Gebäude steht still
    if (needsTool(b.type) && !b.staffed) {
      const tool = CFG.TOOL_OF[b.type];
      if ((p.res[tool] || 0) < 1) { b.status = 'Werkzeug fehlt (' + CFG.RES_INFO[tool].name + ')'; b.timer = 1.5; return; }
      p.res[tool]--; b.staffed = true;
      dispatchStaff(b, tool);   // Siedler bringt das Werkzeug (Optik)
    }

    if (bufTotal(b) >= OUTBUF_CAP) { b.status = 'Lager voll – wartet auf Träger'; b.timer = 1.0; return; }
    if (def.terrainNeed && !def.terrainNeed.trees && !hasTerrainNear(b.x, b.y, def.terrainNeed)) {
      b.status = 'Gelände fehlt'; b.timer = 1.5; return;
    }
    if (def.input && !canAfford(p, def.input)) {
      b.status = 'Rohstoffe fehlen'; b.timer = 1.0; return;
    }
    if (b.type === 'holzfaeller') {
      const tree = findTree(b);
      if (!tree) { b.status = 'Keine Bäume mehr'; b.timer = 2; return; }
      st.trees[tree]--; st.dirty.add(tree);
    }

    if (def.input) pay(p, def.input);
    // Produktion landet im Ausgangslager (wird per Träger geliefert)
    if (def.output) for (const [r, n] of Object.entries(def.output)) b.out[r] = (b.out[r] || 0) + n;
    if (def.makesTool) { const t = chooseTool(b); b.out[t] = (b.out[t] || 0) + 1; }
    b.working = true;
    const tribeMult = tribeOf(b.owner).bonus.interval?.[b.type] || 1;
    b.timer = def.interval * tribeMult * (0.9 + Math.random() * 0.2);
    dispatchGoods(b);
  }

  /* Werkzeugmacher: baut das aktuell am dringendsten fehlende Werkzeug
     (Gebäude wartet darauf) – sonst die eingestellte Priorität bzw. reihum. */
  function chooseTool(b) {
    const p = st.players[b.owner];
    if (b.toolType) return b.toolType;   // manueller Wunsch
    // Werkzeug, für das ein eigenes Gebäude wartet und der Pool leer ist
    for (const bb of st.buildings) {
      if (bb.alive && bb.done && bb.owner === b.owner && needsTool(bb.type) && !bb.staffed) {
        const t = CFG.TOOL_OF[bb.type];
        if ((p.res[t] || 0) + (b.out[t] || 0) < 1) return t;
      }
    }
    b.toolRR = ((b.toolRR || 0) + 1) % CFG.TOOL_KEYS.length;
    return CFG.TOOL_KEYS[b.toolRR];
  }

  /* Kaserne bildet den eingestellten Soldatentyp aus (Waffe + Nahrung + Wohnraum). */
  function trainAtBarracks(b, dt, def, p) {
    b.timer -= dt * p.prodMult;
    if (b.timer > 0) return;
    b.working = false; b.status = null;

    let type = b.trainType || 'lanze';
    const affordable = t => canAfford(p, CFG.SOLDIERS[t].cost);
    if (!affordable(type)) {
      // KI weicht auf einen bezahlbaren Typ aus; Mensch sieht den Mangel
      if (p.human) { b.status = 'Waffe/Nahrung fehlt'; b.timer = 1.0; return; }
      const alt = CFG.SOLDIER_KEYS.find(affordable);
      if (!alt) { b.status = 'Waffe fehlt'; b.timer = 1.0; return; }
      type = alt;
    }
    if (countPop(b.owner) >= maxPop(b.owner)) { b.status = 'Kein Wohnraum frei'; b.timer = 1.5; return; }

    pay(p, CFG.SOLDIERS[type].cost);
    spawnSoldier(b.owner, b.x, b.y, type);
    b.working = true;
    const tm = tribeOf(b.owner).bonus.trainMult || 1;
    b.timer = CFG.SOLDIERS[type].train * tm * (0.9 + Math.random() * 0.2);
  }

  function findTree(b) {
    const r = CFG.BUILDINGS.holzfaeller.terrainNeed.r;
    let best = -1, bestD = 1e9;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = b.x + dx, ny = b.y + dy;
        if (!inB(nx, ny)) continue;
        const d = dx * dx + dy * dy;
        if (d > r * r || d >= bestD) continue;
        const i = idx(nx, ny);
        if (st.trees[i] > 0) { best = i; bestD = d; }
      }
    }
    return best >= 0 ? best : null;
  }

  function regrow(dt) {
    st.regrowTimer += dt;
    if (st.regrowTimer < 1) return;
    st.regrowTimer = 0;
    const n = Math.max(4, (st.w * st.h / 500) | 0);
    for (let k = 0; k < n; k++) {
      const i = (Math.random() * st.w * st.h) | 0;
      if (st.trees[i] > 0 && st.trees[i] < 3) {
        if (Math.random() < 0.12) { st.trees[i]++; st.dirty.add(i); }
      } else if (st.trees[i] === 0 && st.terrain[i] === CFG.T.GRASS && st.owner[i] === -1 && !buildingAt(i % st.w, (i / st.w) | 0)) {
        const x = i % st.w, y = (i / st.w) | 0;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++)
          for (let dx = -1; dx <= 1 && !near; dx++)
            if (inB(x + dx, y + dy) && st.trees[idx(x + dx, y + dy)] > 1) near = true;
        if (near && Math.random() < 0.06) { st.trees[i] = 1; st.dirty.add(i); }
      }
    }
  }

  /* ------------------------------------------------ Einheiten-Takt */

  function updateUnits(dt) {
    for (const u of st.units) {
      u.cd -= dt; u.scan -= dt;
      if (u.shot > 0) u.shot -= dt;

      // Turm besetzen (eigener Marschbefehl auf eigenen Turm)
      if (u.tgGar) {
        const tw = getBuilding(u.tgGar);
        if (!tw || (tw.garrison || 0) >= CFG.BUILDINGS[tw.type].garrisonMax) { u.tgGar = null; u.path = null; }
        else if (Math.hypot(u.x - (tw.x + 0.5), u.y - (tw.y + 0.5)) <= 1.3) {
          tw.garrison = (tw.garrison || 0) + 1;
          (tw.gtypes || (tw.gtypes = [])).push(u.type);
          u.removed = true; st.territoryDirty = true; st.dirty.add(idx(tw.x, tw.y));
          continue;
        } else { approach(u, tw.x + 0.5, tw.y + 0.5, dt); continue; }
      }

      let tgtU = u.tu ? getUnit(u.tu) : null;
      let tgtB = u.tb ? getBuilding(u.tb) : null;
      if (u.tu && !tgtU) u.tu = null;
      if (u.tb && !tgtB) u.tb = null;

      // Automatisch nahe Feinde angreifen, wenn ohne Auftrag
      if (!tgtU && !tgtB && !u.path && u.scan <= 0) {
        u.scan = 0.5;
        tgtU = acquireUnit(u, u.aggro || 4);
        if (tgtU) u.tu = tgtU.id;
        else {
          tgtB = acquireBuilding(u, 3);
          if (tgtB) u.tb = tgtB.id;
        }
      }

      if (tgtU) { engage(u, tgtU.x, tgtU.y, dt, () => { hitUnit(tgtU, u.dmgU); }); continue; }
      if (tgtB) { engage(u, tgtB.x + 0.5, tgtB.y + 0.5, dt, () => { hitBuilding(tgtB, u.dmgB); }); continue; }
      if (u.path) followPath(u, dt);
    }
    st.units = st.units.filter(u => u.hp > 0 && !u.removed);
  }

  function engage(u, tx, ty, dt, hit) {
    const range = u.range || 1.1;
    const d = Math.hypot(u.x - tx, u.y - ty);
    if (d <= range) {
      u.path = null; u.aim = { x: tx, y: ty };
      if (u.cd <= 0) { u.cd = u.cool || 0.8; hit(); u.shot = 0.15; }
    } else {
      approach(u, tx, ty, dt);
    }
  }

  /* Pfad zum (ggf. bewegten) Ziel, regelmäßig auffrischen. */
  function approach(u, tx, ty, dt) {
    if (!u.path || u.repath === undefined || (u.repath -= dt) <= 0) {
      u.repath = 1.0;
      u.path = astar(Math.floor(u.x), Math.floor(u.y), Math.floor(tx), Math.floor(ty));
      u.pi = 0;
    }
    if (u.path) followPath(u, dt);
    else moveToward(u, tx, ty, dt);   // Notfall: gerader Weg
  }

  function followPath(u, dt) {
    const wp = u.path[u.pi];
    if (!wp) { u.path = null; return; }
    if (moveToward(u, wp.x, wp.y, dt)) {
      u.pi++;
      if (u.pi >= u.path.length) u.path = null;
    }
  }

  function moveToward(u, tx, ty, dt) {
    const d = Math.hypot(tx - u.x, ty - u.y);
    const step = (u.speed || 2.4) * dt;
    u.face = tx < u.x ? -1 : 1;
    if (d <= step) { u.x = tx; u.y = ty; return true; }
    u.x += (tx - u.x) / d * step;
    u.y += (ty - u.y) / d * step;
    return false;
  }

  function acquireUnit(u, r) {
    let best = null, bestD = r;
    for (const e of st.units) {
      if (e.owner === u.owner || !isEnemy(u.owner, e.owner)) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function acquireBuilding(u, r) {
    let best = null, bestD = r;
    for (const b of st.buildings) {
      if (!b.alive || b.owner === u.owner || !isEnemy(u.owner, b.owner)) continue;
      const d = Math.hypot(b.x + 0.5 - u.x, b.y + 0.5 - u.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function hitUnit(t, dmg) {
    t.hp -= dmg;
  }

  function hitBuilding(b, dmg) {
    b.hp -= dmg;
    st.dirty.add(idx(b.x, b.y));
    if (b.hp <= 0) destroyBuilding(b);
  }

  /* Einen Soldaten aus einem Turm ausrücken lassen. */
  function sallyGarrison(b) {
    if (!b.garrison || b.garrison <= 0) return false;
    b.garrison--;
    const type = (b.gtypes && b.gtypes.pop()) || 'lanze';
    spawnSoldier(b.owner, b.x, b.y, type);
    st.territoryDirty = true;
    st.dirty.add(idx(b.x, b.y));
    return true;
  }

  /* ------------------------------------------------ API */

  return {
    newGame, restore, update, tryBuild, placeError, demolish,
    commandUnits, countPop, maxPop, buildingAt, astar,
    isEnemy, hasTerrainNear, canAfford, tribeOf, tribeCost,
    spawnSoldier, sallyGarrison, carrierCap, carriersBusy, needsTool,
    get st() { return st; },
    idx, inB, walkable,
  };
})();
