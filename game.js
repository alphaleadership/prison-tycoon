// ─── State ───────────────────────────────────────────────────────────────────
const GRID_COLS = 10, GRID_ROWS = 8;
const state = {
  money: 10000,
  day: 1,
  reputation: 50,
  cells: Array(GRID_COLS * GRID_ROWS).fill('empty'), // grid cell types
  prisoners: [],
  paused: true,
  selectedBuild: 'cell-room',
  selectedCost: 500,
  tickInterval: null,
  nextId: 1,
  creative: false,
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const grid = $('grid');

// ─── Grid rendering ──────────────────────────────────────────────────────────
const ICONS = { empty: '', 'cell-room': '🛏', 'cell-canteen': '🍽', 'cell-yard': '🌿', 'cell-office': '🗂', 'cell-infirmary': '🏥', 'cell-gym': '🏋️', 'cell-workshop': '🔧', 'cell-tower': '🗼' };

function buildGrid() {
  grid.innerHTML = '';
  state.cells.forEach((type, i) => {
    const div = document.createElement('div');
    div.className = `cell ${type}`;
    div.dataset.idx = i;
    div.textContent = ICONS[type] || '';
    // show occupants
    const occ = state.prisoners.filter(p => p.cellIdx === i).length;
    if (occ > 0) div.textContent += `\n${occ}👤`;
    div.addEventListener('click', () => onCellClick(i));
    grid.appendChild(div);
  });
}

function refreshCell(i) {
  const div = grid.children[i];
  const type = state.cells[i];
  div.className = `cell ${type}`;
  const occ = state.prisoners.filter(p => p.cellIdx === i).length;
  div.textContent = (ICONS[type] || '') + (occ > 0 ? `\n${occ}👤` : '');
}

// ─── Stats UI ────────────────────────────────────────────────────────────────
function updateStats() {
  $('stat-money').textContent = state.creative ? '∞' : `$${state.money.toLocaleString()}`;
  $('stat-prisoners').textContent = state.prisoners.length;
  $('stat-capacity').textContent = capacity();
  $('stat-rep').textContent = state.reputation;
  $('stat-day').textContent = state.day;
}

function capacity() {
  return state.cells.filter(c => c === 'cell-room').length * (hasResearch('max_security') ? 6 : 2);
}

// ─── Log ─────────────────────────────────────────────────────────────────────
function log(msg) { $('log').textContent = msg; }

// ─── Build panel ─────────────────────────────────────────────────────────────
document.querySelectorAll('.build-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.selectedBuild = btn.dataset.type;
    state.selectedCost = parseInt(btn.dataset.cost);
  });
});

function onCellClick(i) {
  const type = state.selectedBuild;
  const cost = Math.floor(state.selectedCost * researchBuildCostMult());
  if (state.cells[i] === type) return;
  if (!state.creative && state.money < cost) { log('❌ Pas assez d\'argent !'); return; }
  // Evict prisoners from demolished cells
  if (type === 'empty' && state.cells[i] === 'cell-room') {
    state.prisoners.filter(p => p.cellIdx === i).forEach(p => p.cellIdx = -1);
  }
  state.cells[i] = type;
  if (!state.creative) state.money -= cost;
  refreshCell(i);
  updateStats();
  log(`✅ ${btn_label(type)} construit pour $${cost}`);
}

function btn_label(type) {
  return { 'cell-room': 'Cellule', 'cell-canteen': 'Cantine', 'cell-yard': 'Cour', 'cell-office': 'Bureau',
           'cell-infirmary': 'Infirmerie', 'cell-gym': 'Salle de sport', 'cell-workshop': 'Atelier', 'cell-tower': 'Tour de garde', empty: 'Démoli' }[type];
}

// Buildings that require a research to be unlocked
const LOCKED_BUILDINGS = [
  { type: 'cell-infirmary', cost: 1500, requires: 'build_infirmary' },
  { type: 'cell-gym',       cost: 1200, requires: 'build_gym' },
  { type: 'cell-workshop',  cost: 2000, requires: 'build_workshop' },
  { type: 'cell-tower',     cost: 1800, requires: 'build_tower' },
];

function renderBuildPanel() {
  const panel = document.getElementById('build-panel');
  // Remove previously added unlocked buttons
  panel.querySelectorAll('.build-btn.unlocked').forEach(b => b.remove());
  LOCKED_BUILDINGS.forEach(({ type, cost, requires }) => {
    if (!hasResearch(requires)) return;
    if (panel.querySelector(`[data-type="${type}"]`)) return;
    const btn = document.createElement('button');
    btn.className = 'build-btn unlocked';
    btn.dataset.type = type;
    btn.dataset.cost = cost;
    btn.textContent = `${ICONS[type]} ${btn_label(type)} — $${cost.toLocaleString()}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedBuild = type;
      state.selectedCost = cost;
    });
    // insert before demolish button
    const demolish = panel.querySelector('[data-type="empty"]');
    panel.insertBefore(btn, demolish);
  });
}

// ─── Prisoners ───────────────────────────────────────────────────────────────
const NAMES = ['Dupont', 'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Simon', 'Laurent', 'Garcia'];

function admitPrisoner() {
  if (state.prisoners.length >= capacity()) { log('❌ Capacité maximale atteinte !'); return; }
  const rooms = state.cells.map((c, i) => ({ c, i })).filter(({ c }) => c === 'cell-room');
  // pick room with fewest occupants
  const room = rooms.sort((a, b) =>
    state.prisoners.filter(p => p.cellIdx === b.i).length -
    state.prisoners.filter(p => p.cellIdx === a.i).length
  ).pop();
  const p = {
    id: state.nextId++,
    name: NAMES[Math.floor(Math.random() * NAMES.length)] + ' #' + state.nextId,
    happiness: 70 + Math.floor(Math.random() * 20),
    hunger: 80 + Math.floor(Math.random() * 20),
    cellIdx: room.i,
    daysLeft: 10 + Math.floor(Math.random() * 20),
  };
  state.prisoners.push(p);
  state.money += 300; // daily subsidy advance
  updateStats();
  renderPrisoners();
  refreshCell(room.i);
  log(`🔒 ${p.name} admis (cellule ${room.i + 1})`);
}

function renderPrisoners() {
  const list = $('prisoner-list');
  $('no-prisoners').style.display = state.prisoners.length ? 'none' : 'block';
  list.innerHTML = state.prisoners.map(p => `
    <div class="prisoner-card">
      <div class="name">👤 ${p.name} — J${p.daysLeft}</div>
      <div>😊 Bonheur
        <div class="bar-wrap"><div class="bar happiness" style="width:${p.happiness}%"></div></div>
      </div>
      <div>🍞 Faim
        <div class="bar-wrap"><div class="bar hunger" style="width:${p.hunger}%"></div></div>
      </div>
    </div>`).join('');
}

// ─── Tick / game loop ────────────────────────────────────────────────────────
function tick() {
  state.day++;
  const hasCanteen = state.cells.includes('cell-canteen');
  const hasYard = state.cells.includes('cell-yard');

  let income = 0;
  let repDelta = 0;
  const released = [];

  state.prisoners.forEach(p => {
    p.hunger = Math.max(0, p.hunger - (hasCanteen ? 5 : 15) * researchHungerRate());
    p.happiness = Math.max(0, p.happiness - (hasYard ? 3 : 10) * researchHappinessRate() + (hasCanteen ? 3 : 0));
    p.daysLeft--;
    income += Math.round(200 * researchIncomeMultiplier());

    if (p.daysLeft <= 0) released.push(p);
    if (p.happiness < 20) repDelta -= 2;
    if (p.hunger < 20) repDelta -= 3;
  });

  // Release prisoners whose sentence is done
  released.forEach(p => {
    state.prisoners = state.prisoners.filter(x => x.id !== p.id);
    if (p.cellIdx >= 0) refreshCell(p.cellIdx);
    log(`🔓 ${p.name} libéré !`);
    repDelta += 5 + researchReleaseRep();
  });

  // Daily rep bonus from surveillance
  repDelta += researchRepBonus();

  // Office bonus
  const offices = state.cells.filter(c => c === 'cell-office').length;
  income += offices * 150;

  // New building bonuses
  const infirmaries = state.cells.filter(c => c === 'cell-infirmary').length;
  const gyms        = state.cells.filter(c => c === 'cell-gym').length;
  const workshops   = state.cells.filter(c => c === 'cell-workshop').length;
  const towers      = state.cells.filter(c => c === 'cell-tower').length;
  if (infirmaries) state.prisoners.forEach(p => { p.happiness = Math.min(100, p.happiness + infirmaries * 15); });
  if (gyms)        state.prisoners.forEach(p => { p.happiness = Math.min(100, p.happiness + gyms * 10); });
  income  += workshops * 300;
  repDelta += towers * 3;

  // Daily costs
  const cost = state.prisoners.length * 50 + (state.cells.filter(c => c !== 'empty').length * 20);
  if (!state.creative) {
    state.money += income - cost;
    state.reputation = Math.max(0, Math.min(100, state.reputation + repDelta));
    if (state.money < 0) {
      log('💸 Banqueroute ! Jeu terminé.');
      clearInterval(state.tickInterval);
      state.paused = true;
      $('btn-pause').textContent = '▶ Reprendre';
      $('btn-pause').classList.remove('active');
    }
  } else {
    state.reputation = Math.min(100, state.reputation + repDelta);
  }

  updateStats();
  renderPrisoners();
  if (!log.locked) log(`📅 Jour ${state.day} — Revenus: +$${income} / Coûts: -$${cost}`);

  // Auto admission
  if (hasResearch('auto_admission') && state.prisoners.length < capacity()) admitPrisoner();
}

// ─── Research tree ───────────────────────────────────────────────────────────
const RESEARCH = [
  // Tier 1
  { id: 'basic_security',  tier: 1, icon: '🔒', name: 'Sécurité de base',    desc: '+10% revenus par prisonnier',     cost: 1500, requires: [] },
  { id: 'basic_food',      tier: 1, icon: '🥗', name: 'Alimentation amél.',  desc: 'Faim -30% plus lente',            cost: 1200, requires: [] },
  // Tier 2
  { id: 'surveillance',    tier: 2, icon: '📷', name: 'Vidéosurveillance',   desc: '+20% revenus, +1 rep/jour',       cost: 3000, requires: ['basic_security'] },
  { id: 'rehab',           tier: 2, icon: '📚', name: 'Réhabilitation',      desc: 'Bonheur -50% plus lent',          cost: 2500, requires: ['basic_food'] },
  { id: 'automation',      tier: 2, icon: '🤖', name: 'Automatisation',      desc: 'Coûts bâtiments -50%',            cost: 3500, requires: ['basic_security'] },
  // Tier 3
  { id: 'max_security',    tier: 3, icon: '🏰', name: 'Haute sécurité',      desc: 'Capacité cellules x3',            cost: 6000, requires: ['surveillance', 'automation'] },
  { id: 'prison_reform',   tier: 3, icon: '⚖️',  name: 'Réforme pénitent.',  desc: '+5 rep par libération',           cost: 5000, requires: ['rehab'] },
  { id: 'smart_prison',    tier: 3, icon: '💡', name: 'Prison intelligente', desc: 'Tous les bonus précédents x1.5',  cost: 8000, requires: ['max_security', 'prison_reform'] },
  { id: 'auto_admission',  tier: 3, icon: '🚌', name: 'Admission automatique', desc: 'Admet un prisonnier chaque jour si places dispo', cost: 4000, requires: ['basic_security'] },
  // Building unlocks
  { id: 'build_infirmary', tier: 2, icon: '🏥', name: 'Infirmerie',           desc: 'Débloque l\'infirmerie — récupère +15 bonheur/j', cost: 2000, requires: ['basic_food'] },
  { id: 'build_gym',       tier: 2, icon: '🏋️', name: 'Salle de sport',      desc: 'Débloque la salle de sport — +10 bonheur/j',      cost: 1800, requires: ['basic_food'] },
  { id: 'build_workshop',  tier: 3, icon: '🔧', name: 'Atelier',             desc: 'Débloque l\'atelier — +$300 revenus/j',           cost: 4500, requires: ['automation'] },
  { id: 'build_tower',     tier: 2, icon: '🗼', name: 'Tour de garde',       desc: 'Débloque la tour — +3 rep/j, -10% évasions',      cost: 2200, requires: ['basic_security'] },
];

// unlocked set lives in state
state.unlocked = new Set();

function hasResearch(id) { return state.unlocked.has(id); }

function renderResearch() {
  const tiers = [1, 2, 3];
  $('research-tree').innerHTML = tiers.map(t => {
    const nodes = RESEARCH.filter(r => r.tier === t);
    return `<div class="research-tier">
      <h3>Niveau ${t}</h3>
      <div class="research-row">${nodes.map(r => {
        const done = hasResearch(r.id);
        const locked = !done && r.requires.some(req => !hasResearch(req));
        return `<div class="rcard ${done ? 'done' : locked ? 'locked' : ''}" data-id="${r.id}">
          <div class="ricon">${r.icon}</div>
          <div class="rname">${r.name}</div>
          <div class="rdesc">${r.desc}</div>
          <div class="rcost">${done ? '✅ Acquis' : locked ? '🔒 Verrouillé' : `$${r.cost.toLocaleString()}`}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('');

  // attach click handlers
  document.querySelectorAll('.rcard:not(.done):not(.locked)').forEach(card => {
    card.addEventListener('click', () => buyResearch(card.dataset.id));
  });
}

function buyResearch(id) {
  const r = RESEARCH.find(x => x.id === id);
  if (!r || hasResearch(id)) return;
  if (!state.creative && state.money < r.cost) { log(`❌ Pas assez d'argent pour ${r.name}`); return; }
  if (!state.creative) state.money -= r.cost;
  state.unlocked.add(id);
  updateStats();
  renderBuildPanel();
  renderResearch();
  log(`🔬 Recherche "${r.name}" débloquée !`);
}

// Research effect helpers (used in tick & capacity)
function researchIncomeMultiplier() {
  let m = 1;
  if (hasResearch('basic_security')) m += 0.10;
  if (hasResearch('surveillance'))   m += 0.20;
  if (hasResearch('smart_prison'))   m *= 1.5;
  return m;
}
function researchHungerRate()    { return (hasResearch('basic_food') ? 0.7 : 1) * (hasResearch('smart_prison') ? 0.67 : 1); }
function researchHappinessRate() { return (hasResearch('rehab')      ? 0.5 : 1) * (hasResearch('smart_prison') ? 0.67 : 1); }
function researchBuildCostMult() { return hasResearch('automation') ? 0.5 : 1; }
function researchRepBonus()      { return (hasResearch('surveillance') ? 1 : 0) + (hasResearch('smart_prison') ? 1 : 0); }
function researchReleaseRep()    { return hasResearch('prison_reform') ? 5 : 0; }

// ─── Controls ─────────────────────────────────────────────────────────────────
$('btn-admit').addEventListener('click', admitPrisoner);

$('btn-pause').addEventListener('click', () => {
  state.paused = !state.paused;
  const btn = $('btn-pause');
  if (state.paused) {
    clearInterval(state.tickInterval);
    btn.textContent = '▶ Jouer';
    btn.classList.remove('active');
    log('⏸ Jeu en pause');
  } else {
    state.tickInterval = setInterval(tick, 2000);
    btn.textContent = '⏸ Pause';
    btn.classList.add('active');
    log('▶ Jeu en cours...');
  }
});

$('btn-creative').addEventListener('click', () => {
  state.creative = !state.creative;
  const btn = $('btn-creative');
  btn.classList.toggle('active', state.creative);
  if (state.creative) {
    state.money = Infinity;
    $('stat-money').textContent = '∞';
    log('🎨 Mode créatif activé — construction gratuite, pas de faillite');
  } else {
    state.money = 10000;
    log('🎮 Mode normal activé');
  }
  updateStats();
});

$('btn-research').addEventListener('click', () => {
  renderResearch();
  $('research-modal').classList.add('open');
});
$('research-close').addEventListener('click', () => $('research-modal').classList.remove('open'));
$('research-modal').addEventListener('click', e => { if (e.target === $('research-modal')) $('research-modal').classList.remove('open'); });

// ─── Save / Load ─────────────────────────────────────────────────────────────
function saveGame() {
  const data = {
    money: state.money,
    day: state.day,
    reputation: state.reputation,
    cells: state.cells,
    prisoners: state.prisoners,
    nextId: state.nextId,
    creative: state.creative,
    unlocked: [...state.unlocked],
  };
  window.api.save(data).then(p => log(`💾 Sauvegardé → ${p}`));
}

async function loadGame() {
  const data = await window.api.load();
  if (!data) return false;
  state.money      = data.money;
  state.day        = data.day;
  state.reputation = data.reputation;
  state.cells      = data.cells;
  state.prisoners  = data.prisoners;
  state.nextId     = data.nextId;
  state.creative   = data.creative;
  state.unlocked   = new Set(data.unlocked);
  return true;
}

$('btn-save').addEventListener('click', saveGame);

// ─── Init ────────────────────────────────────────────────────────────────────
loadGame().then(loaded => {
  buildGrid();
  updateStats();
  renderPrisoners();
  renderBuildPanel();
  if (loaded) {
    if (state.creative) { $('btn-creative').classList.add('active'); state.money = Infinity; updateStats(); }
    log(`💾 Partie chargée — Jour ${state.day}`);
  }
});
