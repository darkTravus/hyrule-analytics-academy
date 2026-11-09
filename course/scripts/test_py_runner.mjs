import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TIMEOUT_MS, PYODIDE_VERSION, PythonRunner } from '../assets/js/runners/py-runner.js';

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
    this.response?.(message, this);
  }

  emit(type, data) {
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
  }

  terminate() {
    this.terminated = true;
  }
}

test('uses pinned Pyodide and a 20-second execution timeout', () => {
  assert.equal(PYODIDE_VERSION, '314.0.7');
  assert.equal(DEFAULT_TIMEOUT_MS, 20_000);
});

test('sends code, files, tests, and packages to the worker and returns its result', async () => {
  const workers = [];
  const runner = new PythonRunner({
    workerFactory: () => {
      const worker = new FakeWorker(message => queueMicrotask(() => worker.emit('message', {
        id: message.id,
        ok: true,
        result: { ok: true, stdout: 'done', figures: [] },
      })));
      workers.push(worker);
      return worker;
    },
  });
  const result = await runner.run({
    code: 'print("done")',
    tests: 'assert True',
    files: [{ path: 'example.csv', content: 'value\n1\n' }],
    packages: ['pandas'],
    answerExpression: 'answer',
  });
  assert.equal(result.stdout, 'done');
  assert.equal(workers[0].messages[0].files[0].path, 'example.csv');
  assert.deepEqual(workers[0].messages[0].packages, ['pandas']);
  assert.equal(workers[0].messages[0].answerExpression, 'answer');
  runner.dispose();
});

test('terminates an over-time worker and starts a fresh one', async () => {
  const workers = [];
  const runner = new PythonRunner({
    timeoutMs: 10,
    workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  await assert.rejects(runner.run({ code: 'while True: pass' }), /arrêtée après 10 ms/);
  assert.equal(workers.length, 2);
  assert.equal(workers[0].terminated, true);
  runner.dispose();
});
