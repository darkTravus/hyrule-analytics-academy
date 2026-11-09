import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SQL_TIMEOUT_MS, MAX_ROWS, SQLJS_VERSION, SqlRunner, validateReadOnlyQuery } from '../assets/js/runners/sql-runner.js';

class FakeWorker {
  listeners = new Map();
  messages = [];
  response;
  terminated = false;

  constructor(response) {
    this.response = response;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(message) {
    this.messages.push(message);
    if (message.type === 'init') queueMicrotask(() => this.emit('message', { type: 'ready' }));
    else this.response?.(message, this);
  }

  emit(type, data) {
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
  }

  terminate() {
    this.terminated = true;
  }
}

test('allows SELECT and WITH and removes one trailing terminator', () => {
  assert.equal(validateReadOnlyQuery('SELECT 1;'), 'SELECT 1');
  assert.equal(validateReadOnlyQuery('WITH sample AS (SELECT 1) SELECT * FROM sample'), 'WITH sample AS (SELECT 1) SELECT * FROM sample');
  assert.equal(validateReadOnlyQuery("SELECT 'DROP TABLE users'"), "SELECT 'DROP TABLE users'");
});

test('rejects writes, dangerous pragmas, and multiple statements', () => {
  for (const query of [
    'UPDATE players SET platform = "pc"',
    'WITH x AS (SELECT 1) DELETE FROM players',
    'SELECT * FROM players; DROP TABLE players',
    'SELECT 1; SELECT 2',
    'PRAGMA table_info(players)',
    'SELECT load_extension("extension")',
    'SELECT 1 /* unterminated',
  ]) assert.throws(() => validateReadOnlyQuery(query));
});

test('pins sql.js and caps displayed output', () => {
  assert.equal(SQLJS_VERSION, '1.13.0');
  assert.equal(MAX_ROWS, 200);
  assert.equal(DEFAULT_SQL_TIMEOUT_MS, 10_000);
});

test('executes queries in a worker and sends them only after policy validation', async () => {
  let worker;
  const runner = new SqlRunner(new Uint8Array([1, 2, 3]), {
    workerFactory: () => {
      worker = new FakeWorker(message => queueMicrotask(() => worker.emit('message', {
        id: message.id,
        ok: true,
        result: { columns: ['value'], rows: [[1]], rowCount: 1, truncated: false, queryPlan: [], elapsedMs: 1 },
      })));
      return worker;
    },
  });
  const result = await runner.execute('SELECT 1');
  assert.deepEqual(result.rows, [[1]]);
  assert.equal(worker.messages[1].query, 'SELECT 1');
  await assert.rejects(runner.execute('DELETE FROM players'), /SELECT et WITH/);
  runner.dispose();
});

test('kills and recreates the SQL worker after timeout', async () => {
  const workers = [];
  const runner = new SqlRunner(new Uint8Array([1]), {
    timeoutMs: 10,
    workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  workers[0].emit('message', { type: 'ready' });
  const query = runner.execute('SELECT 1');
  await assert.rejects(query, /arrêtée après 10 ms/);
  assert.equal(workers.length, 2);
  assert.equal(workers[0].terminated, true);
  runner.dispose();
});
