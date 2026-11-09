import { saveProgress, setModuleProgress, validateProgress } from './progress.js';

export const XP_REWARDS = Object.freeze({
  exercise: 20,
  correctQuiz: 50,
  completedFight: 150,
});

export const MODULE_HEARTS = Object.freeze({
  quiz: 1,
  exercises: 1,
  fight: 1,
});

function assertRewardProgress(progress) {
  validateProgress(progress);
  return progress;
}

export function recordExercise(progress, moduleId, exerciseId, correct, storage, xp = XP_REWARDS.exercise) {
  assertRewardProgress(progress);
  if (typeof exerciseId !== 'string' || !exerciseId.trim()) throw new TypeError('exerciseId must be non-empty text');
  if (typeof correct !== 'boolean') throw new TypeError('correct must be a boolean');
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError('xp must be a non-negative safe integer');
  const module = progress.modules[moduleId] ?? {};
  const exercises = { ...(module.exercises ?? {}) };
  const prior = exercises[exerciseId] ?? {};
  const priorAttempts = prior.attempts ?? 0;
  const wasCorrect = prior.correct === true || prior.done === true;
  if (!Number.isSafeInteger(priorAttempts) || priorAttempts < 0) {
    throw new TypeError(`Invalid prior progress for exercise ${exerciseId}`);
  }
  exercises[exerciseId] = {
    ...prior,
    attempts: priorAttempts + 1,
    correct: wasCorrect || correct,
  };
  const newlyCorrect = correct && !wasCorrect;
  const updated = setModuleProgress(progress, moduleId, {
    ...module,
    exercises,
    exercise_score: Math.round(
      Object.values(exercises).filter(item => item.correct).length / Object.keys(exercises).length * 100,
    ),
  });
  const rewarded = {
    ...updated,
    xp_total: updated.xp_total + (newlyCorrect ? xp : 0),
  };
  return storage ? saveProgress(rewarded, storage) : validateProgress(rewarded);
}

export function recordQuiz(progress, moduleId, scorePercent, storage) {
  assertRewardProgress(progress);
  if (typeof scorePercent !== 'number' || !Number.isFinite(scorePercent) || scorePercent < 0 || scorePercent > 100) {
    throw new RangeError('scorePercent must be between zero and one hundred');
  }
  const module = progress.modules[moduleId] ?? {};
  const prior = module.quiz_score ?? 0;
  const quizScore = Math.max(prior, scorePercent);
  const updated = setModuleProgress(progress, moduleId, { ...module, quiz_score: quizScore });
  const rewarded = {
    ...updated,
    xp_total: updated.xp_total + (scorePercent >= 80 && prior < 80 ? XP_REWARDS.correctQuiz : 0),
  };
  return storage ? saveProgress(rewarded, storage) : validateProgress(rewarded);
}

export function recordFight(progress, moduleId, fight, storage) {
  assertRewardProgress(progress);
  if (!fight || typeof fight.won !== 'boolean' || !Number.isInteger(fight.rounds) || fight.rounds < 0
    || typeof fight.accuracy !== 'number' || !Number.isFinite(fight.accuracy)
    || fight.accuracy < 0 || fight.accuracy > 1 || !Number.isFinite(fight.pv_left)
    || typeof fight.flawless !== 'boolean' || !Number.isFinite(fight.seconds) || fight.seconds < 0) {
    throw new TypeError('fight summary has an invalid shape');
  }
  const module = progress.modules[moduleId] ?? {};
  const updated = setModuleProgress(progress, moduleId, {
    ...module,
    fight: { ...fight },
  });
  const rewarded = {
    ...updated,
    xp_total: updated.xp_total + (fight.won && !module.fight?.won
      ? XP_REWARDS.completedFight : 0),
    badges: fight.won && !module.fight?.won && !progress.badges.includes(`${moduleId}-boss`)
      ? [...progress.badges, `${moduleId}-boss`]
      : progress.badges,
  };
  return storage ? saveProgress(rewarded, storage) : validateProgress(rewarded);
}

export function recordDungeon(progress, moduleId, dungeon, storage) {
  assertRewardProgress(progress);
  if (!dungeon || typeof dungeon.date !== 'string'
    || !Number.isSafeInteger(dungeon.score) || dungeon.score < 0
    || !Number.isSafeInteger(dungeon.max) || dungeon.max < 1 || dungeon.score > dungeon.max
    || !Number.isFinite(dungeon.seconds) || dungeon.seconds < 0
    || typeof dungeon.passed !== 'boolean'
    || (dungeon.completed !== undefined && typeof dungeon.completed !== 'boolean')) {
    throw new TypeError('dungeon result has an invalid shape');
  }
  const module = progress.modules[moduleId] ?? {};
  const updated = setModuleProgress(progress, moduleId, {
    ...module,
    dungeon: { ...dungeon },
  });
  return storage ? saveProgress(updated, storage) : validateProgress(updated);
}

export function moduleHearts(module) {
  return {
    quiz: module?.fight?.won === true || (module?.quiz_score ?? 0) >= 80
      ? MODULE_HEARTS.quiz : 0,
    exercises: (module?.exercise_score ?? 0) >= 80 ? MODULE_HEARTS.exercises : 0,
    fight: module?.fight?.won === true || module?.boss === true ? MODULE_HEARTS.fight : 0,
  };
}

export function playerLevel(xp) {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError('xp must be a non-negative safe integer');
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}
