import test from 'node:test';
import assert from 'node:assert/strict';
import { hashNum, hashRows, hashText } from '../assets/js/core/canon.js';
import { checkAnswer, checkExerciseResult } from '../assets/js/core/quiz.js';

const salt = 'test-salt';

test('checks single and order-independent multi-select quiz answers', async () => {
  const single = { id: 'B0.1', type: 'single' };
  const multi = { id: 'B0.2', type: 'multi' };
  const key = {
    salt,
    items: {
      [single.id]: { kind: 'text', hash: await hashText(single.id, 'option-b', salt) },
      [multi.id]: { kind: 'text', hash: await hashText(multi.id, JSON.stringify(['a', 'c']), salt) },
    },
  };
  assert.equal(await checkAnswer(single, 'option-b', key), true);
  assert.equal(await checkAnswer(single, 'option-a', key), false);

  assert.equal(await checkAnswer(multi, ['c', 'a'], key), true);
  assert.equal(await checkAnswer(multi, ['a'], key), false);
});

test('checks numeric quiz and text exercise answers without storing their plaintext', async () => {
  const numeric = { id: 'B0.3', type: 'numeric' };
  const text = { id: 'E0.1', type: 'text' };
  const key = {
    salt,
    items: {
      [numeric.id]: { kind: 'num', tol: 0.1, hash: await hashNum(numeric.id, 12.3, 0.1, salt) },
      [text.id]: { kind: 'text', hash: await hashText(text.id, ' Résultat attendu ', salt) },
    },
  };
  assert.equal(await checkAnswer(numeric, '12.3', key), true);
  assert.equal(await checkAnswer(numeric, '10', key), false);

  assert.equal(await checkExerciseResult(text, 'résultat attendu', key), true);
});

test('checks SQL results with canonical row hashing', async () => {
  const exercise = {
    id: 'E0.2',
    type: 'sql',
  };
  const key = {
    salt,
    items: {
      [exercise.id]: {
        kind: 'sql',
        order_matters: false,
        hash: await hashRows(exercise.id, [['Paris', 2], ['Lyon', 1]], salt),
      },
    },
  };
  assert.equal(await checkExerciseResult(exercise, { rows: [['Lyon', 1], ['Paris', 2]] }, key), true);
  assert.equal(await checkExerciseResult(exercise, { rows: [['Paris', 2]] }, key), false);
});

test('rejects malformed or unsupported answers instead of returning success-shaped results', async () => {
  const key = { salt, items: { 'B0.4': { kind: 'num', hash: 'x'.repeat(64), tol: -1 } } };
  await assert.rejects(checkAnswer({ id: 'B0.4', type: 'numeric' }, 2, key), /valid num/);
  await assert.rejects(checkExerciseResult({ id: 'E0.2', type: 'sql' }, {}, { salt, items: {} }), /Missing sql answer key/);
  await assert.rejects(checkAnswer({ id: 'B0.5', type: 'unsupported' }, 'x', { salt, items: {} }), /Unsupported/);
});
