// Simulation Monte-Carlo : probabilité de victoire selon la justesse réelle de l'élève.
// Usage : node scripts/balance_sim.mjs [essais]
import { createFight, nextQuestion, resolve } from '../assets/js/core/boss-fight.js';

const N = Number(process.argv[2] ?? 20000);
// Banque type : 8 faciles, 8 moyennes, 4 difficiles (les 20 questions d'un module)
const bank = Array.from({ length: 20 }, (_, i) => ({ id: 'Q' + i, difficulty: i < 8 ? 1 : i < 16 ? 2 : 3 }));

// Référence : probabilité de réussir l'ancien QCM (au moins 8 bonnes réponses sur 10)
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
const old = p => [8, 9, 10].reduce((a, k) => a + C(10, k) * p ** k * (1 - p) ** (10 - k), 0);
console.log('justesse | victoire | ancien QCM 8/10 | tours moyens | PV restants (victoires)');
for (const p of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0]) {
  let wins = 0, rounds = 0, pv = 0;
  for (let i = 0; i < N; i++) {
    let s = createFight(bank, { seed: i + 1 });
    let rng = (i * 2654435761) >>> 0;
    const rand = () => (rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296;
    while (s.status === 'ongoing') s = resolve(s, nextQuestion(s).id, rand() < p);
    rounds += s.round;
    if (s.status === 'won') { wins++; pv += s.playerHp; }
  }
  console.log(`${(p*100).toFixed(0).padStart(7)}% | ${(100*wins/N).toFixed(1).padStart(7)}% | ${(100*old(p)).toFixed(1).padStart(14)}% | ${(rounds/N).toFixed(1).padStart(12)} | ${wins ? (pv/wins).toFixed(0) : '-'}`);
}
