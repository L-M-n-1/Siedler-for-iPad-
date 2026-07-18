'use strict';

/* Benutzeroberfläche: Setup-Bildschirm, HUD, Touch-Eingabe. */
const UI = (() => {

  const $ = id => document.getElementById(id);

  /* ------------------------------------------------ Setup-Zustand */

  const setup = {
    mapId: MapGen.PRESETS[0].id,
    seed: (Math.random() * 1e9) | 0,
    count: 3,
    teams: [1, 2, 3, 4],
    difficulty: 'mittel',
  };

  let placing = null;          // Gebäudetyp im Platzierungsmodus
  let selected = [];           // ausgewählte Soldaten
  let infoBuilding = null;
  let hudTimer = 0;
  let toastTimer = 0;
  let endShown = false;

  /* ------------------------------------------------ Setup-Bildschirm */

  function initSetup() {
    const list = $('map-list');
    for (const m of MapGen.PRESETS) {
      const b = document.createElement('button');
      b.innerHTML = `${m.name}<small>${m.size}×${m.size} Felder</small>`;
      b.dataset.id = m.id;
      if (m.id === setup.mapId) b.classList.add('on');
      b.onclick = () => {
        setup.mapId = m.id;
        list.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        refreshPreview();
      };
      list.appendChild(b);
    }

    $('btn-reroll').onclick = () => {
      setup.seed = (Math.random() * 1e9) | 0;
      refreshPreview();
    };

    $('seg-count').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        setup.count = +b.dataset.n;
        $('seg-count').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        buildPlayerRows();
        refreshPreview();
      };
    });

    $('seg-diff').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        setup.difficulty = b.dataset.d;
        $('seg-diff').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      };
    });

    $('btn-start').onclick = startGame;

    buildPlayerRows();
    refreshPreview();
  }

  function buildPlayerRows() {
    // Teams auf gültigen Bereich stutzen (nach Wechsel der Spielerzahl)
    for (let i = 0; i < 4; i++) if (setup.teams[i] > setup.count) setup.teams[i] = i + 1;
    const wrap = $('player-rows');
    wrap.innerHTML = '';
    for (let i = 0; i < setup.count; i++) {
      const row = document.createElement('div');
      row.className = 'player-row';
      const who = i === 0 ? 'Du' : `Computer (${CFG.PLAYER_NAMES[i]})`;
      row.innerHTML = `
        <span class="pdot" style="background:${CFG.COLORS[i]}"></span>
        <span class="pname">${who}</span>
        <span class="team-seg" data-p="${i}"></span>`;
      const seg = row.querySelector('.team-seg');
      for (let t = 1; t <= setup.count; t++) {
        const tb = document.createElement('button');
        tb.textContent = 'T' + t;
        if (setup.teams[i] === t) tb.classList.add('on');
        tb.onclick = () => {
          setup.teams[i] = t;
          seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === tb));
          validateTeams();
        };
        seg.appendChild(tb);
      }
      wrap.appendChild(row);
    }
    validateTeams();
  }

  function validateTeams() {
    const teams = new Set(setup.teams.slice(0, setup.count));
    const bad = teams.size < 2;
    $('team-warn').classList.toggle('hidden', !bad);
    $('btn-start').disabled = bad;
    return !bad;
  }

  function refreshPreview() {
    const map = MapGen.generate(setup.mapId, setup.seed, setup.count);
    MapGen.drawPreview($('map-preview'), map);
    $('map-desc').textContent = map.preset.desc;
  }

  /* ------------------------------------------------ Spielstart / -ende */

  function startGame() {
    if (!validateTeams()) return;
    const players = [];
    for (let i = 0; i < setup.count; i++) {
      players.push({ human: i === 0, team: setup.teams[i] });
    }
    Game.newGame({
      mapId: setup.mapId, seed: setup.seed,
      players, difficulty: setup.difficulty,
    });
    placing = null; selected = []; infoBuilding = null; endShown = false;
    Main.speed = 1;
    $('btn-speed').textContent = '▶ 1×';
    $('setup').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('endscreen').classList.add('hidden');
    $('gamemenu').classList.add('hidden');
    hideBanner(); hideInfo();
    Render.startGame();
    buildResBar();
    buildBuildBar();
    updateHUD(true);
    Main.running = true;
  }

  function quitToMenu() {
    Main.running = false;
    $('game').classList.add('hidden');
    $('setup').classList.remove('hidden');
    setup.seed = (Math.random() * 1e9) | 0;   // nächste Runde: frische Karte
    refreshPreview();
  }

  /* ------------------------------------------------ HUD */

  function buildResBar() {
    const bar = $('resbar');
    bar.innerHTML = '';
    for (const r of CFG.RES) {
      const el = document.createElement('span');
      el.className = 'res-item';
      el.id = 'res-' + r;
      el.title = CFG.RES_INFO[r].name;
      bar.appendChild(el);
    }
  }

  function buildBuildBar() {
    const bar = $('buildbar');
    bar.innerHTML = '';
    for (const type of CFG.BUILD_ORDER) {
      const def = CFG.BUILDINGS[type];
      const b = document.createElement('button');
      b.className = 'bbtn';
      b.id = 'bb-' + type;
      const cost = Object.entries(def.cost)
        .map(([r, n]) => `${n}${CFG.RES_INFO[r].icon}`).join(' ');
      b.innerHTML = `<span class="bico">${def.icon}</span>${def.name}<span class="bcost">${cost}</span>`;
      b.onclick = () => togglePlacing(type);
      bar.appendChild(b);
    }
  }

  function togglePlacing(type) {
    if (placing === type) { cancelModes(); return; }
    const p = Game.st.players[0];
    if (!Game.canAfford(p, CFG.BUILDINGS[type].cost)) {
      toast('Zu wenig Rohstoffe für ' + CFG.BUILDINGS[type].name);
      return;
    }
    placing = type;
    selected = [];
    hideInfo();
    document.querySelectorAll('.bbtn').forEach(x => x.classList.toggle('on', x.id === 'bb-' + type));
    showBanner(`${CFG.BUILDINGS[type].icon} ${CFG.BUILDINGS[type].name}: Tippe auf ein freies Feld in deinem Gebiet`);
  }

  function cancelModes() {
    placing = null;
    selected = [];
    document.querySelectorAll('.bbtn').forEach(x => x.classList.remove('on'));
    $('btn-army').classList.remove('on');
    hideBanner();
  }

  function showBanner(text) {
    const b = $('banner');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    const x = document.createElement('button');
    x.textContent = 'Abbrechen';
    x.onclick = cancelModes;
    b.appendChild(x);
    b.classList.remove('hidden');
  }

  function hideBanner() { $('banner').classList.add('hidden'); }

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    toastTimer = 2.6;
  }

  function updateHUD(force) {
    const st = Game.st;
    if (!st) return;
    hudTimer -= 1 / 60;
    if (!force && hudTimer > 0) return;
    hudTimer = 0.25;

    const p = st.players[0];
    for (const r of CFG.RES) {
      $('res-' + r).innerHTML = `${CFG.RES_INFO[r].icon}<b>${p.res[r]}</b>`;
    }
    $('pop-now').textContent = Game.countPop(0);
    $('pop-max').textContent = Game.maxPop(0);
    $('army-count').textContent = st.units.filter(u => u.owner === 0).length;

    // Baubare Gebäude hervorheben
    for (const type of CFG.BUILD_ORDER) {
      $('bb-' + type).classList.toggle('cant', !Game.canAfford(p, CFG.BUILDINGS[type].cost));
    }

    selected = selected.filter(u => u.hp > 0);

    if (st.toast) { toast(st.toast.text); st.toast = null; }
    if (toastTimer > 0) {
      toastTimer -= 0.25;
      if (toastTimer <= 0) $('toast').classList.add('hidden');
    }

    if (infoBuilding) refreshInfo();

    if (st.over && !endShown) {
      endShown = true;
      showEnd(st.over.win);
    }
  }

  function showEnd(win) {
    $('end-title').textContent = win ? '🎉 Sieg!' : '💀 Niederlage';
    $('end-text').textContent = win
      ? 'Alle feindlichen Hauptquartiere sind gefallen. Dein Volk jubelt dir zu!'
      : 'Dein Hauptquartier wurde zerstört. Beim nächsten Mal klappt es bestimmt!';
    $('endscreen').classList.remove('hidden');
  }

  /* ------------------------------------------------ Gebäude-Info */

  function showInfo(b) {
    infoBuilding = b;
    refreshInfo();
    $('btn-demolish').style.display = (b.owner === 0 && b.type !== 'hq') ? '' : 'none';
    $('infopanel').classList.remove('hidden');
  }

  function refreshInfo() {
    const b = infoBuilding;
    if (!b || !b.alive) { hideInfo(); return; }
    const def = CFG.BUILDINGS[b.type];
    const p = Game.st.players[b.owner];
    $('info-title').textContent = `${def.icon} ${def.name} (${p.name})`;
    let body = def.desc + '<br><br>';
    if (!b.done) {
      body += `🏗️ Im Bau – ${Math.round(b.progress * 100)} %`;
    } else {
      body += `❤️ ${Math.ceil(b.hp)}/${b.maxHp}`;
      if (b.status) body += `<br>💤 ${b.status}`;
      else if (def.interval) body += '<br>✅ Arbeitet';
    }
    $('info-body').innerHTML = body;
  }

  function hideInfo() {
    infoBuilding = null;
    $('infopanel').classList.add('hidden');
  }

  /* ------------------------------------------------ Spiel-Eingabe */

  function initGameUI() {
    $('btn-menu').onclick = () => {
      Main.paused = true;
      $('gamemenu').classList.remove('hidden');
    };
    $('btn-resume').onclick = () => {
      Main.paused = false;
      $('gamemenu').classList.add('hidden');
    };
    $('btn-quit').onclick = () => {
      Main.paused = false;
      quitToMenu();
    };
    $('btn-end-menu').onclick = quitToMenu;
    $('btn-info-close').onclick = hideInfo;
    $('btn-demolish').onclick = () => {
      if (infoBuilding && infoBuilding.owner === 0) {
        Game.demolish(infoBuilding);
        hideInfo();
      }
    };

    $('btn-speed').onclick = () => {
      Main.speed = Main.speed === 1 ? 2 : Main.speed === 2 ? 3 : 1;
      $('btn-speed').textContent = '▶ ' + Main.speed + '×';
    };

    $('btn-army').onclick = () => {
      const mine = Game.st.units.filter(u => u.owner === 0);
      if (!mine.length) { toast('Du hast noch keine Soldaten. Baue eine Kaserne!'); return; }
      placing = null;
      document.querySelectorAll('.bbtn').forEach(x => x.classList.remove('on'));
      selected = mine.slice();
      $('btn-army').classList.add('on');
      showBanner(`⚔️ ${mine.length} Soldaten ausgewählt – tippe auf ein Ziel`);
    };

    initPointer();
    initMinimap();
  }

  /* Zeigersteuerung: Ziehen = Schwenken, Kneifen = Zoomen, Tippen = Aktion. */
  function initPointer() {
    const canvas = Render.canvas;
    const ptrs = new Map();
    let tapStart = null;
    let pinch = null;

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      } else if (ptrs.size === 2) {
        tapStart = null;
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: Render.cam.z };
      }
    });

    canvas.addEventListener('pointermove', e => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (ptrs.size === 1) {
        Render.cam.x -= dx / Render.cam.z;
        Render.cam.y -= dy / Render.cam.z;
        if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 12) tapStart = null;
      } else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        Render.cam.z = pinch.z * (d / pinch.d);
      }
    });

    const up = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (tapStart && performance.now() - tapStart.t < 400) {
        handleTap(tapStart.x, tapStart.y);
      }
      tapStart = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = null; tapStart = null; });

    // Mausrad-Zoom (Desktop-Test)
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      Render.cam.z *= e.deltaY < 0 ? 1.1 : 0.9;
    }, { passive: false });
  }

  function handleTap(sx, sy) {
    if (!Main.running || Main.paused || Game.st.over) return;
    const w = Render.screenToWorld(sx, sy);
    const tx = Math.floor(w.x / CFG.TS), ty = Math.floor(w.y / CFG.TS);

    if (placing) {
      const err = Game.tryBuild(0, placing, tx, ty);
      if (err) { toast(err); return; }
      cancelModes();
      updateHUD(true);
      return;
    }

    if (selected.length) {
      Game.commandUnits(selected, w.x / CFG.TS, w.y / CFG.TS);
      cancelModes();
      return;
    }

    // Auswahl: Gebäude oder eigene Soldaten in der Nähe
    const b = Game.buildingAt(tx, ty);
    if (b) { showInfo(b); return; }

    const wx = w.x / CFG.TS, wy = w.y / CFG.TS;
    const squad = Game.st.units.filter(u =>
      u.owner === 0 && Math.hypot(u.x - wx, u.y - wy) < 2.2);
    if (squad.length) {
      selected = squad;
      $('btn-army').classList.add('on');
      showBanner(`⚔️ ${squad.length} Soldaten ausgewählt – tippe auf ein Ziel`);
      return;
    }

    hideInfo();
  }

  function initMinimap() {
    const mini = document.getElementById('minimap');
    const jump = e => {
      const r = mini.getBoundingClientRect();
      const p = Render.miniToWorld(
        (e.clientX - r.left) * (mini.width / r.width),
        (e.clientY - r.top) * (mini.height / r.height));
      Render.cam.x = p.x; Render.cam.y = p.y;
    };
    mini.addEventListener('pointerdown', jump);
    mini.addEventListener('pointermove', e => { if (e.buttons) jump(e); });
  }

  return {
    initSetup, initGameUI, updateHUD, toast,
    get selected() { return selected; },
  };
})();
