import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivitySession } from '../assets/js/core/activity-session.js';
import { createProgress, STORAGE_KEY } from '../assets/js/core/progress.js';
import { moduleHearts } from '../assets/js/core/progress-rewards.js';

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
  };
}

test('activity session persists exercise, quiz, and fight rewards without duplicate XP', () => {
  const storage = memoryStorage();
  const changes = [];
  const session = createActivitySession({
    moduleId: 'm0',
    progress: createProgress('NovaData'),
    storage,
    onProgress: progress => changes.push(progress.xp_total),
  });

  session.recordExercise('E0.1', false);
  session.recordExercise('E0.1', true);
  session.recordExercise('E0.1', true);
  session.recordQuiz(79);
  session.recordQuiz(80);
  session.recordFight({
    won: true,
    rounds: 3,
    accuracy: 1,
    pv_left: 80,
    flawless: true,
    seconds: 10,
  });
  session.recordDungeon({
    date: '2026-11-07',
    score: 8,
    max: 10,
    seconds: 600,
    passed: true,
    completed: true,
  });

  const progress = session.getProgress();
  assert.equal(progress.xp_total, 220);
  assert.equal(progress.modules.m0.exercises['E0.1'].attempts, 3);
  assert.equal(progress.modules.m0.exercises['E0.1'].correct, true);
  assert.equal(progress.badges.includes('m0-boss'), true);
  assert.deepEqual(moduleHearts(progress.modules.m0), { quiz: 1, exercises: 1, fight: 1 });
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), progress);
  assert.equal(changes.length, 7);
});

test('activity session requires a saved player, module id, and valid storage', () => {
  assert.throws(() => createActivitySession({ moduleId: 'm10', storage: memoryStorage() }), /module id/i);
  assert.throws(() => createActivitySession({ moduleId: 'm0', storage: memoryStorage() }), /Create or import/i);
  assert.throws(() => createActivitySession({
    moduleId: 'm0',
    progress: createProgress('NovaData'),
    storage: {},
  }), /Web Storage/i);
});
