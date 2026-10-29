// Marathon 27 · suivi de prépa. Site statique, progression en localStorage.
const KEY = 'marathon27:v1';
// Lien de lecture seule : ?lecture=CODE. On affiche la progression partagée, sans jamais rien écrire.
const SHARE = (location.pathname.match(/^\/suivi\/([A-Za-z0-9-]{16,64})\/?$/) || [])[1] || new URLSearchParams(location.search).get('lecture');
const READONLY = !!SHARE;
const RACE = '2027-04-04';
const $ = (s, el = document) => el.querySelector(s);

const TYPES = {
  renfo:       { label: 'Renfo',            cls: 't-renfo' },
  run_easy:    { label: 'Footing facile',   cls: 't-easy' },
  run_quality: { label: 'Séance soutenue',  cls: 't-quality' },
  run_long:    { label: 'Sortie longue',    cls: 't-long' },
  race:        { label: 'Marathon',         cls: 't-race' },
  rest:        { label: 'Repos',            cls: 't-rest' },
};
const KNEE = { ras: 'RAS', gene: 'Gêne', douleur: 'Douleur' };
const HOURS = { lun: [12, 0], mer: [12, 0], ven: [19, 0], dim: [9, 0] };

/* ---------- Icônes ---------- */
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 19v-5M10 19V9M15 19v-8M20 19V5"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 3l10 18H2z" stroke-linejoin="round"/><path d="M12 10v5M12 18v.5"/></svg>',
};
const NAV = [
  ['today', 'Aujourd’hui', I.today],
  ['plan', 'Plan', I.plan],
  ['profile', 'Profil', I.profile],
  ['more', 'Plus', I.more],
];

/* ---------- Dates (Europe/Paris, chaînes AAAA-MM-JJ) ---------- */
const ms = s => Date.parse(s + 'T00:00:00Z');
const diffDays = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);
const addDays = (s, n) => new Date(ms(s) + n * 864e5).toISOString().slice(0, 10);
const fmtDate = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' }).format(new Date(ms(s)));
function todayStr() {
  const q = new URLSearchParams(location.search).get('date');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q; // simulation : ?date=2027-01-22
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}
const fmtDur = m => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`);

/* ---------- Données et état ---------- */
let PLAN, SESSIONS, WEEKS;
// u : date de dernière modification par séance (synchro) · ex : séries de renfo cochées · seen : bilans vus · adj : plafonds appliqués après un bilan
const emptyState = () => ({ done: {}, skipped: {}, u: {}, ex: {}, wt: {}, seen: {}, adj: {} });
let state = emptyState();
let TODAY = todayStr();

function load() {
  if (READONLY) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { state = normalize(JSON.parse(raw)); rebuild(); }
  } catch (e) { /* stockage indisponible : on continue en mémoire */ }
}
function save() {
  if (READONLY) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
  schedulePush();
}
const touch = id => { state.u[id] = Date.now(); };
function normalize(o) {
  const ids = new Set(SESSIONS ? SESSIONS.map(s => s.id) : []);
  const r = { done: {}, skipped: {}, u: {} };
  for (const [id, v] of Object.entries((o && o.done) || {})) {
    if (!ids.size || ids.has(id)) { r.done[id] = { t: v.t || null, knee: KNEE[v.knee] ? v.knee : null }; const st = cleanStats(v.stats); if (st) r.done[id].stats = st; if (v.parts && typeof v.parts === 'object' && (v.parts.run === false || v.parts.renfo === false)) r.done[id].parts = { run: v.parts.run !== false, renfo: v.parts.renfo !== false }; if (typeof v.where === 'string' && v.where.trim() && r.done[id].knee && r.done[id].knee !== 'ras') r.done[id].where = v.where.trim().slice(0, 80); }
  }
  for (const id of Object.keys((o && o.skipped) || {})) if (!ids.size || ids.has(id)) r.skipped[id] = true;
  const u = (o && o.u) || {};
  for (const id of new Set([...Object.keys(r.done), ...Object.keys(r.skipped), ...Object.keys(u)])) {
    if (ids.size && !ids.has(id)) continue;
    const t = r.done[id] && Date.parse(r.done[id].t);
    r.u[id] = Number(u[id]) || (Number.isFinite(t) ? t : 0);
  }
  r.ex = {};
  for (const [id, arr] of Object.entries((o && o.ex) || {})) if ((!ids.size || ids.has(id)) && Array.isArray(arr)) r.ex[id] = arr.slice(0, 12).map(n => Math.max(0, Math.min(9, Math.floor(Number(n)) || 0)));
  r.wt = {};
  for (const [id, w] of Object.entries((o && o.wt) || {})) {
    if (!((!ids.size || ids.has(id)) && w && typeof w === 'object')) continue;
    const c = {};
    for (const [k, v] of Object.entries(w)) { const x = Number(v); if (k.length <= 60 && Number.isFinite(x) && x > 0 && x <= 500) c[k] = x; }
    if (Object.keys(c).length) r.wt[id] = c;
  }
  r.seen = {};
  for (const n of Object.keys((o && o.seen) || {})) if (/^\d{1,2}$/.test(n)) r.seen[n] = true;
  r.adj = {};
  for (const [n, v] of Object.entries((o && o.adj) || {})) {
    if (!/^\d{1,2}$/.test(n) || !v) continue;
    const m = {};
    for (const d of ['mer', 'ven', 'dim']) { const x = Number(v.m && v.m[d]); if (Number.isFinite(x) && x >= 5 && x <= 400) m[d] = Math.round(x); }
    r.adj[n] = { t: Number(v.t) || 0, m };
  }
  return r;
}
// Stats saisies à la main (distance, durée, allure, fréquence cardiaque, note)
function cleanStats(o) {
  if (!o || typeof o !== 'object') return null;
  const r = {};
  for (const k of ['km', 'min', 'hr']) { const n = Number(o[k]); if (Number.isFinite(n) && n > 0 && n < 1000) r[k] = n; }
  if (typeof o.pace === 'string' && /^\d{1,2}:\d{2}$/.test(o.pace.trim())) r.pace = o.pace.trim();
  if (typeof o.note === 'string' && o.note.trim()) r.note = o.note.trim().slice(0, 500);
  return Object.keys(r).length ? r : null;
}
const num = v => Number(String(v || '').trim().replace(',', '.'));
const fmtPace = sec => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const paceOf = st => st && (st.pace || (st.km && st.min ? fmtPace((st.min * 60) / st.km) : null));
const fmtKm = km => String(Math.round(km * 100) / 100).replace('.', ',');
function statsLine(id) {
  const st = state.done[id] && state.done[id].stats; if (!st) return '';
  const p = paceOf(st);
  return [st.km && `${fmtKm(st.km)} km`, st.min && `${fmtMin(st.min)}`, p && `${p}/km`, st.hr && `${st.hr} bpm`].filter(Boolean).join(' · ');
}
const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m * 10) / 10} min`.replace('.', ','));
const totalKm = () => Object.values(state.done).reduce((a, d) => a + ((d.stats && d.stats.km) || 0), 0);
const isRun = s => ['run_easy', 'run_quality', 'run_long', 'race'].includes(s.type);

// Fusion : pour chaque séance, la modification la plus récente gagne (une annulation compte comme une modification).
function mergeStates(a, b) {
  const r = { done: {}, skipped: {}, u: {}, ex: {}, wt: {}, seen: { ...a.seen, ...b.seen }, adj: {} };
  for (const n of new Set([...Object.keys(a.adj || {}), ...Object.keys(b.adj || {})])) {
    const x = (a.adj || {})[n], y = (b.adj || {})[n];
    r.adj[n] = x && (!y || x.t >= y.t) ? x : y;
  }
  for (const id of new Set([...Object.keys(a.u), ...Object.keys(b.u)])) {
    const src = (a.u[id] || 0) >= (b.u[id] || 0) ? a : b;
    r.u[id] = src.u[id] || 0;
    if (src.done[id]) r.done[id] = { ...src.done[id] };
    else if (src.skipped[id]) r.skipped[id] = true;
    if (src.ex && src.ex[id]) r.ex[id] = [...src.ex[id]];
    if (src.wt && src.wt[id]) r.wt[id] = { ...src.wt[id] };
  }
  return r;
}

const counts = s => s.type !== 'rest';
const isDone = id => !!state.done[id];

/* ---------- Règles du plan ---------- */
// Point de décision (semaine 22) : un genou a protesté en semaine 21 ou 22 => pic ramené au niveau de la semaine 22.
function peakReduced() {
  return [21, 22].some(n => WEEKS[n - 1].sessions.some(s => state.done[s.id] && ['gene', 'douleur'].includes(state.done[s.id].knee)));
}
function minutesOf(s) {
  if (s.id === 'w23-dim' && peakReduced()) return WEEKS[21].sessions.find(x => x.day === 'dim').minutes;
  return s.minutes;
}
function titleOf(s) {
  return s.type === 'run_long' && s.id === 'w23-dim' ? `Sortie longue ${fmtDur(minutesOf(s)).replace(' min', ' min')}` : s.title;
}
function kneeAlert() {
  // Séances avec un ressenti noté, dans l'ordre : on regarde les deux dernières.
  const seq = SESSIONS.filter(s => state.done[s.id] && state.done[s.id].knee).sort((a, b) => a.date.localeCompare(b.date));
  const k = seq.length && state.done[seq[seq.length - 1].id].knee;
  if (k === 'douleur') return 'douleur';
  if (k === 'gene' && seq.length > 1 && state.done[seq[seq.length - 2].id].knee === 'gene') return 'gene2';
  return null;
}
const weekOf = date => WEEKS.find(w => date >= w.start && date <= addDays(w.start, 6));
function currentWeek() {
  if (TODAY <= WEEKS[0].start) return WEEKS[0];
  return weekOf(TODAY) || WEEKS[WEEKS.length - 1];
}
const weekStats = w => {
  const list = w.sessions.filter(counts);
  return { done: list.filter(s => isDone(s.id)).length, total: list.length };
};
const totalStats = () => ({ done: SESSIONS.filter(counts).filter(s => isDone(s.id)).length, total: SESSIONS.filter(counts).length });

/* ---------- Messages d'encouragement ---------- */
const hash = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (list, seed) => list[hash(seed) % list.length];
const MSG = {
  first: ['Première séance validée. Le plus dur, c’est de commencer, et c’est fait.', 'C’est parti. 102 séances à aller chercher, une à la fois.'],
  renfo: ['Les genoux te disent merci. Le renfo, c’est ce qui te fait arriver au départ.', 'Séance de renfo faite. Personne ne la voit sur Strava, tes genoux oui.', 'Solide. Ces séances-là protègent plus qu’un kilomètre de plus.'],
  easy: ['Facile et régulier, c’est exactement ça. Bien joué.', 'Sortie validée. Tu as gardé de la marge, c’est l’idée.', 'Une de plus dans les jambes. La régularité fait tout le travail.', 'Bien. Tu pouvais parler en phrases complètes ? Alors c’était parfait.'],
  quality: ['Bloc soutenu terminé, avec le contrôle. Belle séance.', 'Tu as touché l’effort sans te cramer. C’est ça, la bonne séance.', 'Ce genre de séance prépare la course, et tu l’as faite proprement.'],
  long: ['Sortie longue dans la poche. C’est la séance qui compte le plus, bravo.', 'Dimanche validé. Tu construis ton marathon, minute après minute.', 'Belle sortie. Maintenant récupère : mange, bois, étire-toi doucement.', 'Les minutes de marche font partie du plan. Sortie réussie.'],
  longBig: ['Plus de deux heures sur les jambes. Tu es en train de devenir quelqu’un qui court un marathon.', 'Longue sortie, grosse sortie. Prends le temps de bien récupérer.'],
  peak: ['Le pic de la prépa est derrière toi. Maintenant on laisse le corps absorber.', 'Trois heures, ou presque. Tu peux être fier·e : le plus dur est fait.'],
  week: ['Semaine bouclée, 4 sur 4. Profite de ton repos, il fait partie du plan.', 'Les quatre séances sont faites. Régularité parfaite.'],
  deload: ['Semaine allégée respectée : c’est là que le corps progresse.', 'Lever le pied au bon moment, c’est aussi s’entraîner.'],
  gene: ['Merci d’avoir noté la gêne. Écouter ses genoux, c’est le meilleur réflexe.'],
  douleur: ['Bien d’avoir noté la douleur. Ton corps parle, tu l’écoutes : c’est la bonne décision.'],
  taper: ['On affûte : moins de volume, plus de fraîcheur. Fais confiance au travail déjà fait.'],
  race: ['Tu es marathonien·ne. Quatre mois de prépa, sans te blesser. Chapeau.'],
};
const MILES = { 25: 'Un quart du plan validé.', 50: 'La moitié du plan est derrière toi.', 75: 'Trois quarts validés. La ligne d’arrivée se rapproche.' };
function cheerFor(s) {
  const t = totalStats();
  const wk = weekOf(s.date);
  const seed = s.id;
  const k = state.done[s.id] && state.done[s.id].knee;
  const parts = [];
  if (k === 'douleur') parts.push(pick(MSG.douleur, seed));
  else if (k === 'gene') parts.push(pick(MSG.gene, seed));
  else if (s.type === 'race') parts.push(pick(MSG.race, seed));
  else if (t.done === 1) parts.push(pick(MSG.first, seed));
  else if (s.type === 'run_long' && minutesOf(s) >= 175) parts.push(pick(MSG.peak, seed));
  else if (s.type === 'run_long' && minutesOf(s) >= 120) parts.push(pick(MSG.longBig, seed));
  else if (wk.allegee) parts.push(pick(MSG.deload, seed));
  else if (wk.phase === 'Affûtage' && s.type !== 'race') parts.push(pick(MSG.taper, seed));
  else parts.push(pick(MSG[{ renfo: 'renfo', run_easy: 'easy', run_quality: 'quality', run_long: 'long' }[s.type]] || MSG.easy, seed));
  const ws = weekStats(wk);
  if (ws.done === ws.total && s.type !== 'race') parts.push(pick(MSG.week, seed + 'w'));
  const pct = Math.floor((t.done / t.total) * 100);
  const prevPct = Math.floor(((t.done - 1) / t.total) * 100);
  for (const m of [25, 50, 75]) if (pct >= m && prevPct < m) parts.push(MILES[m]);
  return parts.join(' ');
}
const SKIP_MSG = [
  'Pas grave. Une séance ratée ne se rattrape pas : on reprend à la prochaine.',
  'Ça arrive. Le plan est fait pour absorber ça, on ne compense rien.',
  'Journée chargée, c’est la vie. Repose-toi, on repart à la prochaine séance.',
  'Tu as bien fait de lever le pied. La régularité sur la durée, pas sur un jour.',
];
const DAILY = [
  'Une séance à la fois. Pas besoin d’en faire plus.',
  'Tu avances à ton rythme, et c’est le bon.',
  'Arriver au départ en forme, c’est déjà gagner.',
  'Facile, c’est facile. Garde de la marge.',
];

/* ---------- Renfo A : toutes les séries d'un exercice, puis on passe au suivant ---------- */
// Renfo A : une séance sur deux, montée sur marche basse (semaines impaires) ou fentes bulgares (semaines paires).
const EXO_STEP = ['Montée sur marche basse', '8 par jambe, marche de 15 à 20 cm, bassin stable', null, true];
const EXO_BULG = ['Fentes bulgares', '8 par jambe, pied arrière sur un banc, genou à 90° maximum, descente contrôlée', null, true];
const EXO_ALT = ['Montée sur marche basse ou fentes bulgares', 'une séance sur deux, en alternance : 8 par jambe, genou à 90° maximum'];
const exosFor = s => {
  const wk = s.id ? +s.id.slice(1, 3) : 0;
  const alt = !wk ? EXO_ALT : wk % 2 ? EXO_STEP : EXO_BULG;
  return [
    ['Presse à cuisses', '10 à 12 répétitions, charge modérée, genoux à 90° max', null, true],
    ['Curl ischios', '10 à 12 répétitions, montée 2 s, descente 3 s', null, true],
    alt,
    ['Hip thrust à la machine', '12 répétitions, tu augmentes la charge petit à petit', null, true],
    ['Mollets debout', '15 répétitions', null, true],
    ['Gainage', 'planche, puis planche latérale de chaque côté', [['Planche', 30], ['Latérale', 20]]],
  ];
};
const setsOf = s => (s.title.match(/(\d) séries/) || [])[1] ? +s.title.match(/(\d) séries/)[1] : 1; // « léger » : 1 série
const exoList = s => `<ol class="exos">${exosFor(s).map(([n, d]) => `<li><b>${setsOf(s)} × ${n}</b><span>${d}</span></li>`).join('')}</ol>`;

/* ---------- Conseils par type ---------- */
function tipOf(s) {
  const m = minutesOf(s);
  switch (s.type) {
    case 'run_easy': return s.title.includes('très facile')
      ? 'Très facile, pour garder des jambes fraîches. Pente 1 % sur le tapis.'
      : 'Allure facile : tu peux parler en phrases complètes. 6:45 à 7:15 au km, 8,3 à 8,9 km/h, pente 1 %.';
    case 'run_quality': return 'Échauffement tranquille, puis les blocs à l’effort « par bribes » (5:55 à 6:10 au km, 9,7 à 10,1 km/h) ou à l’allure marathon (≈ 6:25, 9,3 km/h). Retour au calme facile.';
    case 'run_long': return m > 60
      ? 'Allure facile. Marche 1 min toutes les 10 à 15 min : c’est prévu, ça fait partie du plan. Chemin ou terre si possible.'
      : 'Allure facile, sur chemin ou terre si possible. Tu t’arrêtes là où le plan s’arrête.';
    case 'renfo': return s.day === 'lun'
      ? 'À la salle. Garde 2 répétitions en réserve : pas besoin d’aller jusqu’au bout. Un genou à plus de 3/10 ou un ménisque qui bloque : tu arrêtes l’exercice.'
      : '';
    case 'race': return 'Pars plus lent que ton allure marathon. Marche 1 min toutes les 10 à 15 min si besoin. Rien de nouveau le jour J.';
    default: return '';
  }
}

/* ---------- Rendu : briques ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kneeTag = id => {
  const k = state.done[id] && state.done[id].knee;
  return k ? `<span class="knee-tag ${k}" role="img" aria-label="Genoux : ${KNEE[k]}">${KNEE[k]}</span>` : '';
};
const partsLine = id => { const p = state.done[id] && state.done[id].parts; return p && !(p.run && p.renfo) ? `<span class="stats-line">${p.run ? 'Course seule' : 'Renfo seul'}</span>` : ''; };
const rowText = (s, skipped) => `<span class="when">${fmtDate(s.date)} · ${s.place}${skipped ? ' · passée' : ''}</span><span class="what">${esc(titleOf(s))}</span>`;
function sessionRow(s, opts = {}) {
  const t = TYPES[s.type];
  const done = isDone(s.id);
  if (s.type === 'rest') {
    return `<div class="row"><span class="stripe t-rest"></span><div><div class="when">${fmtDate(s.date)}</div><div class="what">Repos. Rien à faire.</div></div><span></span></div>`;
  }
  const skipped = state.skipped[s.id];
  const d = state.done[s.id] || {};
  const where = d.where ? `<span class="stats-line where-line">${KNEE[d.knee]} : ${esc(d.where)}</span>` : '';
  const note = READONLY && d.stats && d.stats.note ? `<span class="stats-line">« ${esc(d.stats.note)} »</span>` : '';
  let main;
  if (done && READONLY) {
    main = `<div>${rowText(s, skipped)}${statsLine(s.id) ? `<span class="stats-line">${esc(statsLine(s.id))}</span>` : ''}${partsLine(s.id)}${where}${note}</div>`;
  } else if (done) {
    main = `<button type="button" class="row-main" data-a="knee" data-id="${s.id}" aria-label="Modifier les détails : ${esc(titleOf(s))}, ${fmtDate(s.date)}">${rowText(s, skipped)}<span class="stats-line ${statsLine(s.id) ? '' : 'hint'}">${esc(statsLine(s.id) || (isRun(s) && !(d.parts && d.parts.run === false) ? 'Ajouter mes stats ›' : 'Noter les genoux ›'))}</span>${partsLine(s.id)}${where}</button>`;
  } else {
    main = `<div>${rowText(s, skipped)}</div>`;
  }
  const passed = !done && skipped;
  const acts = READONLY
    ? `<span class="check ro ${passed ? 'skipped' : ''}" role="img" aria-label="${done ? 'Validée' : passed ? 'Passée' : 'À faire'}">${passed ? I.cross : I.check}</span>`
    : `${opts.late && !done && !passed ? `<button class="mini" data-a="skip" data-id="${s.id}">Passer</button>` : ''}<button class="check ${passed ? 'skipped' : ''}" data-a="toggle" data-id="${s.id}" aria-pressed="${done}" aria-label="${done ? 'Annuler la validation' : passed ? 'Passée, appuie pour la valider' : 'Valider'} : ${esc(titleOf(s))}, ${fmtDate(s.date)}">${passed ? I.cross : I.check}</button>`;
  return `<div class="row ${done ? 'is-done' : ''} ${passed ? 'is-skipped' : ''}">
    <span class="stripe ${t.cls}"></span>
    ${main}
    <div class="acts">${done ? kneeTag(s.id) : ''}${acts}</div>
  </div>`;
}
const segs = (d, total) => `<div class="segs" role="img" aria-label="${d} séances sur ${total} cette semaine">${Array.from({ length: total }, (_, i) => `<span class="seg ${i < d ? 'on' : ''}"><i></i></span>`).join('')}</div>`;

/* ---------- Écran : Aujourd'hui ---------- */
function viewToday() {
  if (TODAY > RACE) return viewEnd();
  const first = ms(RACE) - ms(TODAY);
  const days = Math.max(0, diffDays(TODAY, RACE));
  const cw = currentWeek();
  const ws = weekStats(cw);
  const tot = totalStats();
  const pct = Math.round((tot.done / tot.total) * 100);

  const list = SESSIONS.filter(counts);
  const todays = list.find(s => s.date === TODAY);
  const upcoming = list.filter(s => s.date >= TODAY && !isDone(s.id) && !state.skipped[s.id]);
  const doneToday = todays && isDone(todays.id) ? todays : null;
  const skippedToday = todays && !doneToday && state.skipped[todays.id] ? todays : null;
  const hero = todays && !doneToday && !skippedToday ? todays : upcoming[0];
  const late = list.filter(s => s.date < TODAY && !isDone(s.id) && !state.skipped[s.id]);
  const nextUp = upcoming.filter(s => !hero || s.id !== hero.id).slice(0, 2);

  const alertK = kneeAlert();

  let html = `<header class="top">
    <span class="num display" aria-hidden="true">${days}</span>
    <p class="lbl"><span class="sr">${days} </span>${days > 1 ? 'jours' : 'jour'} avant le marathon,<br><span class="muted">dim. 4 avril 2027</span><span class="wk">Sem. ${cw.n} / 26</span></p>
  </header>`;

  if (alertK) html += alertBox(alertK);
  html += missReminder();
  html += bilanCard();

  if (doneToday) {
    html += `<div class="block-title" style="margin-bottom:8px"><h2 class="h2">Séance du jour</h2></div><div class="list">${sessionRow(doneToday)}</div>${cheerCard(cheerFor(doneToday), true)}`;
  }
  if (skippedToday) {
    html += `<div class="block-title" style="margin-bottom:8px"><h2 class="h2">Séance du jour</h2></div>
      <div class="row"><span class="stripe ${TYPES[skippedToday.type].cls}"></span><div>${rowText(skippedToday, true)}</div>
      <div class="acts"><button class="mini" data-a="unskip" data-id="${skippedToday.id}">Annuler</button></div></div>${cheerCard(pick(SKIP_MSG, skippedToday.id), 'skip')}`;
  }
  if (hero) {
    if (doneToday || skippedToday) html += `<div class="block-title" style="margin:22px 0 8px"><h2 class="h2">Prochaine séance</h2></div>`;
    html += heroCard(hero, todays === hero, !!(doneToday || skippedToday));
  } else html += `<div class="card t-rest hero"><h2>Tout est validé pour l’instant.</h2></div>`;

  if (!doneToday && !skippedToday) html += cheerCard(pick(DAILY, TODAY), false);

  html += contextNotes(cw);
  if (late.length) {
    html += `<div class="block" style="margin-top:22px"><div class="block-title"><h2 class="h2">${READONLY ? 'Passées, non validées' : 'Séances passées'}</h2></div>
      ${READONLY ? '' : '<p class="small muted" style="margin-bottom:10px">On ne rattrape rien. Coche ce que tu as fait, ou passe le reste.</p>'}
      <div class="list">${late.map(s => sessionRow(s, { late: true })).join('')}</div></div>`;
  }

  html += `<section class="block"><div class="block-title"><h2 class="h2">Cette semaine</h2><span class="stat">${ws.done}<small>/ ${ws.total}</small></span></div>${segs(ws.done, ws.total)}</section>
  <section class="block"><div class="block-title"><h2 class="h2">Ma prépa</h2><span class="stat">${pct}<small>%</small></span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${tot.total}" aria-valuenow="${tot.done}" aria-label="Séances validées"><i style="width:${pct}%"></i></div>
    <p class="small muted" style="margin-top:8px">${tot.done} séances validées sur ${tot.total}${totalKm() ? ` · ${fmtKm(totalKm())} km saisis` : ''}</p></section>`;

  if (nextUp.length) {
    html += `<section class="block"><div class="block-title"><h2 class="h2">Puis</h2></div><div class="list">${nextUp.map(s => sessionRow(s)).join('')}</div></section>`;
  }
  return html;
}

function cheerCard(text, kind) {
  if (READONLY) return '';
  return `<figure class="quote"><figcaption>${kind === 'skip' ? 'Pas grave' : kind ? 'Bien joué' : 'Un mot pour toi'}</figcaption><blockquote>${esc(text)}</blockquote></figure>`;
}

function heroCard(s, isToday, afterDone) {
  const t = TYPES[s.type];
  const done = isDone(s.id);
  const m = minutesOf(s);
  const when = isToday ? 'Aujourd’hui' : afterDone ? fmtDate(s.date) : TODAY < s.date ? `Prochaine séance · ${fmtDate(s.date)}` : fmtDate(s.date);
  const big = s.type === 'race'
    ? `<span class="n" style="font-size:clamp(64px,22vw,104px)">42,2</span><span class="u">km</span>`
    : m >= 60 ? `<span class="n">${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}</span>` : `<span class="n">${m}</span><span class="u">min</span>`;
  const reduced = s.id === 'w23-dim' && peakReduced();
  return `<article class="card hero ${t.cls}" aria-label="Séance : ${esc(titleOf(s))}">
    <div class="kicker"><span>${when}</span><span class="chip">${t.label}</span></div>
    <div class="big" aria-hidden="true">${big}</div>
    <h2>${esc(titleOf(s))}</h2>
    <p class="extra"><span class="chip">${s.place}</span>${s.extra ? ` ${esc(s.extra)}` : ''}</p>
    ${reduced ? '<p class="tip"><b>Ramenée au niveau de la semaine 22</b>, comme prévu au point de décision.</p>' : ''}
    ${tipOf(s) ? `<p class="tip">${esc(tipOf(s))}</p>` : ''}
    ${renfoSummary(s)}
    <div class="cta-row">
      ${READONLY ? '' : done
        ? `<span class="done-badge">${I.check.replace('<svg', '<svg width="28" height="28"')} Validée</span>${kneeTag(s.id)}<button class="btn ghost small" data-a="toggle" data-id="${s.id}">Annuler</button>`
        : `<button class="btn" data-a="toggle" data-id="${s.id}">${I.check.replace('<svg', '<svg width="24" height="24"')} C’est fait</button>`}
      ${!READONLY && !done && s.date <= TODAY ? `<button class="btn ghost small" data-a="skip" data-id="${s.id}">Je passe</button>` : ''}
      ${s.type === 'renfo' && s.day !== 'lun' ? `<button class="btn ghost small" data-a="goto" data-t="renfo">Voir les exercices</button>` : ''}
    </div>
  </article>`;
}

function lastWhere() {
  const list = SESSIONS.filter(x => state.done[x.id] && state.done[x.id].where).sort((p, q) => p.date.localeCompare(q.date));
  return list.length ? state.done[list[list.length - 1].id].where : '';
}
function alertBox(kind) {
  const title = kind === 'douleur' ? 'Une douleur est notée' : 'Deux gênes de suite';
  return `<div class="alert" role="alert"><h3>${I.warn} ${title}</h3>
    <p><b>Lève le pied.</b> Ne rallonge pas ta prochaine sortie longue et laisse le corps récupérer.</p>
    <p>Pense à voir un kiné du sport. Cette appli ne pose aucun diagnostic.</p>${lastWhere() ? `<p class="small muted">Dernière note : ${esc(lastWhere())}.</p>` : ''}</div>`;
}

function contextNotes(cw) {
  let h = '';
  if (cw.n <= 8) h += `<div class="note"><b>Avant la semaine 9 (30 nov.).</b> Fais voir ton genou qui coince à l’accroupissement à un kiné ou au chirurgien, avant que les sorties dépassent 1 h.</div>`;
  if (cw.n === 21 || cw.n === 22) h += `<div class="note"><b>Point de décision.</b> Si un genou a protesté cette semaine ou la précédente, la sortie de la semaine 23 passe de ${fmtDur(180)} à ${fmtDur(WEEKS[21].sessions.find(x => x.day === 'dim').minutes)}.</div>`;
  if (cw.adjusted) h += `<div class="note"><b>Semaine ajustée.</b> Les durées ont été plafonnées après ton dernier bilan.${READONLY ? '' : ` <button class="mini" data-a="adj-cancel" data-n="${cw.n}">Revenir au plan</button>`}</div>`;
  if (cw.allegee) h += `<div class="note"><b>Semaine allégée.</b> On la fait, on ne la saute pas. C’est là que tu absorbes.</div>`;
  return h;
}

function viewEnd() {
  const tot = totalStats();
  return `<section class="end"><p class="eyebrow">4 avril 2027</p>
    <h1 class="display" style="margin:10px 0 18px;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent">Marathon<br>terminé.</h1>
    <p style="font-size:20px;font-weight:600">${tot.done} séances validées sur ${tot.total}. Tu es allé·e au bout de la prépa, c’est ce qui compte.</p>
    <p class="muted" style="margin-top:12px">Repose-toi, mange bien, et reprends doucement quand les jambes te le disent. Pas avant.</p>
    <div class="block"><a class="btn" href="#profile">Revoir mon profil</a></div></section>`;
}

/* ---------- Écran : Plan ---------- */
function viewPlan() {
  const cw = TODAY > RACE ? null : currentWeek();
  return `<h1 class="display" style="font-size:72px">Plan</h1>
    <p class="muted" style="margin-top:8px">26 semaines, 4 séances. Une séance ratée ne se rattrape pas.</p>
    <div class="weeks">${WEEKS.map(w => {
      const st = weekStats(w);
      const isCur = cw && w.n === cw.n;
      return `<details class="week ${isCur ? 'current' : ''}" ${isCur ? 'open' : ''} id="w${w.n}">
        <summary><span class="wnum display">${w.n}</span>
          <span class="wmeta">${fmtDate(w.start, { day: 'numeric', month: 'short' })} · ${w.phase}${w.allegee ? '<span class="tagpill">allégée</span>' : ''}${w.adjusted ? '<span class="tagpill adj">ajustée</span>' : ''}${w.tag && !w.allegee ? `<span class="wsub">${esc(w.tag)}</span>` : `<span class="wsub">${w.allegee ? 'On ne la saute pas' : '&nbsp;'}</span>`}</span>
          <span class="wprog">${st.done}/${st.total}<span class="dots" aria-hidden="true">${w.sessions.filter(counts).map(x => `<i class="${isDone(x.id) ? 'on' : state.skipped[x.id] ? 'passed' : ''}"></i>`).join('')}</span></span></summary>
        <div class="list">${w.sessions.map(s => sessionRow(s)).join('')}</div></details>`;
    }).join('')}</div>`;
}

/* ---------- Écran : Profil des sorties longues ---------- */
let selectedWeek = null;
function viewProfile() {
  const longs = WEEKS.slice(0, 25).map(w => ({ w, s: w.sessions.find(x => x.day === 'dim') }));
  const cw = currentWeek();
  const sel = selectedWeek || (TODAY > RACE ? 23 : cw.n > 25 ? 25 : cw.n);
  const W = 360, H = 230, pl = 26, pr = 6, pt = 24, pb = 26;
  const iw = W - pl - pr, ih = H - pt - pb;
  const step = iw / 25, bw = step * 0.66;
  const maxM = 180;
  const y = m => pt + ih - (m / maxM) * ih;
  const grid = [60, 120, 180].map(m => `<line class="axis" x1="${pl}" x2="${W - pr}" y1="${y(m)}" y2="${y(m)}" ${m === 180 ? 'stroke-dasharray="3 3"' : ''}/><text class="axis-t" x="${pl - 5}" y="${y(m) + 3}" text-anchor="end">${m / 60}h</text>`).join('');
  const bars = longs.map(({ w, s }, i) => {
    const m = minutesOf(s);
    const x = pl + i * step + (step - bw) / 2;
    const done = isDone(s.id), cur = w.n === cw.n && TODAY <= RACE, isSel = w.n === sel;
    const h = (m / maxM) * ih;
    const fill = done ? 'url(#g)' : 'var(--ink)';
    const op = done ? 1 : w.allegee ? 0.14 : 0.24;
    return `<g class="bar-hit" data-a="pick" data-n="${w.n}" tabindex="0" role="button" aria-label="Semaine ${w.n} : ${fmtDur(m)}${done ? ', faite' : ''}${w.allegee ? ', allégée' : ''}">
      <rect x="${x - 2}" y="${pt}" width="${bw + 4}" height="${ih + pb - 6}" fill="transparent"/>
      <rect class="bar-r" x="${x}" y="${y(m)}" width="${bw}" height="${h}" rx="${bw / 2.4}" fill="${fill}" fill-opacity="${op}" ${w.allegee && !done ? 'stroke="var(--ink)" stroke-opacity=".5" stroke-dasharray="2 2"' : ''}/>
      ${cur ? `<path d="M${x + bw / 2 - 5} ${y(m) - 11} l5 7 l5 -7z" fill="var(--orange)"/>` : ''}
      ${isSel ? `<rect x="${x - 1}" y="${H - pb + 8}" width="${bw + 2}" height="3" rx="1.5" fill="var(--ink)"/>` : ''}
      ${w.n % 5 === 0 || w.n === 1 ? `<text class="axis-t" x="${x + bw / 2}" y="${H - 2}" text-anchor="middle">${w.n}</text>` : ''}
    </g>`;
  }).join('');
  const sw = WEEKS[sel - 1], ss = sw.sessions.find(x => x.day === 'dim'), sm = minutesOf(ss);
  const prevReal = longs.slice(0, sel - 1).reverse().find(l => !l.w.allegee);
  const delta = prevReal && !sw.allegee ? Math.round((sm / minutesOf(prevReal.s) - 1) * 100) : null;
  return `<h1 class="display" style="font-size:72px">Profil</h1>
    <p class="muted" style="margin-top:8px">Tes 25 sorties longues. La montée est lente, et les creux sont voulus.</p>
    <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Durée des sorties longues par semaine, de ${fmtDur(longs[0].s.minutes)} à ${fmtDur(180)}">
      <defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${pl}" x2="${W - pr}" y1="0" y2="0"><stop offset="0" stop-color="#E8622C"/><stop offset=".4" stop-color="#DE5FB8"/><stop offset=".7" stop-color="#7D52C3"/><stop offset="1" stop-color="#1F4BC8"/></linearGradient></defs>
      ${grid}${bars}</svg>
      <div class="detail"><p class="eyebrow">Semaine ${sw.n} · ${fmtDate(ss.date)}${sw.allegee ? ' · allégée' : ''}</p>
        <p class="d-big" style="margin-top:6px">${fmtDur(sm).replace(' min', '')}${sm < 60 ? '<small style="font-size:18px"> min</small>' : ''}</p>
        <p class="small muted" style="margin-top:6px">${delta !== null ? `+${delta} % par rapport à la sortie précédente.` : sw.allegee ? 'On lève le pied pour mieux repartir.' : 'Début de la montée.'}${sw.n === 23 && peakReduced() ? ' Ramenée au niveau de la semaine 22.' : ''}${sw.n === 23 ? ' C’est le pic.' : ''}</p></div>
      <div class="legend"><span><i style="background:var(--grad)"></i>faite</span><span><i style="background:var(--ink);opacity:.24"></i>à venir</span><span><i style="border:2px dashed var(--ink);opacity:.5"></i>allégée</span><span><i style="background:var(--orange);clip-path:polygon(0 0,100% 0,50% 100%)"></i>cette semaine</span></div>
    </div>`;
}

/* ---------- Écran : Plus (renfo, repères, calendrier, sauvegarde, montre) ---------- */
function viewMore() {
  const h = viewMoreFull();
  return READONLY ? h.replace(/<details class="acc" id="watch">[\s\S]*?<\/details>/, '').replace(/<details class="acc" id="sauvegarde">[\s\S]*?<\/details>/, '') : h;
}
function viewMoreFull() {
  return `<h1 class="display" style="font-size:72px">Plus</h1>
  <details class="acc" id="renfo"><summary>Renfo</summary><div class="acc-body">
    <p class="muted">Le renfo protège tes genoux plus qu’une sortie de plus. Contenu général, à faire valider par ton kiné.</p>
    <h3>Séance A · lundi midi, salle (20 à 30 min)</h3>
    <p>Échauffement 5 min : marche rapide ou vélo. Tu fais <b>toutes les séries d’un exercice</b>, puis tu passes au suivant, avec 90 s de repos entre séries. 2 ou 3 séries selon la séance du jour, 1 seule en version légère.</p>
    ${exoList({ title: '3 séries' }).replace(/3 × /g, '2 à 3 × ')}
    <p><b>Pas jusqu’à l’épuisement :</b> arrête chaque série quand tu sentirais que tu pourrais encore faire 2 répétitions propres. Si le genou fait mal (plus de 3 sur 10) ou si le ménisque se bloque, tu arrêtes l’exercice.</p>
    <h3>Séance B · vendredi soir, 10 min après la course</h3>
    <p>Hip thrust à la machine 2 × 12, marche latérale avec élastique 2 × 12 pas de chaque côté, mollets 2 × 15, planche 2 × 30 s.</p>
    <h3>À éviter, ou à valider avec le kiné</h3>
    <ul><li>Accroupissements profonds</li><li>Extension de jambe en charge</li><li>Fentes avec rotation</li><li>Sauts</li></ul>
  </div></details>

  <details class="acc" id="reperes"><summary>Repères</summary><div class="acc-body">
    <table class="t"><thead><tr><th>Allure</th><th>min/km</th><th>km/h</th><th>Sensation</th></tr></thead><tbody>
      <tr><td>Facile</td><td>6:45 à 7:15</td><td>8,3 à 8,9</td><td>phrases complètes</td></tr>
      <tr><td>Marathon</td><td>≈ 6:25</td><td>≈ 9,3</td><td>quelques mots</td></tr>
      <tr><td>Soutenu</td><td>5:55 à 6:10</td><td>9,7 à 10,1</td><td>par bribes</td></tr></tbody></table>
    <p class="small muted">Chiffres indicatifs : l’effort prime sur la montre. Sur tapis, pente de 1 %. Arrivée estimée vers 4h30, minutes de marche comprises.</p>
    <h3>Les règles</h3>
    <ul><li>Tout se court à allure facile, sauf les blocs soutenus et allure marathon.</li>
      <li>Sortie longue : 1 min de marche toutes les 10 à 15 min dès qu’elle dépasse 1 h, et le jour de la course si besoin.</li>
      <li>Les semaines allégées ne se sautent pas.</li>
      <li>Une séance ratée ne se rattrape pas. Deux ratées : on reprend la semaine précédente.</li>
      <li>Enfant malade, rush au travail : on raccourcit, on ne compense jamais.</li>
      <li>Semaine 22 : si un genou a protesté, le pic de la semaine 23 est ramené au niveau de la semaine 22.</li></ul>
    <h3>Signaux d’alerte</h3>
    <ul><li>Un genou qui gonfle ou fait mal plus de 2 à 3 jours après une sortie.</li><li>Un ménisque qui se bloque en courant.</li><li>Une douleur qui change ta foulée.</li></ul>
    <p>Dans ces cas, lève le pied et vois un kiné du sport avant d’allonger la sortie longue. Ces repères ne remplacent pas un avis médical.</p>
    <h3>Terrain et chaussures</h3>
    <p>Chemin ou terre pour la sortie longue quand c’est possible, tapis le reste du temps. Chaussures à changer vers 600 à 800 km.</p>
    <h3>Jour de course</h3>
    <ul><li>Pars plus lentement que ton allure marathon sur les premiers kilomètres.</li><li>1 min de marche toutes les 10 à 15 min si besoin.</li><li>Bois et mange comme à l’entraînement, rien de nouveau.</li><li>Si un genou proteste, ralentis ou marche. Finir sans se blesser, c’est le but.</li></ul>
  </div></details>

  <details class="acc" id="calendrier"><summary>Calendrier</summary><div class="acc-body">
    <p>Génère un fichier .ics avec toutes les séances : lundi et mercredi 12 h, vendredi 19 h, dimanche 9 h, marathon le 4 avril 2027 à 9 h. Ouvre-le dans l’app Calendrier de l’iPhone.</p>
    <div class="btns"><button class="btn" data-a="ics">Télécharger le .ics</button></div>
  </div></details>

  <details class="acc" id="watch"><summary>Apple Watch</summary><div class="acc-body">
    <p>Une page web ne peut pas envoyer une séance dans l’app Entraînement de la montre. Pour l’instant, les séances arrivent via le Calendrier de l’iPhone, visible aussi sur la montre.</p>
    <p class="muted">Étape suivante possible : une petite app iPhone native qui envoie chaque séance vers l’app Entraînement de la montre.</p>
  </div></details>

  <details class="acc" id="sauvegarde"><summary>Synchro et sauvegarde</summary><div class="acc-body">
    ${syncPanel()}
    <h3>Sauvegarde manuelle</h3>
    <p class="small muted">Copie ta progression pour la coller ailleurs, ou importe-en une.</p>
    <textarea class="io" id="io" aria-label="Progression au format JSON" spellcheck="false"></textarea>
    <div class="btns"><button class="btn small" data-a="export">Exporter</button><button class="btn small line" data-a="copy">Copier</button><button class="btn small line" data-a="import">Importer</button></div>
    <p class="small muted" id="io-msg" role="status"></p>
    <div class="btns"><button class="btn small line" data-a="reset">Tout effacer</button></div>
  </div></details>
  <p class="small muted" style="margin-top:20px">Ce plan est général. Il ne remplace pas l’avis de ton kiné.</p>`;
}

/* ---------- Synchronisation (Upstash via /api/sync) ---------- */
const CODE_KEY = 'marathon27:code';
let syncInfo = { text: '', busy: false };
let shareCode = ''; // lien de lecture seule actif (code), connu après une synchro
const shareUrl = c => `${location.origin}/suivi/${c}`;
const getCode = () => { if (READONLY) return ''; try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } };
const setCode = c => { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); } catch (e) { /* ignoré */ } };
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(20));
  const c = [...b].map(x => A[x % A.length]).join('');
  return c.match(/.{5}/g).join('-');
}
const codeOk = c => /^[A-Za-z0-9-]{16,64}$/.test(c);
function syncPanel() {
  const code = getCode();
  if (!code) return `<p>Pour retrouver la même progression sur ton téléphone et ton ordinateur, crée un code, puis saisis-le sur l’autre appareil.</p>
    <div class="btns"><button class="btn small" data-a="sync-new">Créer mon code</button></div>
    <label class="small muted" for="code-in">Tu as déjà un code ?</label>
    <input class="code-in" id="code-in" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX">
    <div class="btns"><button class="btn small line" data-a="sync-join">Connecter cet appareil</button></div>
    <p class="small muted" id="sync-msg" role="status">${esc(syncInfo.text)}</p>`;
  return `<p><b>Synchro active.</b> Garde ce code : il ouvre ta progression, ne le partage pas.</p>
    <div class="code-show">${esc(code)}</div>
    <div class="btns"><button class="btn small line" data-a="sync-copy">Copier</button><button class="btn small" data-a="sync-now">Synchroniser</button><button class="btn small line" data-a="sync-off">Déconnecter</button></div>
    <p class="small muted" id="sync-msg" role="status">${esc(syncInfo.text)}</p>
    <h3 class="sh-h">Lien en lecture seule</h3>
    ${shareCode
      ? `<p class="small">Envoie ce lien à ta kiné : elle voit tout, mais ne peut rien modifier.</p>
         <div class="code-show">${esc(shareUrl(shareCode))}</div>
         <div class="btns"><button class="btn small line" data-a="share-copy">Copier le lien</button><button class="btn small line" data-a="share-off">Désactiver le lien</button></div>`
      : `<p class="small muted">Crée un lien secret pour qu’une personne puisse suivre ta progression, sans pouvoir la modifier.</p>
         <div class="btns"><button class="btn small" data-a="share-new">Créer un lien de lecture</button></div>`}`;
}
const syncMsg = t => { syncInfo.text = t; const m = $('#sync-msg'); if (m) m.textContent = t; };
async function api(code, body) {
  const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, ...body }) });
  if (!r.ok) { const e = new Error('http ' + r.status); e.status = r.status; throw e; }
  return r.json();
}
async function syncNow(quiet) {
  if (READONLY) return;
  const code = getCode(); if (!code || syncInfo.busy) return;
  syncInfo.busy = true;
  try {
    const { state: remote, share } = await api(code, { action: 'get' });
    const shareChanged = (share || '') !== shareCode;
    shareCode = share || '';
    const before = JSON.stringify(state);
    state = mergeStates(state, normalize(remote || {})); rebuild();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
    await api(code, { action: 'put', state });
    syncMsg('Synchronisé à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '.');
    if (JSON.stringify(state) !== before || shareChanged) render();
  } catch (e) {
    syncMsg(quiet ? 'Hors ligne : ce sera synchronisé plus tard.' : 'Synchro impossible pour l’instant. Réessaie, ta progression reste sur cet appareil.');
  } finally { syncInfo.busy = false; }
}
let pushTimer;
function schedulePush() { if (!getCode()) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(true), 900); }
let sharedAt = null, sharedError = '';
async function refreshShared() {
  try {
    const { state: remote } = await api(null, { action: 'read', share: SHARE });
    state = normalize(remote || {}); rebuild();
    sharedAt = new Date(); sharedError = '';
  } catch (e) {
    sharedError = e.status === 404 ? 'Ce lien n’est plus actif.' : 'Impossible de charger la progression pour l’instant.';
  }
  render();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (READONLY) refreshShared(); else syncNow(true);
});

/* ---------- Bottom sheet : ressenti des genoux ---------- */
// Valeurs attendues d'une séance : durée du plan, distance selon les allures cibles (facile 7:00, allure marathon 6:25, soutenu 6:00 au km)
function expectedStats(s) {
  if (s.type === 'race') return { km: 42.2, min: 270 };
  const m = minutesOf(s); if (!m) return null;
  const b = s.title.match(/(\d+) × (\d+) min soutenu/), q = s.title.match(/dont (\d+) min allure marathon/);
  const hard = b ? b[1] * b[2] : 0, mp = q ? +q[1] : 0, easy = Math.max(0, m - hard - mp);
  const km = (hard * 60) / 360 + (mp * 60) / 385 + (easy * 60) / 420;
  return { km: Math.round(km * 10) / 10, min: m };
}
let sheetKnee = null;
let sheetParts = { run: true, renfo: true };
function openKnee(id, fresh) {
  const s = SESSIONS.find(x => x.id === id);
  const d = state.done[id] || {};
  const prefill = !d.stats && isRun(s) ? expectedStats(s) : null;
  const st = d.stats || prefill || {};
  sheetKnee = d.knee || null;
  sheetParts = d.parts ? { run: d.parts.run !== false, renfo: d.parts.renfo !== false } : { run: true, renfo: true };
  const pb = (k, label) => `<button type="button" class="part" data-a="pick-part" data-k="${k}" aria-pressed="${sheetParts[k]}">${label}</button>`;
  const whereOn = k => k === 'gene' || k === 'douleur';
  const kb = (k, label) => `<button type="button" class="opt ${k}" data-a="pick-knee" data-k="${k}" aria-pressed="${sheetKnee === k}">${label}</button>`;
  const field = (name, label, val, mode, ph) => `<label class="fld"><span>${label}</span><input name="${name}" inputmode="${mode}" autocomplete="off" placeholder="${ph}" value="${val == null ? '' : esc(String(val).replace('.', name === 'pace' ? '.' : ','))}"></label>`;
  const full = isRun(s);
  $('#sheet-root').innerHTML = `<div class="scrim ${full ? 'full' : ''}" data-a="close-sheet"><form class="sheet ${full ? 'full' : ''}" id="sheet-form" data-id="${id}" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <button type="button" class="x" data-a="close-sheet" aria-label="Fermer">✕</button>
    <h2 id="sh-t">Comment c’était ?</h2><p>${esc(titleOf(s))} · tout est optionnel.</p>
    ${s.extra ? `<h3 class="sh-h">Ce que tu as fait</h3><div class="parts">${pb('run', 'Course')}${pb('renfo', 'Renfo B')}</div>` : ''}
    <h3 class="sh-h">Tes genoux</h3>
    <div class="knee-opts">${kb('ras', 'RAS')}${kb('gene', 'Gêne')}${kb('douleur', 'Douleur')}</div>
    <div class="where" id="where-box" ${whereOn(sheetKnee) ? '' : 'hidden'}>
      <label class="fld wide"><span>Où ? (précision)</span><input name="where" autocomplete="off" placeholder="genou droit, cheville gauche…" value="${esc(d.where || '')}"></label>
      <div class="chips">${['genou droit', 'genou gauche', 'cheville droite', 'cheville gauche', 'mollet', 'hanche', 'dos'].map(w => `<button type="button" class="chip-btn" data-a="where-chip" data-v="${w}">${w}</button>`).join('')}</div>
    </div>
    ${isRun(s) ? `<div id="stats-box" ${sheetParts.run ? '' : 'hidden'}><h3 class="sh-h">Tes stats</h3><p class="small muted" style="margin:0 0 8px">${prefill ? 'Pré-rempli avec ce que le plan prévoit : change ce qui diffère.' : 'Recopie ce qui est sur la montre ou le tapis.'}</p>
    <div class="flds">
      ${field('km', 'Distance (km)', st.km, 'decimal', '5,2')}
      ${field('min', 'Durée (min)', st.min, 'decimal', '32')}
      ${field('pace', 'Allure (min/km)', st.pace, 'text', 'auto')}
      ${field('hr', 'FC moyenne', st.hr, 'numeric', '142')}
    </div>
    <label class="fld wide"><span>Note</span><input name="note" autocomplete="off" placeholder="Sensations, météo, tapis…" value="${esc(st.note || '')}"></label></div>` : ''}
    <div class="sh-actions"><button type="submit" class="btn block">Enregistrer</button>
    <button type="button" class="btn line block" data-a="close-sheet">${fresh ? 'Passer' : 'Fermer'}</button></div></form></div>`;
  const b = $('#sheet-form .opt'); if (b) b.focus();
}
const closeSheet = () => { rxStop(); $('#sheet-root').innerHTML = ''; };

/* ---------- Export .ics ---------- */
function buildICS() {
  const pad = n => String(n).padStart(2, '0');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Marathon27//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Marathon 2027'];
  for (const s of SESSIONS) {
    if (s.type === 'rest') continue;
    const [hh, mm] = s.type === 'race' ? [9, 0] : HOURS[s.day];
    const dur = s.type === 'race' ? 'PT5H' : `PT${Math.max(minutesOf(s) + (s.extra ? 10 : 0), 15)}M`;
    const d = s.date.replace(/-/g, '');
    const desc = [TYPES[s.type].label, s.place, s.extra].filter(Boolean).join(' · ');
    out.push('BEGIN:VEVENT', `UID:${s.id}@marathon27`, `DTSTAMP:${stamp}`,
      `DTSTART:${d}T${pad(hh)}${pad(mm)}00`, `DURATION:${dur}`,
      `SUMMARY:${icsEsc(s.type === 'race' ? 'Marathon de Paris' : titleOf(s))}`,
      `DESCRIPTION:${icsEsc(desc)}`, `LOCATION:${icsEsc(s.place)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Séance dans 1 h', 'TRIGGER:-PT60M', 'END:VALARM', 'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}
const icsEsc = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/* ---------- Actions ---------- */
function toggle(id) {
  if (state.done[id]) { delete state.done[id]; touch(id); save(); render(); return; }
  delete state.skipped[id]; touch(id);
  state.done[id] = { t: new Date().toISOString(), knee: null };
  save(); render();
  openKnee(id, true);
}
const actions = {
  'share-new': async () => {
    const code = getCode(); if (!code) return;
    try { shareCode = (await api(code, { action: 'share-create' })).share || ''; render(); }
    catch (e) { syncMsg('Impossible de créer le lien pour l’instant. Réessaie.'); }
  },
  'share-copy': async () => { try { await navigator.clipboard.writeText(shareUrl(shareCode)); syncMsg('Lien copié.'); } catch (e) { syncMsg('Copie-le à la main.'); } },
  'share-off': async () => {
    if (!confirm('Désactiver le lien ? La personne ne pourra plus voir ta progression avec ce lien.')) return;
    try { await api(getCode(), { action: 'share-revoke' }); shareCode = ''; render(); }
    catch (e) { syncMsg('Impossible de désactiver le lien pour l’instant. Réessaie.'); }
  },
  refresh: () => refreshShared(),
  'sync-new': () => { setCode(newCode()); syncMsg(''); render(); syncNow(); },
  'sync-join': () => {
    const c = ($('#code-in').value || '').trim().toUpperCase();
    if (!codeOk(c)) return syncMsg('Ce code n’a pas le bon format.');
    setCode(c); render(); syncNow();
  },
  'sync-copy': async () => { try { await navigator.clipboard.writeText(getCode()); syncMsg('Code copié.'); } catch (e) { syncMsg('Copie-le à la main.'); } },
  'sync-now': () => syncNow(),
  'sync-off': () => { if (confirm('Déconnecter cet appareil ? Ta progression reste ici, mais ne se synchronise plus.')) { setCode(''); syncMsg(''); render(); } },
  'rx-open': e => rxOpen(e.dataset.id),
  'rx-set': e => {
    const id = rx.id, i = +e.dataset.i, k = +e.dataset.k;
    const cur = (state.ex[id] || [])[i] || 0;
    setEx(id, i, cur >= k ? k - 1 : k);
    const w = e.closest('.rx-item') && e.closest('.rx-item').querySelector('.rx-wi'); // la charge saisie est gardée avec la série
    if (w && w.value) setWt(id, w.dataset.key, num(w.value));
    renderRenfo();
  },
  'rx-all': e => {
    const id = rx.id, i = +e.dataset.i, r = renfoOf(SESSIONS.find(x => x.id === id));
    setEx(id, i, ((state.ex[id] || [])[i] || 0) >= r.sets ? 0 : r.sets);
    const w = e.closest('.rx-item') && e.closest('.rx-item').querySelector('.rx-wi');
    if (w && w.value) setWt(id, w.dataset.key, num(w.value));
    renderRenfo();
  },
  'rx-timer': e => timerStart(e.dataset.k, +e.dataset.s),
  'rx-finish': () => {
    const id = rx.id, r = renfoOf(SESSIONS.find(x => x.id === id));
    closeSheet();
    if (r.closes && !isDone(id)) toggle(id);
  },
  'pick-part': e => {
    sheetParts[e.dataset.k] = !sheetParts[e.dataset.k];
    document.querySelectorAll('#sheet-form .part').forEach(b => b.setAttribute('aria-pressed', String(sheetParts[b.dataset.k])));
    const box = $('#stats-box'); if (box) box.hidden = !sheetParts.run;
  },
  'bilan-seen': e => { state.seen[e.dataset.n] = true; save(); render(); },
  'bilan-apply': e => {
    const w = WEEKS[+e.dataset.n - 1], b = bilanFor(w);
    if (b.next && Object.keys(b.caps).length) { state.adj[b.next.n] = { t: Date.now(), m: b.caps }; rebuild(); }
    state.seen[w.n] = true; save(); render();
  },
  'adj-cancel': e => { state.adj[e.dataset.n] = { t: Date.now(), m: {} }; rebuild(); save(); render(); },
  toggle: e => toggle(e.dataset.id),
  unskip: e => { delete state.skipped[e.dataset.id]; touch(e.dataset.id); save(); render(); },
  skip: e => { state.skipped[e.dataset.id] = true; touch(e.dataset.id); save(); render(); },
  knee: e => openKnee(e.dataset.id, false),
  'close-sheet': (e, ev) => { if (ev.target === e) closeSheet(); },
  'pick-knee': e => {
    sheetKnee = sheetKnee === e.dataset.k ? null : e.dataset.k;
    document.querySelectorAll('#sheet-form .opt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === sheetKnee)));
    const box = $('#where-box'); if (box) box.hidden = !(sheetKnee === 'gene' || sheetKnee === 'douleur');
  },
  'where-chip': e => { const i = $('#sheet-form input[name=where]'); if (i) { i.value = e.dataset.v; i.focus(); } },
  pick: e => { selectedWeek = +e.dataset.n; render(); const g = document.querySelector(`[data-a="pick"][data-n="${selectedWeek}"]`); if (g) g.focus(); },
  goto: e => { location.hash = '#more'; setTimeout(() => { const d = document.getElementById(e.dataset.t); if (d) { d.open = true; d.scrollIntoView(); } }, 0); },
  ics: () => {
    const url = URL.createObjectURL(new Blob([buildICS()], { type: 'text/calendar' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'marathon-2027.ics' });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  export: () => { $('#io').value = JSON.stringify({ v: 1, ...state }, null, 1); msg('Voilà ta progression. Copie-la pour la coller ailleurs.'); },
  copy: async () => {
    const t = $('#io'); if (!t.value) actions.export();
    try { await navigator.clipboard.writeText(t.value); msg('Copié.'); } catch (e) { t.select(); msg('Sélectionné : copie-le à la main.'); }
  },
  import: () => {
    try {
      const data = JSON.parse($('#io').value);
      if (!data || typeof data.done !== 'object') throw new Error();
      state = normalize(data); rebuild(); SESSIONS.forEach(x => touch(x.id)); save(); msg(`Importé : ${Object.keys(state.done).length} séances validées.`);
    } catch (e) { msg('Ce texte n’est pas une sauvegarde valide.'); }
  },
  reset: () => { if (confirm('Effacer toute la progression de cet appareil ?')) { state = emptyState(); rebuild(); SESSIONS.forEach(x => touch(x.id)); save(); msg('Progression effacée.'); } },
};
const msg = t => { const m = $('#io-msg'); if (m) m.textContent = t; };

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el || !actions[el.dataset.a]) return;
  if (READONLY && !['pick', 'goto', 'ics', 'refresh'].includes(el.dataset.a)) return; // lecture seule : rien ne se modifie
  actions[el.dataset.a](el, ev);
});
document.addEventListener('submit', ev => {
  const f = ev.target.closest('#sheet-form'); if (!f) return;
  ev.preventDefault();
  const id = f.dataset.id, d = state.done[id]; if (!d) return closeSheet();
  const sess = SESSIONS.find(x => x.id === id);
  if (sess && sess.extra) {
    if (!sheetParts.run && !sheetParts.renfo) {
      if (confirm('Ni la course ni le renfo ne sont cochés : on marque la séance comme passée ?')) { delete state.done[id]; state.skipped[id] = true; touch(id); save(); closeSheet(); render(); }
      return;
    }
    if (sheetParts.run && sheetParts.renfo) delete d.parts; else d.parts = { run: sheetParts.run, renfo: sheetParts.renfo };
  }
  const v = n => (f.elements[n] ? f.elements[n].value : '');
  const pace = String(v('pace')).trim().replace(',', ':').replace('.', ':');
  const stats = cleanStats({ km: num(v('km')), min: num(v('min')), hr: num(v('hr')), pace, note: v('note') });
  d.knee = sheetKnee;
  const where = (v('where') || '').trim().slice(0, 80);
  if (where && (sheetKnee === 'gene' || sheetKnee === 'douleur')) d.where = where; else delete d.where;
  if (stats && (!sess || !sess.extra || sheetParts.run)) d.stats = stats; else delete d.stats;
  touch(id); save(); closeSheet(); render();
});
// Clavier ouvert : on amène le champ au centre de l'écran.
document.addEventListener('focusin', ev => {
  if (ev.target.matches && ev.target.matches('#sheet-form.full input')) setTimeout(() => ev.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') closeSheet();
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.bar-hit')) { ev.preventDefault(); actions.pick(ev.target); }
});

/* ---------- Renfo : exercices à cocher, charges, chrono pour les exercices tenus ---------- */
const EXOS_B = [
  ['Hip thrust à la machine', '12 répétitions, charge qui monte petit à petit', null, true],
  ['Marche latérale avec élastique', '12 pas de chaque côté'],
  ['Mollets debout', '15 répétitions', null, true],
  ['Planche', 'tiens 30 s', [['', 30]]],
];
function renfoOf(s) {
  if (s.type === 'renfo' && s.day === 'lun') return { label: 'Renfo A', sets: setsOf(s), rest: 90, exos: exosFor(s), finish: 'Terminer la séance', closes: true };
  if (s.extra) return { label: 'Renfo B', sets: 2, rest: 60, exos: EXOS_B, finish: 'Renfo terminé', closes: false };
  return null;
}
const exCounts = (id, r) => r.exos.map((_, i) => Math.min(r.sets, (state.ex[id] && state.ex[id][i]) || 0));
const exDoneCount = (s, r) => exCounts(s.id, r).filter(c => c >= r.sets).length;
function setEx(id, i, v) {
  const a = (state.ex[id] || []).slice();
  while (a.length <= i) a.push(0);
  a[i] = v;
  if (a.every(x => !x)) delete state.ex[id]; else state.ex[id] = a;
  touch(id); save();
}
// Charges : celle de la séance, sinon la dernière utilisée pour cet exercice (pour la remettre d'office)
function setWt(id, key, v) {
  const w = { ...(state.wt[id] || {}) };
  if (v > 0) w[key] = v; else delete w[key];
  if (Object.keys(w).length) state.wt[id] = w; else delete state.wt[id];
  touch(id); save();
}
function lastWeight(key, s) {
  let best = null;
  for (const [id, w] of Object.entries(state.wt)) {
    const o = SESSIONS.find(x => x.id === id);
    if (!o || o.id === s.id || o.date >= s.date || w[key] == null) continue;
    if (!best || o.date > best.date) best = { date: o.date, kg: w[key] };
  }
  return best ? best.kg : null;
}
const fmtKg = n => String(n).replace('.', ',');
function renfoSummary(s) {
  const r = renfoOf(s); if (!r || READONLY) return '';
  const n = r.exos.length, d = exDoneCount(s, r);
  return `<button type="button" class="rx-sum" data-a="rx-open" data-id="${s.id}" aria-label="${r.label} : ouvrir la liste des exercices, ${d} sur ${n} faits">
    <span><b>${r.label}</b><span>${n} exercices · ${r.sets} série${r.sets > 1 ? 's' : ''} · repos ${r.rest} s</span></span>
    <span class="rx-go"><b class="rx-prog">${d}/${n}</b><i aria-hidden="true">›</i></span></button>`;
}

let rx = null; // séance de renfo ouverte
const timer = { key: null, left: 0, end: 0, running: false, iv: null };
let audioCtx = null, wakeLock = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(d => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + d;
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch (e) { /* ignoré */ }
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignoré */ }
}
const fmtClock = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
function paintTimer() {
  document.querySelectorAll('.tbtn').forEach(b => {
    const act = b.dataset.k === timer.key;
    b.classList.toggle('run', act && timer.running);
    b.classList.toggle('fin', act && !timer.running && timer.left === 0);
    const big = b.querySelector('b'); if (big) big.textContent = act ? (timer.running ? fmtClock(timer.left) : timer.left === 0 ? 'Fini ✓' : b.dataset.l) : b.dataset.l;
  });
}
function tickTimer() {
  if (timer.running) {
    timer.left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
    if (timer.left === 0) {
      timer.running = false; clearInterval(timer.iv); beep();
      const k = timer.key; setTimeout(() => { if (timer.key === k && !timer.running) { timer.key = null; paintTimer(); } }, 2500);
    }
  }
  paintTimer();
}
function timerStop() { clearInterval(timer.iv); timer.running = false; timer.key = null; timer.left = 0; paintTimer(); }
function timerStart(key, sec) {
  if (timer.running && timer.key === key) return timerStop(); // un second tap l'arrête
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* ignoré */ }
  clearInterval(timer.iv);
  timer.key = key; timer.left = sec; timer.end = Date.now() + sec * 1000; timer.running = true;
  timer.iv = setInterval(tickTimer, 250); tickTimer();
}
async function wakeOn() { try { if (navigator.wakeLock && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignoré */ } }
function rxStop() {
  if (!rx) return;
  rx = null; timerStop();
  try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignoré */ }
  wakeLock = null;
}
function rxOpen(id) {
  const s = SESSIONS.find(x => x.id === id), r = s && renfoOf(s); if (!r) return;
  rx = { id }; timerStop();
  renderRenfo(); wakeOn();
}
function renderRenfo() {
  if (!rx) return;
  const s = SESSIONS.find(x => x.id === rx.id), r = renfoOf(s), cnt = exCounts(s.id, r), n = r.exos.length;
  const doneN = r.exos.filter((_, i) => cnt[i] >= r.sets).length;
  const old = $('.rx-panel'), top = old ? old.scrollTop : 0;
  const items = r.exos.map(([name, det, timers, load], i) => {
    const full = cnt[i] >= r.sets;
    const sets = Array.from({ length: r.sets }, (_, k) => `<button type="button" class="rx-set" data-a="rx-set" data-i="${i}" data-k="${k + 1}" aria-pressed="${cnt[i] > k}" aria-label="Série ${k + 1} sur ${r.sets} : ${esc(name)}">${k + 1}</button>`).join('');
    const saved = (state.wt[s.id] || {})[name];
    const last = load && saved == null ? lastWeight(name, s) : null;
    const wv = saved != null ? saved : last;
    const weight = load ? `<label class="rx-w"><span class="sr">Charge de ${esc(name)}</span><input class="rx-wi" data-key="${esc(name)}" inputmode="decimal" autocomplete="off" placeholder="–" value="${wv != null ? fmtKg(wv) : ''}"><em>kg</em></label>` : '';
    const hint = last != null ? `<small class="rx-last">Dernière fois : ${fmtKg(last)} kg</small>` : '';
    const tb = (timers || []).map(([label, sec], j) => {
      return `<button type="button" class="tbtn" data-a="rx-timer" data-k="${i}-${j}" data-s="${sec}" data-l="${sec} s" aria-label="Chrono ${label ? esc(label) + ' ' : ''}${sec} secondes">${label ? `<small>${esc(label)}</small>` : ''}<b>${sec} s</b></button>`;
    }).join('');
    return `<li class="rx-item ${full ? 'is-full' : ''}"><button type="button" class="rx-check" data-a="rx-all" data-i="${i}" aria-pressed="${full}" aria-label="${full ? 'Décocher' : 'Cocher'} : ${esc(name)}">${I.check}</button>
      <div class="rx-main"><b>${esc(name)}</b><span>${esc(det)}</span><div class="rx-row"><div class="rx-sets">${sets}</div>${weight}${tb ? `<div class="tbtns">${tb}</div>` : ''}</div>${hint}</div></li>`;
  }).join('');
  $('#sheet-root').innerHTML = `<div class="scrim full" data-a="close-sheet"><div class="sheet full rx-panel" role="dialog" aria-modal="true" aria-labelledby="rx-t">
    <button type="button" class="x" data-a="close-sheet" aria-label="Fermer">✕</button>
    <h2 id="rx-t">${r.label}</h2>
    <p>${fmtDate(s.date)} · ${r.sets} série${r.sets > 1 ? 's' : ''} par exercice · repos ${r.rest} s</p>
    <div class="bar" style="margin-top:14px"><i style="width:${Math.round((doneN / n) * 100)}%"></i></div>
    <p class="small muted" style="margin:6px 0 14px">${doneN} exercice${doneN > 1 ? 's' : ''} sur ${n} · touche une série pour la valider</p>
    <ol class="rx">${items}</ol>
    <div class="sh-actions"><button type="button" class="btn block" data-a="rx-finish">${r.finish}</button></div>
  </div></div>`;
  const p = $('.rx-panel'); if (p) p.scrollTop = top;
  paintTimer();
}
document.addEventListener('input', ev => {
  const t = ev.target;
  if (rx && t.matches && t.matches('.rx-wi')) setWt(rx.id, t.dataset.key, num(t.value));
});

/* ---------- Séances manquées : rappel ---------- */
function missStreak() {
  const past = SESSIONS.filter(counts).filter(s => s.date < TODAY || (s.date === TODAY && state.skipped[s.id])).sort((p, q) => p.date.localeCompare(q.date));
  let n = 0;
  for (let i = past.length - 1; i >= 0; i--) { if (isDone(past[i].id)) break; n++; }
  return n;
}
function missReminder() {
  if (READONLY) return '';
  const n = missStreak(); if (n < 2) return '';
  let title, body;
  if (n >= 4) {
    title = `${n} séances de suite sans validation.`;
    body = 'Reprends en douceur : la semaine précédente, et plus court si besoin. Si ça vient d’une gêne, de fatigue ou d’un manque de temps qui dure, on peut ajuster le plan. Parles-en à ta kiné si c’est lié à un genou.';
  } else if (n === 3) {
    title = '3 séances de suite sans validation.';
    body = 'Essaie de faire la prochaine, même en version raccourcie, par exemple la moitié de la durée. Mieux vaut reprendre doucement que pas du tout. Si une gêne t’a freiné, note-la et parles-en à ta kiné.';
  } else {
    title = '2 séances de suite sans validation.';
    body = 'Ça arrive. Si tu les as faites, coche-les. Sinon, on ne rattrape rien : vise simplement la prochaine.';
  }
  return `<div class="note miss" role="status"><b>${title}</b> ${body}</div>`;
}

/* ---------- Bilan de la semaine et ajustement ---------- */
const DAY_SHORT = { mer: 'mer.', ven: 'ven.', dim: 'dim.' };
function lastDoneLong(upTo) {
  for (let i = upTo - 1; i >= 0; i--) {
    const s = WEEKS[i].sessions.find(x => x.type === 'run_long' && isDone(x.id));
    if (s && !(state.done[s.id].parts && state.done[s.id].parts.run === false)) return s.minutes;
  }
  return null;
}
function bilanFor(w) {
  const list = w.sessions.filter(counts);
  const doneL = list.filter(s => isDone(s.id));
  const total = list.length, done = doneL.length;
  const partial = doneL.filter(s => { const p = state.done[s.id].parts; return p && !(p.run && p.renfo); }).length;
  const km = doneL.reduce((a, s) => a + ((state.done[s.id].stats || {}).km || 0), 0);
  const knee = { ras: 0, gene: 0, douleur: 0 };
  doneL.forEach(s => { const k = state.done[s.id].knee; if (k) knee[k]++; });
  const wheres = [...new Set(doneL.map(s => state.done[s.id].where).filter(Boolean))];
  const next = WEEKS[w.n]; // semaine suivante (undefined après la dernière)
  const lines = []; let tone = 'ok';
  let reduce = false;
  if (knee.douleur) { tone = 'care'; reduce = true; lines.push('Une douleur est notée cette semaine. Lève le pied : on n’augmente pas la sortie longue, et parles-en à ta kiné avant de reprendre le rythme prévu.'); }
  else if (knee.gene >= 2) { tone = 'care'; reduce = true; lines.push('Plusieurs gênes cette semaine. On n’augmente pas la sortie longue et on surveille. Si ça dure, parles-en à ta kiné.'); }
  else if (knee.gene === 1) lines.push('Une gêne notée : continue comme prévu en restant attentif. Si elle revient, ne rallonge pas la sortie longue.');
  if (done <= 2 && total >= 3) {
    reduce = true; if (tone === 'ok') tone = 'soft';
    lines.push(done === 2 ? 'Semaine à moitié faite. La règle du plan : on reprend la semaine précédente, sans rien rattraper.' : 'Semaine compliquée, ça arrive. On reprend la semaine précédente, tranquillement, sans rien rattraper.');
  } else if (!knee.douleur && knee.gene < 2) {
    lines.push(done === total ? 'Semaine complète, belle régularité. On continue comme prévu.' : 'Belle régularité. On continue comme prévu.');
  }
  // proposition pour la semaine suivante : on ne fait jamais monter, on plafonne
  const caps = {}; let why = '';
  if (next && next.n <= 25) {
    const lastLong = lastDoneLong(w.n);
    if (reduce) {
      const ref = WEEKS.slice(0, w.n - 1).reverse().find(x => !x.allegee) || w;
      why = 'reprise de la semaine ' + ref.n;
      for (const d of ['mer', 'ven', 'dim']) {
        const ns = next.sessions.find(x => x.day === d), rs = ref.sessions.find(x => x.day === d);
        const ok = t => t && (t.type === 'run_easy' || t.type === 'run_long') && t.minutes;
        if (ok(ns) && ok(rs) && rs.minutes < ns.minutes) caps[d] = rs.minutes;
      }
    }
    const nl = next.sessions.find(x => x.type === 'run_long');
    if (nl && lastLong && nl.minutes > Math.round(lastLong * 1.12)) {
      caps.dim = Math.min(caps.dim == null ? Infinity : caps.dim, Math.round(lastLong * 1.1));
      if (!why) why = 'la sortie longue prévue dépasse de plus de 12 % ta dernière sortie longue faite (' + fmtDur(lastLong) + ')';
    }
  }
  return { total, done, partial, km, knee, wheres, lines, tone, caps, why, next };
}
function pendingBilan() {
  for (let i = WEEKS.length - 2; i >= 0; i--) {
    const w = WEEKS[i];
    if (addDays(w.start, 6) < TODAY) return state.seen[w.n] ? null : w;
  }
  return null;
}
function bilanCard() {
  if (READONLY) return '';
  const w = pendingBilan(); if (!w) return '';
  const b = bilanFor(w);
  const planned = d => { const orig = BASE_WEEKS[b.next.n - 1].sessions.find(x => x.day === d); return orig ? orig.minutes : null; };
  const capKeys = Object.keys(b.caps);
  const already = b.next && state.adj[b.next.n] && capKeys.every(d => state.adj[b.next.n].m[d] === b.caps[d]);
  const facts = [`${b.done} séance${b.done > 1 ? 's' : ''} sur ${b.total}`, b.partial ? `dont ${b.partial} en partie` : '', b.km ? `${fmtKm(b.km)} km saisis` : '',
    b.knee.douleur ? 'douleur notée' : b.knee.gene ? `gêne notée${b.wheres.length ? ' (' + b.wheres.join(', ') + ')' : ''}` : b.knee.ras ? 'genoux : RAS' : ''].filter(Boolean);
  const proposal = capKeys.length && !already
    ? `<p class="bilan-prop"><b>Proposition pour la semaine ${b.next.n} :</b> ${capKeys.map(d => `${DAY_SHORT[d]} ${fmtDur(b.caps[d])} (prévu : ${fmtDur(planned(d))})`).join(' · ')}.<br><span class="muted small">Raison : ${esc(b.why)}. On ne fait que baisser, la semaine d’après reprend le plan.</span></p>
       <div class="btns"><button class="btn small" data-a="bilan-apply" data-n="${w.n}">Appliquer</button><button class="btn small line" data-a="bilan-seen" data-n="${w.n}">Garder le plan</button></div>`
    : `<div class="btns"><button class="btn small" data-a="bilan-seen" data-n="${w.n}">Compris</button></div>`;
  return `<section class="bilan ${b.tone}" aria-label="Bilan de la semaine ${w.n}">
    <p class="eyebrow">Bilan · semaine ${w.n} (${fmtDate(w.start, { day: 'numeric', month: 'short' })} au ${fmtDate(addDays(w.start, 6), { day: 'numeric', month: 'short' })})</p>
    <p class="bilan-facts">${facts.map(esc).join(' · ')}</p>
    ${b.lines.map(l => `<p class="bilan-text">${esc(l)}</p>`).join('')}
    ${proposal}
    <p class="small muted" style="margin-top:10px">Ces conseils sont des repères, pas un avis médical.</p>
  </section>`;
}

// Plan affiché = plan de base + plafonds appliqués après un bilan (jamais plus long que prévu)
let BASE_WEEKS;
function rebuild() {
  WEEKS = BASE_WEEKS.map(w => {
    const a = state.adj && state.adj[w.n];
    if (!a || !Object.keys(a.m).length) return w;
    let changed = false;
    const sessions = w.sessions.map(s => {
      const cap = a.m[s.day];
      if (!cap || !(s.type === 'run_easy' || s.type === 'run_long') || !s.minutes || cap >= s.minutes) return s;
      changed = true;
      return { ...s, minutes: cap, title: s.type === 'run_long' ? `Sortie longue ${fmtDur(cap)}` : `${cap} min facile`, adjusted: true };
    });
    return changed ? { ...w, sessions, adjusted: true } : w;
  });
  SESSIONS = WEEKS.flatMap(w => w.sessions);
}

/* ---------- Routeur ---------- */
const VIEWS = { today: viewToday, plan: viewPlan, profile: viewProfile, more: viewMore };
function route() { const r = location.hash.slice(1); return VIEWS[r] ? r : 'today'; }
function render() {
  const r = route();
  const app = $('#app');
  const open = [...document.querySelectorAll('details[open]')].map(d => d.id).filter(Boolean);
  const io = $('#io') ? $('#io').value : '';
  const banner = READONLY ? `<div class="ro-banner" role="status"><span><b>Lecture seule.</b> ${sharedError ? esc(sharedError) : `Tu consultes la progression, sans pouvoir la modifier.${sharedAt ? ` Mise à jour à ${sharedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.` : ''}`}</span><button type="button" class="mini" data-a="refresh">Actualiser</button></div>` : '';
  app.innerHTML = banner + VIEWS[r]();
  open.forEach(id => { const d = document.getElementById(id); if (d && r !== 'plan') d.open = true; });
  if (r === 'plan') open.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
  if (io && $('#io')) $('#io').value = io;
  $('#nav').innerHTML = NAV.map(([k, label, icon]) => `<a href="#${k}" ${k === r ? 'aria-current="page"' : ''} aria-label="${label}">${icon}<span class="t">${label}</span></a>`).join('');
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ---------- Démarrage ---------- */
(async function init() {
  try {
    PLAN = await (await fetch('/plan.json')).json();
    BASE_WEEKS = PLAN.weeks;
    WEEKS = BASE_WEEKS;
    SESSIONS = WEEKS.flatMap(w => w.sessions);
    load();
    if (READONLY) { const m = document.querySelector('link[rel=manifest]'); if (m) m.remove(); } // pas d'installation de la vue partagée comme app
    if (READONLY) { render(); await refreshShared(); } else { render(); syncNow(true); }
    if (!READONLY && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  } catch (e) {
    $('#app').innerHTML = '<p style="padding:24px">Impossible de charger le plan. Vérifie ta connexion et recharge la page.</p>';
  }
})();
