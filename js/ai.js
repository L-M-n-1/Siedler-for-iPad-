'use strict';

/* Computergegner: baut Wirtschaft auf, erweitert Gebiet, greift an. */
const AI = (() => {

  function newMemory() {
    return {
      think: Math.random() * 2,
      attackCd: 90 + Math.random() * 60,
      defCd: 0,
      skip: {},           // vorübergehend unbaubare Vorhaben
    };
  }

  /* Ausbaureihenfolge: [Gebäudetyp, gewünschte Anzahl] */
  const ORDER = [
    ['holzfaeller', 1], ['saegewerk', 1], ['holzfaeller', 2], ['steinbruch', 1],
    ['fischer', 1], ['bauernhof', 1], ['muehle', 1], ['baeckerei', 1],
    ['wohnhaus', 1], ['wachturm', 1],
    ['eisenmine', 1], ['schmelze', 1], ['schmiede', 1], ['kaserne', 1],
    ['holzfaeller', 3], ['saegewerk', 2], ['wachturm', 2], ['wohnhaus', 2],
    ['eisenmine', 2], ['schmelze', 2], ['schmiede', 2], ['wohnhaus', 3],
    ['wachturm', 3], ['steinbruch', 2], ['bauernhof', 2], ['muehle', 2], ['baeckerei', 2],
    ['kaserne', 2], ['wohnhaus', 4], ['wachturm', 4], ['schmiede', 3], ['wohnhaus', 5],
  ];

  function update(p, dt) {
    const mem = p.ai;
    mem.attackCd -= dt;
    mem.defCd -= dt;
    mem.think -= dt;
    if (mem.think > 0) return;
    const st = Game.st;
    mem.think = st.diff.thinkCd + Math.random();

    defend(p, mem);
    build(p, mem);
    attack(p, mem);
  }

  /* ------------------------------------------------ Bauen */

  function build(p, mem) {
    const st = Game.st;
    const counts = {};
    for (const b of st.buildings) {
      if (b.alive && b.owner === p.id) counts[b.type] = (counts[b.type] || 0) + 1;
    }

    let attempts = 0;
    for (const [type, want] of ORDER) {
      if ((counts[type] || 0) >= want) continue;
      const key = type + want;
      if (mem.skip[key] && mem.skip[key] > st.time) continue;

      const def = CFG.BUILDINGS[type];
      if (!Game.canAfford(p, def.cost)) return;   // sparen, Reihenfolge einhalten

      const spot = findSpot(p, type);
      if (!spot) {
        mem.skip[key] = st.time + 45;             // später erneut versuchen
        if (++attempts >= 3) return;
        continue;
      }
      Game.tryBuild(p.id, type, spot.x, spot.y);
      return;                                     // ein Bau pro Denk-Takt
    }
  }

  function findSpot(p, type) {
    const st = Game.st;
    const def = CFG.BUILDINGS[type];
    const hq = st.buildings.find(b => b.alive && b.owner === p.id && b.type === 'hq');
    if (!hq) return null;

    const enemyHq = nearestEnemyBuilding(p, hq.x, hq.y, 'hq');
    let best = null, bestScore = -1e9;

    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) {
        const i = y * st.w + x;
        if (st.owner[i] !== p.id) continue;
        if (st.terrain[i] !== CFG.T.GRASS || st.trees[i] > 0) continue;
        if (Game.buildingAt(x, y)) continue;
        if (def.terrainNeed && !Game.hasTerrainNear(x, y, def.terrainNeed)) continue;

        let score;
        if (type === 'wachturm') {
          // Am Gebietsrand, in Richtung Feind bzw. unbeanspruchtes Land
          if (!isFrontier(x, y, p.id)) continue;
          if (tooCloseToOwnTower(p, x, y)) continue;
          score = enemyHq
            ? -Math.hypot(x - enemyHq.x, y - enemyHq.y)   // auf den Feind zu
            : Math.hypot(x - hq.x, y - hq.y);             // sonst vom HQ weg

        } else {
          // Wirtschaftsgebäude: nah am Hauptquartier, nicht direkt daneben
          const d = Math.hypot(x - hq.x, y - hq.y);
          if (d < 1.5) continue;
          score = -d + Math.random() * 0.5;
        }
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    return best;
  }

  function isFrontier(x, y, pid) {
    const st = Game.st;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (Game.inB(nx, ny) && st.owner[ny * st.w + nx] === -1) return true;
      }
    }
    return false;
  }

  function tooCloseToOwnTower(p, x, y) {
    return Game.st.buildings.some(b =>
      b.alive && b.owner === p.id && CFG.BUILDINGS[b.type].claim &&
      Math.hypot(b.x - x, b.y - y) < 5);
  }

  function nearestEnemyBuilding(p, x, y, onlyType) {
    let best = null, bestD = 1e9;
    for (const b of Game.st.buildings) {
      if (!b.alive || b.owner === p.id || !Game.isEnemy(p.id, b.owner)) continue;
      if (onlyType && b.type !== onlyType) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /* ------------------------------------------------ Kämpfen */

  function myUnits(p) {
    return Game.st.units.filter(u => u.owner === p.id);
  }

  function defend(p, mem) {
    if (mem.defCd > 0) return;
    const st = Game.st;
    const intruder = st.units.find(u =>
      u.owner !== p.id && Game.isEnemy(p.id, u.owner) &&
      Game.inB(Math.floor(u.x), Math.floor(u.y)) &&
      st.owner[Math.floor(u.y) * st.w + Math.floor(u.x)] === p.id);
    if (!intruder) return;
    const troops = myUnits(p).filter(u => !u.tb && !u.tu);
    if (!troops.length) return;
    Game.commandUnits(troops, intruder.x, intruder.y);
    mem.defCd = 8;
  }

  function attack(p, mem) {
    if (mem.attackCd > 0) return;
    const st = Game.st;
    const troops = myUnits(p);
    if (troops.length < st.diff.attackN) return;

    const hq = st.buildings.find(b => b.alive && b.owner === p.id && b.type === 'hq');
    if (!hq) return;
    // Bevorzugt Grenzposten (Türme), sonst das nächste feindliche Gebäude
    const target = nearestEnemyBuilding(p, hq.x, hq.y, 'wachturm')
                || nearestEnemyBuilding(p, hq.x, hq.y, null);
    if (!target) return;
    Game.commandUnits(troops, target.x + 0.5, target.y + 0.5);
    mem.attackCd = st.diff.attackCd * (0.8 + Math.random() * 0.4);
  }

  return { newMemory, update };
})();
