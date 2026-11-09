// Moteur de combat de boss pour les QCM. Logique pure : aucun accès au DOM,
// aucune dépendance. La correction de la réponse (hachage) reste dans quiz.js.

export const RULES = {
  playerHp: 100,
  bossHp: 100,
  hit:  { 1: 8,  2: 10, 3: 14 },  // dégâts au boss selon la difficulté de la question
  hurt: { 1: 40, 2: 34, 3: 26 },  // dégâts au joueur : rater une question facile coûte plus cher
  comboAt: 3,        // à partir de 3 bonnes réponses d'affilée : frappe critique
  comboMult: 1.5,
  enrageBelow: 0.5,  // phase 2 quand le boss passe sous 50 % de PV
  enrageMult: 1.2,   // les erreurs coûtent 20 % de plus en phase 2
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function validateRules(r) {
  for (const [name, value] of [['playerHp', r.playerHp], ['bossHp', r.bossHp]]) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive number`);
  }
  for (const name of ['hit', 'hurt']) {
    for (const difficulty of [1, 2, 3]) {
      if (!Number.isFinite(r[name]?.[difficulty]) || r[name][difficulty] <= 0) {
        throw new TypeError(`${name}[${difficulty}] must be a positive number`);
      }
    }
  }
  if (!Number.isInteger(r.comboAt) || r.comboAt < 1) throw new TypeError('comboAt must be a positive integer');
  if (!Number.isFinite(r.comboMult) || r.comboMult < 1) throw new TypeError('comboMult must be at least 1');
  if (!Number.isFinite(r.enrageBelow) || r.enrageBelow < 0 || r.enrageBelow > 1) {
    throw new TypeError('enrageBelow must be between 0 and 1');
  }
  if (!Number.isFinite(r.enrageMult) || r.enrageMult < 1) throw new TypeError('enrageMult must be at least 1');
}

function validateBank(bank) {
  if (!Array.isArray(bank) || bank.length === 0) throw new TypeError('question bank must not be empty');
  const ids = new Set();
  for (const question of bank) {
    if (!question || typeof question.id !== 'string' || question.id.trim() === '') {
      throw new TypeError('every question must have a non-empty string id');
    }
    if (ids.has(question.id)) throw new TypeError(`duplicate question id: ${question.id}`);
    ids.add(question.id);
    const difficulty = question.difficulty ?? 2;
    if (![1, 2, 3].includes(difficulty)) throw new TypeError(`invalid difficulty for ${question.id}`);
  }
}

export function createFight(bank, { rules = {}, seed = Date.now() } = {}) {
  validateBank(bank);
  const r = {
    ...RULES,
    ...rules,
    hit: { ...RULES.hit, ...rules.hit },
    hurt: { ...RULES.hurt, ...rules.hurt },
  };
  validateRules(r);
  if (typeof seed !== 'number' || !Number.isFinite(seed)) throw new TypeError('seed must be a finite number');
  const pool = shuffle(bank.map(q => ({ id: q.id, difficulty: q.difficulty ?? 2 })), mulberry32(seed));
  return { r, pool, bossHp: r.bossHp, playerHp: r.playerHp, streak: 0, round: 0, correct: 0, status: 'ongoing' };
}

export const isPhase2 = s => s.bossHp <= s.r.bossHp * s.r.enrageBelow;

// Phase 1 : questions de difficulté 1-2. Phase 2 : difficulté 2-3. Repli sur le reste.
export function nextQuestion(s) {
  if (s.status !== 'ongoing') return null;
  const wanted = isPhase2(s) ? q => q.difficulty >= 2 : q => q.difficulty <= 2;
  return s.pool.find(wanted) ?? s.pool[0] ?? null;
}

export function resolve(s, questionId, correct) {
  if (!s || s.status !== 'ongoing') throw new Error('fight is not ongoing');
  if (typeof correct !== 'boolean') throw new TypeError('correct must be a boolean');
  const currentQuestion = nextQuestion(s);
  if (!currentQuestion || currentQuestion.id !== questionId) {
    throw new Error('questionId must match the next question');
  }
  const q = s.pool.find(x => x.id === questionId);
  const pool = s.pool.filter(x => x.id !== questionId);
  let { bossHp, playerHp, streak } = s;
  let event;
  if (correct) {
    streak++;
    const crit = streak >= s.r.comboAt;
    const dmg = Math.round(s.r.hit[q.difficulty] * (crit ? s.r.comboMult : 1));
    bossHp = Math.max(0, bossHp - dmg);
    event = { type: 'hit', dmg, crit };
  } else {
    const enraged = isPhase2(s);
    const dmg = Math.round(s.r.hurt[q.difficulty] * (enraged ? s.r.enrageMult : 1));
    playerHp = Math.max(0, playerHp - dmg);
    streak = 0;
    event = { type: 'hurt', dmg, enraged };
  }
  let status = 'ongoing';
  if (bossHp === 0) status = 'won';
  else if (playerHp === 0) status = 'lost';
  else if (!pool.length) status = bossHp / s.r.bossHp < playerHp / s.r.playerHp ? 'won' : 'lost';
  return { ...s, pool, bossHp, playerHp, streak, round: s.round + 1,
           correct: s.correct + (correct ? 1 : 0), status, event };
}

// Résumé à stocker dans la progression (clé modules.<id>.quiz.fight)
export const summary = (s, seconds) => ({
  won: s.status === 'won', rounds: s.round, accuracy: s.round ? s.correct / s.round : 0,
  pv_left: s.playerHp, flawless: s.status === 'won' && s.playerHp === s.r.playerHp, seconds,
});
