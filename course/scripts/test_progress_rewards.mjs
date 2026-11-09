import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, validateProgress } from '../assets/js/core/progress.js';
import {
  moduleHearts,
  playerLevel,
  recordDungeon,
  recordExercise,
  recordFight,
  recordQuiz,
} from '../assets/js/core/progress-rewards.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('awards exercise XP once and preserves attempts and first success', () => {
  let progress = createProgress('test');
  progress = recordExercise(progress, 'm0', 'E0.1', false);
  assert.equal(progress.xp_total, 0);
  progress = recordExercise(progress, 'm0', 'E0.1', true, undefined, 10);
  assert.equal(progress.xp_total, 10);
  progress = recordExercise(progress, 'm0', 'E0.1', true, undefined, 10);
  assert.equal(progress.xp_total, 10);
  assert.deepEqual(progress.modules.m0.exercises['E0.1'], { attempts: 3, correct: true });
  assert.equal(progress.modules.m0.exercise_score, 100);
});

test('awards one quiz and boss reward per module and persists when storage is supplied', () => {
  const storage = memoryStorage();
  let progress = createProgress('test');
  progress = recordQuiz(progress, 'm0', 60);
  assert.equal(progress.xp_total, 0);
  progress = recordQuiz(progress, 'm0', 80, storage);
  assert.equal(progress.xp_total, 50);
  progress = recordQuiz(progress, 'm0', 95);
  assert.equal(progress.xp_total, 50);

  const fight = { won: true, rounds: 8, accuracy: 0.875, pv_left: 40, flawless: false, seconds: 60 };
  progress = recordFight(progress, 'm0', fight, storage);
  assert.equal(progress.xp_total, 200);
  assert.ok(progress.badges.includes('m0-boss'));
  assert.deepEqual(moduleHearts(progress.modules.m0), { quiz: 1, exercises: 0, fight: 1 });
  progress = recordFight(progress, 'm0', fight);
  assert.equal(progress.xp_total, 200);
  assert.equal(JSON.parse(storage.getItem('hqo_progress_v1')).xp_total, 200);
});

test('maps module thresholds to hearts and XP to levels', () => {
  assert.deepEqual(moduleHearts({
    quiz_score: 80,
    exercise_score: 79,
    fight: { won: true },
  }), {
    quiz: 1,
    exercises: 0,
    fight: 1,
  });
  assert.equal(playerLevel(0), 1);
  assert.equal(playerLevel(100), 2);
  assert.equal(playerLevel(400), 3);
  assert.throws(() => playerLevel(-1), /non-negative/);
});

test('records an optional dungeon result without XP and counts it separately from the fight', () => {
  const progress = createProgress('test');
  const updated = recordDungeon(progress, 'm0', {
    date: '2026-11-07',
    score: 8,
    max: 10,
    seconds: 600,
    passed: true,
    completed: true,
  });
  assert.equal(updated.xp_total, 0);
  assert.deepEqual(moduleHearts(updated.modules.m0), { quiz: 0, exercises: 0, fight: 0 });
  const legacySave = {
    ...progress,
    modules: {
      m0: {
        dungeon: { date: '2026-11-06', score: 8, max: 10, seconds: 600, passed: true },
      },
    },
  };
  assert.equal(validateProgress(legacySave), legacySave);
  assert.throws(() => recordDungeon(progress, 'm0', {
    date: 'today', score: 8, max: 10, seconds: 600, passed: true, completed: true,
  }), /Invalid dungeon progress/);
});

test('rejects malformed scores and fight summaries', () => {
  const progress = createProgress('test');
  assert.throws(() => recordQuiz(progress, 'm0', 101), /between zero and one hundred/);
  assert.throws(() => recordFight(progress, 'm0', { won: true }), /invalid shape/);
  assert.throws(() => recordExercise(progress, 'm0', '', true), /exerciseId/);
  assert.throws(() => recordExercise(progress, 'm0', 'E0.1', true, undefined, -1), /non-negative/);
});
