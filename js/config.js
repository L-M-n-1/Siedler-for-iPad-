'use strict';

/* Globale Spielkonfiguration: Gelände, Waren, Gebäude, Soldaten, Schwierigkeit. */
const CFG = {
  TS: 32,                       // Kachelgröße in Pixeln (Weltkoordinaten)
  T: { GRASS: 0, WATER: 1, MOUNTAIN: 2, SAND: 3 },

  /* Waren mit Gruppe (für HUD-Gruppierung). */
  RES: ['holz', 'bretter', 'stein', 'getreide', 'mehl', 'nahrung',
        'erz', 'kohle', 'eisen', 'golderz', 'gold',
        'axt', 'saege', 'hacke', 'sense', 'angel', 'hammer',
        'schwert', 'lanze', 'bogen', 'pferd'],
  RES_INFO: {
    holz:     { name: 'Holz',       icon: '🌲', grp: 'bau' },
    bretter:  { name: 'Bretter',    icon: '🪵', grp: 'bau' },
    stein:    { name: 'Stein',      icon: '🪨', grp: 'bau' },
    getreide: { name: 'Getreide',   icon: '🌾', grp: 'nahrung' },
    mehl:     { name: 'Mehl',       icon: '🧂', grp: 'nahrung' },
    nahrung:  { name: 'Nahrung',    icon: '🍖', grp: 'nahrung' },
    erz:      { name: 'Eisenerz',   icon: '🟤', grp: 'berg' },
    kohle:    { name: 'Kohle',      icon: '⚫', grp: 'berg' },
    eisen:    { name: 'Eisen',      icon: '🔩', grp: 'berg' },
    golderz:  { name: 'Golderz',    icon: '🟡', grp: 'berg' },
    gold:     { name: 'Gold',       icon: '🪙', grp: 'waffe' },
    axt:      { name: 'Axt',        icon: '🪓', grp: 'werkzeug' },
    saege:    { name: 'Säge',       icon: '🪚', grp: 'werkzeug' },
    hacke:    { name: 'Spitzhacke', icon: '⛏️', grp: 'werkzeug' },
    sense:    { name: 'Sense',      icon: '🌿', grp: 'werkzeug' },
    angel:    { name: 'Angel',      icon: '🎣', grp: 'werkzeug' },
    hammer:   { name: 'Hammer',     icon: '🔨', grp: 'werkzeug' },
    schwert:  { name: 'Schwert',    icon: '🗡️', grp: 'waffe' },
    lanze:    { name: 'Lanze',      icon: '🔱', grp: 'waffe' },
    bogen:    { name: 'Bogen',      icon: '🏹', grp: 'waffe' },
    pferd:    { name: 'Pferd',      icon: '🐎', grp: 'waffe' },
  },
  /* Reihenfolge/Beschriftung der HUD-Gruppen. */
  RES_GROUPS: [
    { id: 'bau',      name: 'Bau' },
    { id: 'nahrung',  name: 'Nahrung' },
    { id: 'berg',     name: 'Bergbau' },
    { id: 'werkzeug', name: 'Werkzeug' },
    { id: 'waffe',    name: 'Militär' },
  ],

  /* Startvorräte inkl. Starter-Werkzeugen, damit die erste Bauwelle nicht blockiert. */
  START_RES: {
    holz: 14, bretter: 16, stein: 12, getreide: 0, mehl: 0, nahrung: 10,
    erz: 0, kohle: 4, eisen: 2, golderz: 0, gold: 0,
    axt: 2, saege: 2, hacke: 3, sense: 2, angel: 1, hammer: 3,
    schwert: 0, lanze: 2, bogen: 0, pferd: 0,
  },
  POP_BASE: 6,                  // Wohnraum durch das Hauptquartier
  CARRIERS_BASE: 6,             // Lastenträger durch das Hauptquartier
  CARRIER_MAX: 14,              // Deckel je Spieler (Performance/Balance)

  /* Bergvorkommen (unter Bergkacheln versteckt, vom Geologen aufzudecken). */
  DEP: { STEIN: 0, EISEN: 1, KOHLE: 2, GOLD: 3 },
  DEP_INFO: {
    0: { name: 'Steinvorkommen', icon: '🪨', res: 'stein' },
    1: { name: 'Eisenvorkommen', icon: '🟤', res: 'erz' },
    2: { name: 'Kohlevorkommen', icon: '⚫', res: 'kohle' },
    3: { name: 'Goldvorkommen',  icon: '🟡', res: 'golderz' },
  },
  /* Geologe: entsendbare Figur, deckt Bergvorkommen im Radius auf. */
  GEOLOGE: { cost: { nahrung: 2 }, cooldown: 20, radius: 4, speed: 2.3, maxActive: 2 },

  /* Soldaten-Ränge durch Goldmünzen (Beförderung). Faktoren auf HP/Schaden. */
  RANKS: [
    { name: 'Rekrut',    mult: 1.0 },
    { name: 'Veteran',   mult: 1.25 },
    { name: 'Elite',     mult: 1.55 },
  ],
  PROMOTE_COST: 1,              // Gold je Rangaufstieg
  PROMOTE_CD: 4,                // Sekunden zwischen Beförderungen je Spieler

  COLORS:       ['#3f8ef3', '#e04343', '#3dbb5a', '#e0b23a'],
  COLORS_DARK:  ['#2a5da0', '#8f2c2c', '#27793a', '#94762a'],
  PLAYER_NAMES: ['Blau', 'Rot', 'Grün', 'Gelb'],

  /* Völker: Baustil (Wand-/Dachfarbe, Dachform) und Spielboni. */
  TRIBES: {
    roemer:   { name: 'Römer',    icon: '🏛️', desc: 'Baumeister: −15 % Bauzeit',
                style: { wall: '#e3d9c6', roof: '#b04a38', form: 'walm' },
                bonus: { buildTime: 0.85 } },
    wikinger: { name: 'Wikinger', icon: '🐺', desc: 'Krieger: Soldaten +20 % Stärke',
                style: { wall: '#8a6f4d', roof: '#4e5d3a', form: 'sattel' },
                bonus: { soldier: 1.2 } },
    maya:     { name: 'Maya',     icon: '🌽', desc: 'Bauern: Landwirtschaft 20 % schneller',
                style: { wall: '#c9b28a', roof: '#7d8a5a', form: 'stufen' },
                bonus: { interval: { bauernhof: 0.8, muehle: 0.8, baeckerei: 0.8 } } },
    trojaner: { name: 'Trojaner', icon: '🐴', desc: 'Verteidiger: Gebäude +25 % Lebenspunkte',
                style: { wall: '#b8b3a6', roof: '#6d7b8a', form: 'zinnen' },
                bonus: { buildingHp: 1.25 } },
    aegypter: { name: 'Ägypter',  icon: '🐪', desc: 'Steinmetze: Steinbruch 25 % schneller, Türme billiger',
                style: { wall: '#dbc48f', roof: '#c8a44e', form: 'flach' },
                bonus: { interval: { steinbruch: 0.75 },
                         cost: { wachposten: { stein: 1 }, wachturm: { stein: 1 }, festung: { stein: 2 } } } },
    chinesen: { name: 'Chinesen', icon: '🏮', desc: 'Ausbilder: Kaserne 25 % schneller',
                style: { wall: '#a63c32', roof: '#3d5a45', form: 'pagode' },
                bonus: { trainMult: 0.75 } },
    nubier:   { name: 'Nubier',   icon: '🪘', desc: 'Siedler: Türme +1 Radius, Wohnhaus billiger',
                style: { wall: '#c77f4f', roof: '#8a5a33', form: 'kuppel' },
                bonus: { claim: { wachposten: 1, wachturm: 1, festung: 1 }, cost: { wohnhaus: { bretter: 1 } } } },
  },
  TRIBE_KEYS: ['roemer', 'wikinger', 'maya', 'trojaner', 'aegypter', 'chinesen', 'nubier'],

  /* Werkzeug-Bedarf je Gebäude (tiefes Gate: ohne Werkzeug kein Arbeiter → steht still).
     Gebäude ohne Eintrag brauchen kein Werkzeug (Militär, Wohnhaus, Lager, HQ). */
  TOOL_OF: {
    holzfaeller: 'axt', saegewerk: 'saege',
    steinbruch: 'hacke', eisenmine: 'hacke', kohlemine: 'hacke',
    bauernhof: 'sense', gestuet: 'sense', fischer: 'angel',
    muehle: 'hammer', baeckerei: 'hammer', schmelze: 'hammer',
    werkzeugmacher: 'hammer', schwertschmiede: 'hammer',
    speermacher: 'hammer', bogenmacher: 'hammer',
    goldmine: 'hacke', goldschmiede: 'hammer',
  },
  TOOL_KEYS: ['axt', 'saege', 'hacke', 'sense', 'angel', 'hammer'],

  /* Gebäude. terrainNeed: {t, r} = Geländeart im Radius r nötig.
     input/output: Warenumsatz je Produktionstakt (interval Sekunden).
     military: beansprucht Land nur mit Besatzung. storage: erhöht Trägerzahl. */
  BUILDINGS: {
    hq:          { name: 'Hauptquartier', icon: '🏰', hp: 600, cost: {}, buildTime: 0, claim: 9,
                   desc: 'Zentrum deines Reiches. Hier lagern alle Waren. Verlierst du es, bist du besiegt!' },

    holzfaeller: { name: 'Holzfäller', icon: '🪓', hp: 150, cost: { bretter: 2 }, buildTime: 8,
                   interval: 5, output: { holz: 1 }, terrainNeed: { trees: true, r: 4 },
                   desc: 'Fällt Bäume im Umkreis und liefert Holz. Braucht eine Axt.' },
    saegewerk:   { name: 'Sägewerk', icon: '🪚', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 10,
                   interval: 5, input: { holz: 1 }, output: { bretter: 1 },
                   desc: 'Sägt Holz zu Brettern. Braucht eine Säge.' },
    steinbruch:  { name: 'Steinbruch', icon: '🪨', hp: 150, cost: { bretter: 2 }, buildTime: 8,
                   interval: 7, output: { stein: 1 }, terrainNeed: { t: 2, r: 4 },
                   desc: 'Bricht Steine aus nahen Bergen. Braucht eine Spitzhacke.' },
    fischer:     { name: 'Fischerhütte', icon: '🎣', hp: 150, cost: { bretter: 2 }, buildTime: 8,
                   interval: 7, output: { nahrung: 1 }, terrainNeed: { t: 1, r: 3 },
                   desc: 'Fängt Fische am Wasser. Braucht eine Angel.' },
    bauernhof:   { name: 'Bauernhof', icon: '🌾', hp: 150, cost: { bretter: 3 }, buildTime: 12,
                   interval: 8, output: { getreide: 1 },
                   desc: 'Baut Getreide auf den umliegenden Feldern an. Braucht eine Sense.' },
    muehle:      { name: 'Mühle', icon: '⚙️', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 10,
                   interval: 5, input: { getreide: 1 }, output: { mehl: 1 },
                   desc: 'Mahlt Getreide zu Mehl. Braucht einen Hammer.' },
    baeckerei:   { name: 'Bäckerei', icon: '🍞', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 10,
                   interval: 6, input: { mehl: 1 }, output: { nahrung: 2 },
                   desc: 'Backt aus Mehl nahrhaftes Brot (2 Nahrung). Braucht einen Hammer.' },

    kohlemine:   { name: 'Kohlemine', icon: '⚫', hp: 150, cost: { bretter: 3, stein: 2 }, buildTime: 12,
                   interval: 8, input: { nahrung: 1 }, output: { kohle: 1 }, terrainNeed: { t: 2, r: 2 },
                   desc: 'Fördert Kohle am Berg. Bergleute brauchen Nahrung und eine Spitzhacke.' },
    eisenmine:   { name: 'Eisenmine', icon: '⛏️', hp: 150, cost: { bretter: 3, stein: 2 }, buildTime: 12,
                   interval: 8, input: { nahrung: 1 }, output: { erz: 1 }, terrainNeed: { t: 2, r: 2 },
                   desc: 'Fördert Eisenerz am Berg. Bergleute brauchen Nahrung und eine Spitzhacke.' },
    goldmine:    { name: 'Goldmine', icon: '🟡', hp: 150, cost: { bretter: 3, stein: 3 }, buildTime: 14,
                   interval: 10, input: { nahrung: 1 }, output: { golderz: 1 },
                   terrainNeed: { t: 2, r: 2 }, needDeposit: 3,
                   desc: 'Fördert Golderz aus einem vom Geologen gefundenen Goldvorkommen. Braucht Nahrung und Spitzhacke.' },
    schmelze:    { name: 'Eisenschmelze', icon: '🔥', hp: 150, cost: { bretter: 2, stein: 3 }, buildTime: 12,
                   interval: 8, input: { erz: 1, kohle: 1 }, output: { eisen: 1 },
                   desc: 'Verhüttet Eisenerz mit Kohle zu Eisen. Braucht einen Hammer.' },
    werkzeugmacher: { name: 'Werkzeugmacher', icon: '🛠️', hp: 150, cost: { bretter: 3, stein: 2 }, buildTime: 14,
                   interval: 9, input: { eisen: 1, kohle: 1 }, makesTool: true,
                   desc: 'Fertigt Werkzeuge (Axt, Säge, Spitzhacke, Sense, Angel, Hammer) aus Eisen und Kohle.' },

    schwertschmiede: { name: 'Schwertschmiede', icon: '🗡️', hp: 150, cost: { bretter: 2, stein: 3 }, buildTime: 13,
                   interval: 9, input: { eisen: 1, kohle: 1 }, output: { schwert: 1 },
                   desc: 'Schmiedet Schwerter für Schwertkämpfer. Braucht einen Hammer.' },
    speermacher: { name: 'Lanzenschmiede', icon: '🔱', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 12,
                   interval: 8, input: { eisen: 1, holz: 1 }, output: { lanze: 1 },
                   desc: 'Fertigt Lanzen für Lanzenträger. Braucht einen Hammer.' },
    bogenmacher: { name: 'Bogenmacher', icon: '🏹', hp: 150, cost: { bretter: 2, stein: 1 }, buildTime: 11,
                   interval: 8, input: { bretter: 1, holz: 1 }, output: { bogen: 1 },
                   desc: 'Fertigt Bögen für Bogenschützen aus Holz. Braucht einen Hammer.' },
    gestuet:     { name: 'Gestüt', icon: '🐎', hp: 150, cost: { bretter: 3, stein: 1 }, buildTime: 14,
                   interval: 11, input: { getreide: 2 }, output: { pferd: 1 },
                   desc: 'Züchtet Pferde für Reiter aus Getreide. Braucht eine Sense.' },
    goldschmiede: { name: 'Goldschmiede', icon: '🪙', hp: 150, cost: { bretter: 2, stein: 3 }, buildTime: 14,
                   interval: 10, input: { golderz: 1, kohle: 1 }, output: { gold: 1 },
                   desc: 'Schmilzt Golderz mit Kohle zu Goldmünzen – befördert deine Soldaten. Braucht einen Hammer.' },

    lagerhaus:   { name: 'Lagerhaus', icon: '📦', hp: 220, cost: { bretter: 3, stein: 3 }, buildTime: 12,
                   storage: true, carriers: 4,
                   desc: 'Nimmt Waren aus der Umgebung an und stellt mehr Lastenträger (+4).' },
    wohnhaus:    { name: 'Wohnhaus', icon: '🏠', hp: 150, cost: { bretter: 3, stein: 2 }, buildTime: 10,
                   pop: 4,
                   desc: 'Bietet Wohnraum für 4 weitere Soldaten.' },

    wachposten:  { name: 'Wachposten', icon: '🚩', hp: 200, cost: { bretter: 1, stein: 2 }, buildTime: 8,
                   claim: 4, military: true, garrisonMax: 1,
                   desc: 'Kleiner Grenzposten. Beansprucht Land, sobald ein Soldat ihn besetzt.' },
    wachturm:    { name: 'Wachturm', icon: '🗼', hp: 320, cost: { bretter: 1, stein: 4 }, buildTime: 12,
                   claim: 6, military: true, garrisonMax: 2,
                   desc: 'Erweitert dein Gebiet deutlich. Braucht Besatzung (bis 2 Soldaten).' },
    festung:     { name: 'Festung', icon: '🏯', hp: 600, cost: { bretter: 3, stein: 8 }, buildTime: 20,
                   claim: 9, military: true, garrisonMax: 4,
                   desc: 'Mächtiges Bollwerk mit großem Gebiet. Bis zu 4 Soldaten Besatzung.' },

    kaserne:     { name: 'Kaserne', icon: '🛡️', hp: 250, cost: { bretter: 4, stein: 4 }, buildTime: 15,
                   trains: true,
                   desc: 'Bildet Soldaten aus (Waffe + Nahrung, braucht freien Wohnraum). Typ wählbar.' },
  },

  /* Reihenfolge in der Bauleiste. */
  BUILD_ORDER: ['holzfaeller', 'saegewerk', 'steinbruch', 'fischer', 'bauernhof', 'muehle', 'baeckerei',
                'kohlemine', 'eisenmine', 'schmelze', 'werkzeugmacher',
                'schwertschmiede', 'speermacher', 'bogenmacher', 'gestuet',
                'goldmine', 'goldschmiede',
                'lagerhaus', 'wohnhaus', 'wachposten', 'wachturm', 'festung', 'kaserne'],

  MILITARY: ['wachposten', 'wachturm', 'festung'],

  /* Soldatentypen: eigene Werte und Ausbildungskosten (Waffe + Nahrung, ggf. Pferd). */
  SOLDIERS: {
    lanze:   { name: 'Lanzenträger', short: 'Lanze', icon: '🔱', unicon: '🛡',
               hp: 55,  dmgUnit: 9,  dmgBuilding: 12, range: 1.1, aggro: 4,   speed: 2.5, cooldown: 0.8,
               train: 6,  cost: { lanze: 1, nahrung: 1 } },
    schwert: { name: 'Schwertkämpfer', short: 'Schwert', icon: '🗡️', unicon: '⚔',
               hp: 95,  dmgUnit: 15, dmgBuilding: 18, range: 1.1, aggro: 4,   speed: 2.2, cooldown: 0.85,
               train: 8,  cost: { schwert: 1, nahrung: 1 } },
    bogen:   { name: 'Bogenschütze', short: 'Bogen', icon: '🏹', unicon: '➹',
               hp: 45,  dmgUnit: 12, dmgBuilding: 6,  range: 4.6, aggro: 5.5, speed: 2.3, cooldown: 1.2,
               train: 7,  cost: { bogen: 1, nahrung: 1 } },
    reiter:  { name: 'Reiter', short: 'Reiter', icon: '🐎', unicon: '🐎',
               hp: 120, dmgUnit: 17, dmgBuilding: 14, range: 1.2, aggro: 5,   speed: 3.7, cooldown: 0.8,
               train: 11, cost: { schwert: 1, pferd: 1, nahrung: 1 } },
  },
  SOLDIER_KEYS: ['lanze', 'schwert', 'bogen', 'reiter'],
  /* Rückfall-Werte (Altstände / generische Nutzung). */
  SOLDIER: { hp: 60, dmgUnit: 10, dmgBuilding: 14, range: 1.1, aggro: 4, speed: 2.4, cooldown: 0.8 },

  DIFF: {
    leicht: { name: 'Leicht', prodMult: 0.8,  resMult: 1.0, attackN: 10, attackCd: 210, thinkCd: 3.0 },
    mittel: { name: 'Mittel', prodMult: 1.0,  resMult: 1.5, attackN: 7,  attackCd: 130, thinkCd: 2.2 },
    schwer: { name: 'Schwer', prodMult: 1.3,  resMult: 2.0, attackN: 5,  attackCd: 80,  thinkCd: 1.5 },
  },
};
