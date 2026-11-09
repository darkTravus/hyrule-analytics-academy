import { mountExercise as mountExerciseUi } from './exercise-ui.js';
import { mountFight as mountFightUi } from './fight-ui.js';
import {
  recordExercise as rewardExercise,
  recordFight as rewardFight,
  recordDungeon as rewardDungeon,
  recordQuiz as rewardQuiz,
} from './progress-rewards.js';
import { loadProgress, validateProgress } from './progress.js';

function assertStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new Error('Web Storage is unavailable; pass a storage implementation explicitly.');
  }
}

export function createActivitySession({
  moduleId,
  progress,
  storage = globalThis.localStorage,
  onProgress = () => {},
} = {}) {
  if (typeof moduleId !== 'string' || !/^m[0-9]$/.test(moduleId)) {
    throw new TypeError('A valid module id is required.');
  }
  assertStorage(storage);
  if (typeof onProgress !== 'function') throw new TypeError('onProgress must be a function.');

  let currentProgress = progress ?? loadProgress(storage);
  if (!currentProgress) throw new Error('Create or import a player save before starting an activity.');
  validateProgress(currentProgress);

  function updateProgress(updated) {
    currentProgress = updated;
    onProgress(currentProgress);
    return currentProgress;
  }

  function recordExercise(exerciseId, correct, xp) {
    return updateProgress(rewardExercise(currentProgress, moduleId, exerciseId, correct, storage, xp));
  }

  function recordQuiz(scorePercent) {
    return updateProgress(rewardQuiz(currentProgress, moduleId, scorePercent, storage));
  }

  function recordFight(result) {
    return updateProgress(rewardFight(currentProgress, moduleId, result, storage));
  }

  function recordDungeon(result) {
    return updateProgress(rewardDungeon(currentProgress, moduleId, result, storage));
  }

  return {
    getProgress: () => currentProgress,
    recordExercise,
    recordQuiz,
    recordFight,
    recordDungeon,
    mountExercise(root, options = {}) {
      if (!options.exercise || typeof options.exercise.id !== 'string') {
        throw new TypeError('An exercise definition is required.');
      }
      const { onResult = () => {}, ...exerciseOptions } = options;
      return mountExerciseUi(root, {
        ...exerciseOptions,
        onResult(result) {
          if (result.status === 'checked') recordExercise(options.exercise.id, result.correct, options.exercise.xp);
          onResult(result);
        },
      });
    },
    mountFight(root, options = {}) {
      const { onComplete = () => {}, ...fightOptions } = options;
      return mountFightUi(root, {
        ...fightOptions,
        onComplete(result) {
          recordFight(result);
          onComplete(result);
        },
      });
    },
  };
}
