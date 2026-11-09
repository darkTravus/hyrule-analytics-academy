import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, nextQuestion, resolve, summary } from '../assets/js/core/boss-fight.js';

const bank = [
  { id: 'Q1', difficulty: 1 },
  { id: 'Q2', difficulty: 1 },
  { id: 'Q3', difficulty: 1 },
  { id: 'Q4', difficulty: 2 },
  { id: 'Q5', difficulty: 3 },
];

test('same seed produces the same question order without duplicates', () => {
  const first = createFight(bank, { seed: 42 });
  const second = createFight(bank, { seed: 42 });
  assert.deepEqual(first.pool, second.pool);
  assert.equal(new Set(first.pool.map(question => question.id)).size, bank.length);
});

test('a fight changes HP and streak correctly, then summarizes the outcome', () => {
  let state = createFight(bank.slice(0, 3), { seed: 7 });
  const first = nextQuestion(state);
  state = resolve(state, first.id, true);
  assert.equal(state.bossHp, 92);
  assert.equal(state.streak, 1);
  const second = nextQuestion(state);
  state = resolve(state, second.id, false);
  assert.equal(state.playerHp, 60);
  assert.equal(state.streak, 0);
  assert.deepEqual(summary(state, 30), {
    won: false,
    rounds: 2,
    accuracy: 0.5,
    pv_left: 60,
    flawless: false,
    seconds: 30,
  });
});

test('critical damage starts at the configured streak threshold', () => {
  let state = createFight(bank.slice(0, 3), { seed: 10 });
  for (let count = 0; count < 3; count++) {
    state = resolve(state, nextQuestion(state).id, true);
  }
  assert.equal(state.bossHp, 72);
  assert.equal(state.event.crit, true);
});

test('phase two draws only difficulty 2 or 3 questions', () => {
  const phaseBank = [
    { id: 'E1', difficulty: 1 },
    { id: 'E2', difficulty: 1 },
    { id: 'H1', difficulty: 2 },
    { id: 'H2', difficulty: 3 },
  ];
  let state = createFight(phaseBank, {
    seed: 1,
    rules: { hit: { 1: 25, 2: 25, 3: 25 } },
  });
  state = resolve(state, nextQuestion(state).id, true);
  state = resolve(state, nextQuestion(state).id, true);
  assert.equal(state.bossHp, 50);
  assert.ok(nextQuestion(state).difficulty >= 2);
});

test('when the bank empties, remaining HP proportions decide the winner', () => {
  const state = createFight([{ id: 'Q1', difficulty: 1 }], {
    seed: 2,
    rules: { hit: { 1: 1, 2: 1, 3: 1 } },
  });
  const result = resolve(state, nextQuestion(state).id, true);
  assert.equal(result.status, 'won');
  assert.equal(result.bossHp / result.r.bossHp, 0.99);
  assert.equal(result.playerHp / result.r.playerHp, 1);
});

test('invalid banks, seeds, answers, and question order are rejected', () => {
  assert.throws(() => createFight([], { seed: 1 }), /must not be empty/);
  assert.throws(() => createFight([{ id: 'Q1' }, { id: 'Q1' }], { seed: 1 }), /duplicate/);
  assert.throws(() => createFight(bank, { seed: Number.NaN }), /finite number/);
  let state = createFight(bank, { seed: 1 });
  assert.throws(() => resolve(state, 'unknown', true), /next question/);
  assert.throws(() => resolve(state, nextQuestion(state).id, 1), /boolean/);
  state = resolve(state, nextQuestion(state).id, true);
  assert.throws(() => resolve(state, 'unknown', true), /next question/);
});
