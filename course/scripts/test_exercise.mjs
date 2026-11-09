import test from 'node:test';
import assert from 'node:assert/strict';
import { hashRows, hashText } from '../assets/js/core/canon.js';
import { submitExercise } from '../assets/js/core/exercise.js';

const salt = 'exercise-test';

test('runs a Python exercise and checks its declared result against the answer key', async () => {
  const id = 'E0.1';
  const key = {
    salt,
    items: { [id]: { kind: 'text', hash: await hashText(id, 'monsters', salt) } },
  };
  const runner = {
    async run(options) {
      assert.equal(options.code, 'category = "monsters"');
      assert.equal(options.tests, 'assert category');
      assert.deepEqual(options.packages, ['pandas']);
      assert.equal(options.answerExpression, 'category');
      return { ok: true, answer: 'monsters', stdout: '' };
    },
  };
  const response = await submitExercise({
    exercise: { id, type: 'python', tests: 'assert category', answer_expression: 'category' },
    runner,
    answerKey: key,
    code: 'category = "monsters"',
    packages: ['pandas'],
  });
  assert.deepEqual(response, { status: 'checked', correct: true, execution: { ok: true, answer: 'monsters', stdout: '' } });
});

test('returns execution errors explicitly and does not grade failed Python code', async () => {
  const result = await submitExercise({
    exercise: { id: 'E0.2', type: 'python', answer_expression: 'answer' },
    runner: { run: async () => ({ ok: false, error: 'SyntaxError' }) },
    answerKey: { salt, items: {} },
    code: 'if:',
  });
  assert.deepEqual(result, { status: 'error', execution: { ok: false, error: 'SyntaxError' } });
});

test('executes SQL and checks its rows against the canonical answer hash', async () => {
  const id = 'E0.3';
  const rows = [['Lyon', 1], ['Paris', 2]];
  const key = {
    salt,
    items: { [id]: { kind: 'sql', hash: await hashRows(id, rows, salt), order_matters: false } },
  };
  const result = await submitExercise({
    exercise: { id, type: 'sql' },
    runner: {
      async execute(query) {
        assert.equal(query, 'SELECT region, COUNT(*) FROM players GROUP BY region');
        return { rows, columns: ['region', 'count'] };
      },
    },
    answerKey: key,
    query: 'SELECT region, COUNT(*) FROM players GROUP BY region',
  });
  assert.equal(result.status, 'checked');
  assert.equal(result.correct, true);
});

test('rejects missing runner, unsupported type, and absent Python answer output', async () => {
  await assert.rejects(submitExercise({ exercise: { id: 'E0.1', type: 'python' } }), /runner is required/);
  await assert.rejects(submitExercise({ exercise: { id: 'E0.1', type: 'other' } }), /Unsupported/);
  await assert.rejects(submitExercise({
    exercise: { id: 'E0.1', type: 'python', answer_expression: 'answer' },
    runner: { run: async () => ({ ok: true, stdout: 'x' }) },
  }), /returned no answer/);
});
