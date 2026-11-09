import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  createProgress,
  exportProgress,
  importProgress,
  loadProgress,
  saveProgress,
  setModuleProgress,
  validateProgress,
} from '../assets/js/core/progress.js';
import { createToken, verifyToken } from '../assets/js/core/token.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test('creates, saves, loads, exports, and imports versioned progress', () => {
  const storage = new MemoryStorage();
  const initial = createProgress(' Link42 ');
  assert.equal(initial.alias, 'Link42');
  assert.equal(loadProgress(storage), null);

  const updated = setModuleProgress(initial, 'm2', {
    fight: { won: true, attempts: 2 },
    exercises: { 'E2.1': { done: true, xp: 10, hints_used: 1 } },
  });
  saveProgress(updated, storage);
  assert.deepEqual(loadProgress(storage), updated);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(updated));

  const importedStorage = new MemoryStorage();
  assert.deepEqual(importProgress(exportProgress(updated), importedStorage), updated);
  assert.deepEqual(loadProgress(importedStorage), updated);
});

test('rejects invalid progress and reports broken storage data', () => {
  const storage = new MemoryStorage();
  const initial = createProgress('Link42');
  assert.throws(() => createProgress('  '), /non-empty/);
  assert.throws(() => validateProgress({ ...initial, version: 2 }), /Unsupported progress version/);
  assert.throws(() => validateProgress({ ...initial, xp_total: -1 }), /xp_total/);
  assert.throws(() => setModuleProgress(initial, 'm10', {}), /Invalid module id/);
  assert.throws(() => importProgress('{bad json', storage), /not valid JSON/);
  storage.setItem(STORAGE_KEY, '{bad json');
  assert.throws(() => loadProgress(storage), /not valid JSON/);
  assert.throws(() => loadProgress({}), /Web Storage is unavailable/);
});

test('creates and verifies deterministic tokens with Unicode payloads', async () => {
  const payload = {
    alias: 'Élève 🧭',
    module: 'm4',
    hearts: 3,
    xp: 120,
    date: '2026-11-06',
    nonce: 'fixed-nonce',
  };
  const token = await createToken(payload, 'course-salt');
  assert.match(token, /^[A-Za-z0-9_-]+\.[a-f0-9]{16}$/);
  assert.deepEqual(await verifyToken(token, 'course-salt'), { valid: true, payload });
});

test('rejects altered, malformed, and incorrectly salted tokens', async () => {
  const token = await createToken({
    alias: 'Link42',
    module: 'm0',
    hearts: 3,
    xp: 50,
    date: '2026-11-06',
    nonce: 'nonce-1',
  }, 'course-salt');
  const [charge, fingerprint] = token.split('.');
  assert.equal((await verifyToken(token, 'wrong-salt')).valid, false);
  assert.equal((await verifyToken(`${charge}.${fingerprint.slice(0, -1)}0`, 'course-salt')).valid, false);
  assert.equal((await verifyToken('not-a-token', 'course-salt')).valid, false);
  assert.equal((await verifyToken(`${charge}=.${fingerprint}`, 'course-salt')).valid, false);
  await assert.rejects(createToken({
    alias: '',
    module: 'm0',
    hearts: 3,
    xp: 0,
    nonce: 'n',
    date: '2026-11-06',
  }, 'course-salt'), /alias/);
});
