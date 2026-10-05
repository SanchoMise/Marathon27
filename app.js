// Marathon 27 · suivi de prépa. Site statique, progression en localStorage.
const KEY = 'marathon27:v1';
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
let state = { done: {}, skipped: {}, u: {} }; // u : date de dernière modification par séance (pour la synchro)
let TODAY = todayStr();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = normalize(JSON.parse(raw));
  } catch (e) { /* stockage indisponible : on continue en mémoire */ }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
  schedulePush();
}
const touch = id => { state.u[id] = Date.now(); };
function normalize(o) {
  const ids = new Set(SESSIONS ? SESSIONS.map(s => s.id) : []);
  const r = { done: {}, skipped: {}, u: {} };
  for (const [id, v] of Object.entries((o && o.done) || {})) {
    if (!ids.size || ids.has(id)) r.done[id] = { t: v.t || null, knee: KNEE[v.knee] ? v.knee : null };
  }
  for (const id of Object.keys((o && o.skipped) || {})) if (!ids.size || ids.has(id)) r.skipped[id] = true;
  const u = (o && o.u) || {};
  for (const id of new Set([...Object.keys(r.done), ...Object.keys(r.skipped), ...Object.keys(u)])) {
    if (ids.size && !ids.has(id)) continue;
    const t = r.done[id] && Date.parse(r.done[id].t);
    r.u[id] = Number(u[id]) || (Number.isFinite(t) ? t : 0);
  }
  return r;
}
// Fusion : pour chaque séance, la modification la plus récente gagne (une annulation compte comme une modification).
function mergeStates(a, b) {
  const r = { done: {}, skipped: {}, u: {} };
  for (const id of new Set([...Object.keys(a.u), ...Object.keys(b.u)])) {
    const src = (a.u[id] || 0) >= (b.u[id] || 0) ? a : b;
    r.u[id] = src.u[id] || 0;
    if (src.done[id]) r.done[id] = { ...src.done[id] };
    else if (src.skipped[id]) r.skipped[id] = true;
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
const DAILY = [
  'Une séance à la fois. Pas besoin d’en faire plus.',
  'Tu avances à ton rythme, et c’est le bon.',
  'Arriver au départ en forme, c’est déjà gagner.',
  'Facile, c’est facile. Garde de la marge.',
];

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
      ? 'À la salle. Garde 2 répétitions en réserve. Un genou à plus de 3/10 ou un ménisque qui bloque : tu arrêtes l’exercice.'
      : '';
    case 'race': return 'Pars plus lent que ton allure marathon. Marche 1 min toutes les 10 à 15 min si besoin. Rien de nouveau le jour J.';
    default: return '';
  }
}

/* ---------- Rendu : briques ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kneeTag = id => {
  const k = state.done[id] && state.done[id].knee;
  return `<button class="knee-tag ${k || ''}" data-a="knee" data-id="${id}" aria-label="Ressenti des genoux : ${k ? KNEE[k] : 'non renseigné'}. Modifier">${k ? KNEE[k] : 'Genoux ?'}</button>`;
};
function sessionRow(s, opts = {}) {
  const t = TYPES[s.type];
  const done = isDone(s.id);
  const dur = s.minutes ? ` · ${fmtDur(minutesOf(s))}` : '';
  if (s.type === 'rest') {
    return `<div class="row"><span class="stripe t-rest"></span><div><div class="when">${fmtDate(s.date)}</div><div class="what">Repos. Rien à faire.</div></div><span></span></div>`;
  }
  const skipped = state.skipped[s.id];
  return `<div class="row ${done ? 'is-done' : ''}">
    <span class="stripe ${t.cls}"></span>
    <div><div class="when">${fmtDate(s.date)} · ${s.place}${skipped ? ' · passée' : ''}</div>
      <div class="what">${esc(titleOf(s))}</div></div>
    <div class="acts">${done ? kneeTag(s.id) : ''}${opts.late && !done ? `<button class="mini" data-a="skip" data-id="${s.id}">Passer</button>` : ''}
      <button class="check" data-a="toggle" data-id="${s.id}" aria-pressed="${done}" aria-label="${done ? 'Annuler la validation' : 'Valider'} : ${esc(titleOf(s))}, ${fmtDate(s.date)}">${I.check}</button></div>
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
  const hero = todays && !doneToday ? todays : upcoming[0];
  const late = list.filter(s => s.date < TODAY && !isDone(s.id) && !state.skipped[s.id]);
  const nextUp = upcoming.filter(s => !hero || s.id !== hero.id).slice(0, 2);

  const alertK = kneeAlert();
  const skippedThisWeek = cw.sessions.filter(s => state.skipped[s.id]).length;

  let html = `<header class="top">
    <span class="num display" aria-hidden="true">${days}</span>
    <p class="lbl"><span class="sr">${days} </span>${days > 1 ? 'jours' : 'jour'} avant le marathon,<br><span class="muted">dim. 4 avril 2027</span><span class="wk">Sem. ${cw.n} / 26</span></p>
  </header>`;

  if (alertK) html += alertBox(alertK);
  if (skippedThisWeek >= 2) {
    html += `<div class="note"><b>Deux séances passées cette semaine.</b> Pas de souci : tu reprends la semaine précédente, sans rien rattraper.</div>`;
  }

  if (doneToday) {
    html += `<div class="block-title" style="margin-bottom:8px"><h2 class="h2">Faite aujourd’hui</h2></div><div class="list">${sessionRow(doneToday)}</div>${cheerCard(cheerFor(doneToday), true)}`;
  }
  if (hero) {
    if (doneToday) html += `<div class="block-title" style="margin:22px 0 8px"><h2 class="h2">Ensuite</h2></div>`;
    html += heroCard(hero, todays === hero);
  } else html += `<div class="card t-rest hero"><h2>Tout est validé pour l’instant.</h2></div>`;

  if (!doneToday) html += cheerCard(pick(DAILY, TODAY), false);

  html += contextNotes(cw);
  if (late.length) {
    html += `<div class="block" style="margin-top:22px"><div class="block-title"><h2 class="h2">Séances passées</h2></div>
      <p class="small muted" style="margin-bottom:10px">On ne rattrape rien. Coche ce que tu as fait, ou passe le reste.</p>
      <div class="list">${late.map(s => sessionRow(s, { late: true })).join('')}</div></div>`;
  }

  html += `<section class="block"><div class="block-title"><h2 class="h2">Cette semaine</h2><span class="stat">${ws.done}<small>/ ${ws.total}</small></span></div>${segs(ws.done, ws.total)}</section>
  <section class="block"><div class="block-title"><h2 class="h2">Ma prépa</h2><span class="stat">${pct}<small>%</small></span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${tot.total}" aria-valuenow="${tot.done}" aria-label="Séances validées"><i style="width:${pct}%"></i></div>
    <p class="small muted" style="margin-top:8px">${tot.done} séances validées sur ${tot.total}</p></section>`;

  if (nextUp.length) {
    html += `<section class="block"><div class="block-title"><h2 class="h2">Puis</h2></div><div class="list">${nextUp.map(s => sessionRow(s)).join('')}</div></section>`;
  }
  return html;
}

function cheerCard(text, after) {
  return `<figure class="quote"><figcaption>${after ? 'Bien joué' : 'Un mot pour toi'}</figcaption><blockquote>${esc(text)}</blockquote></figure>`;
}

function heroCard(s, isToday) {
  const t = TYPES[s.type];
  const done = isDone(s.id);
  const m = minutesOf(s);
  const when = isToday ? 'Aujourd’hui' : TODAY < s.date ? `Prochaine séance · ${fmtDate(s.date)}` : fmtDate(s.date);
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
    <div class="cta-row">
      ${done
        ? `<span class="done-badge">${I.check.replace('<svg', '<svg width="28" height="28"')} Validée</span>${kneeTag(s.id)}<button class="btn ghost small" data-a="toggle" data-id="${s.id}">Annuler</button>`
        : `<button class="btn" data-a="toggle" data-id="${s.id}">${I.check.replace('<svg', '<svg width="24" height="24"')} C’est fait</button>`}
      ${s.type === 'renfo' ? `<button class="btn ghost small" data-a="goto" data-t="renfo">Voir les exercices</button>` : ''}
    </div>
  </article>`;
}

function alertBox(kind) {
  const title = kind === 'douleur' ? 'Une douleur est notée' : 'Deux gênes de suite';
  return `<div class="alert" role="alert"><h3>${I.warn} ${title}</h3>
    <p><b>Lève le pied.</b> Ne rallonge pas ta prochaine sortie longue et laisse le corps récupérer.</p>
    <p>Pense à voir un kiné du sport. Cette appli ne pose aucun diagnostic.</p></div>`;
}

function contextNotes(cw) {
  let h = '';
  if (cw.n <= 8) h += `<div class="note"><b>Avant la semaine 9 (30 nov.).</b> Fais voir ton genou qui coince à l’accroupissement à un kiné ou au chirurgien, avant que les sorties dépassent 1 h.</div>`;
  if (cw.n === 21 || cw.n === 22) h += `<div class="note"><b>Point de décision.</b> Si un genou a protesté cette semaine ou la précédente, la sortie de la semaine 23 passe de ${fmtDur(180)} à ${fmtDur(WEEKS[21].sessions.find(x => x.day === 'dim').minutes)}.</div>`;
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
          <span class="wmeta">${fmtDate(w.start, { day: 'numeric', month: 'short' })} · ${w.phase}${w.allegee ? '<span class="tagpill">allégée</span>' : ''}${w.tag && !w.allegee ? `<span class="wsub">${esc(w.tag)}</span>` : `<span class="wsub">${w.allegee ? 'On ne la saute pas' : '&nbsp;'}</span>`}</span>
          <span class="wprog">${st.done}/${st.total}<span class="dots" aria-hidden="true">${Array.from({ length: st.total }, (_, i) => `<i class="${i < st.done ? 'on' : ''}"></i>`).join('')}</span></span></summary>
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
  return `<h1 class="display" style="font-size:72px">Plus</h1>
  <details class="acc" id="renfo"><summary>Renfo</summary><div class="acc-body">
    <p class="muted">Le renfo protège tes genoux plus qu’une sortie de plus. Contenu général, à faire valider par ton kiné.</p>
    <h3>Séance A · lundi midi, salle (20 à 30 min)</h3>
    <p>Échauffement 5 min : marche rapide ou vélo. Séries selon la séance du jour, repos 60 à 90 s entre séries.</p>
    <ol><li>Presse à cuisses : 10 à 12 répétitions, charge modérée, genoux à 90° maximum.</li>
      <li>Curl ischios : 10 à 12 répétitions, montée en 2 s, descente en 3 s.</li>
      <li>Montée sur marche basse (15 à 20 cm) : 8 par jambe, bassin stable.</li>
      <li>Pont fessier : 12 répétitions, puis sur une jambe quand c’est facile.</li>
      <li>Mollets debout : 15 répétitions.</li>
      <li>Gainage : planche 30 s, planche latérale 20 s de chaque côté.</li></ol>
    <p>Il te reste 2 répétitions en réserve. Si le genou fait mal (plus de 3 sur 10) ou si le ménisque se bloque, tu arrêtes l’exercice.</p>
    <h3>Séance B · vendredi soir, 10 min après la course</h3>
    <p>Pont fessier 2 × 12, marche latérale avec élastique 2 × 12 pas de chaque côté, mollets 2 × 15, planche 2 × 30 s.</p>
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
const getCode = () => { try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } };
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
    <p class="small muted" id="sync-msg" role="status">${esc(syncInfo.text)}</p>`;
}
const syncMsg = t => { syncInfo.text = t; const m = $('#sync-msg'); if (m) m.textContent = t; };
async function api(code, body) {
  const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, ...body }) });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}
async function syncNow(quiet) {
  const code = getCode(); if (!code || syncInfo.busy) return;
  syncInfo.busy = true;
  try {
    const { state: remote } = await api(code, { action: 'get' });
    const before = JSON.stringify(state);
    state = mergeStates(state, normalize(remote || {}));
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
    await api(code, { action: 'put', state });
    syncMsg('Synchronisé à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '.');
    if (JSON.stringify(state) !== before) render();
  } catch (e) {
    syncMsg(quiet ? 'Hors ligne : ce sera synchronisé plus tard.' : 'Synchro impossible pour l’instant. Réessaie, ta progression reste sur cet appareil.');
  } finally { syncInfo.busy = false; }
}
let pushTimer;
function schedulePush() { if (!getCode()) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(true), 900); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(true); });

/* ---------- Bottom sheet : ressenti des genoux ---------- */
function openKnee(id, fresh) {
  const s = SESSIONS.find(x => x.id === id);
  const cur = state.done[id] && state.done[id].knee;
  $('#sheet-root').innerHTML = `<div class="scrim" data-a="close-sheet"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <h2 id="sh-t">Et tes genoux ?</h2><p>${esc(titleOf(s))} · optionnel.</p>
    <div class="knee-opts">
      <button class="opt ras" data-a="set-knee" data-k="ras" data-id="${id}">RAS<small>${cur === 'ras' ? '✓' : ''}</small></button>
      <button class="opt gene" data-a="set-knee" data-k="gene" data-id="${id}">Gêne<small>${cur === 'gene' ? '✓' : ''}</small></button>
      <button class="opt douleur" data-a="set-knee" data-k="douleur" data-id="${id}">Douleur<small>${cur === 'douleur' ? '✓' : ''}</small></button></div>
    <button class="btn line block" data-a="close-sheet">${fresh ? 'Passer' : 'Fermer'}</button></div></div>`;
  const b = $('.opt'); if (b) b.focus();
}
const closeSheet = () => { $('#sheet-root').innerHTML = ''; };

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
  'sync-new': () => { setCode(newCode()); syncMsg(''); render(); syncNow(); },
  'sync-join': () => {
    const c = ($('#code-in').value || '').trim().toUpperCase();
    if (!codeOk(c)) return syncMsg('Ce code n’a pas le bon format.');
    setCode(c); render(); syncNow();
  },
  'sync-copy': async () => { try { await navigator.clipboard.writeText(getCode()); syncMsg('Code copié.'); } catch (e) { syncMsg('Copie-le à la main.'); } },
  'sync-now': () => syncNow(),
  'sync-off': () => { if (confirm('Déconnecter cet appareil ? Ta progression reste ici, mais ne se synchronise plus.')) { setCode(''); syncMsg(''); render(); } },
  toggle: e => toggle(e.dataset.id),
  skip: e => { state.skipped[e.dataset.id] = true; touch(e.dataset.id); save(); render(); },
  knee: e => openKnee(e.dataset.id, false),
  'close-sheet': (e, ev) => { if (ev.target === e) closeSheet(); },
  'set-knee': e => {
    const id = e.dataset.id; if (state.done[id]) { state.done[id].knee = e.dataset.k; touch(id); }
    save(); closeSheet(); render();
  },
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
      state = normalize(data); SESSIONS.forEach(x => touch(x.id)); save(); msg(`Importé : ${Object.keys(state.done).length} séances validées.`);
    } catch (e) { msg('Ce texte n’est pas une sauvegarde valide.'); }
  },
  reset: () => { if (confirm('Effacer toute la progression de cet appareil ?')) { state = { done: {}, skipped: {}, u: {} }; SESSIONS.forEach(x => touch(x.id)); save(); msg('Progression effacée.'); } },
};
const msg = t => { const m = $('#io-msg'); if (m) m.textContent = t; };

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (el && actions[el.dataset.a]) actions[el.dataset.a](el, ev);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') closeSheet();
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.bar-hit')) { ev.preventDefault(); actions.pick(ev.target); }
});

/* ---------- Routeur ---------- */
const VIEWS = { today: viewToday, plan: viewPlan, profile: viewProfile, more: viewMore };
function route() { const r = location.hash.slice(1); return VIEWS[r] ? r : 'today'; }
function render() {
  const r = route();
  const app = $('#app');
  const open = [...document.querySelectorAll('details[open]')].map(d => d.id).filter(Boolean);
  const io = $('#io') ? $('#io').value : '';
  app.innerHTML = VIEWS[r]();
  open.forEach(id => { const d = document.getElementById(id); if (d && r !== 'plan') d.open = true; });
  if (r === 'plan') open.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
  if (io && $('#io')) $('#io').value = io;
  $('#nav').innerHTML = NAV.map(([k, label, icon]) => `<a href="#${k}" ${k === r ? 'aria-current="page"' : ''} aria-label="${label}">${icon}<span class="t">${label}</span></a>`).join('');
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ---------- Démarrage ---------- */
(async function init() {
  try {
    PLAN = await (await fetch('plan.json')).json();
    WEEKS = PLAN.weeks;
    SESSIONS = WEEKS.flatMap(w => w.sessions);
    load();
    render();
    syncNow(true);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) {
    $('#app').innerHTML = '<p style="padding:24px">Impossible de charger le plan. Vérifie ta connexion et recharge la page.</p>';
  }
})();
