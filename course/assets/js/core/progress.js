export const STORAGE_KEY = 'hqo_progress_v1';
export const PROGRESS_VERSION = 1;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validModuleId = value => /^m[0-9]$/.test(value);
const validDate = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function assertProgress(progress) {
  if (!isRecord(progress)) throw new TypeError('Progress must be a JSON object');
  if (progress.version !== PROGRESS_VERSION) throw new TypeError(`Unsupported progress version: ${progress.version}`);
  if (typeof progress.alias !== 'string' || progress.alias.trim() === '') {
    throw new TypeError('Progress alias must be a non-empty string');
  }
  if (!Number.isSafeInteger(progress.xp_total) || progress.xp_total < 0) {
    throw new TypeError('Progress xp_total must be a non-negative safe integer');
  }
  if (!Array.isArray(progress.badges) || progress.badges.some(badge => typeof badge !== 'string')) {
    throw new TypeError('Progress badges must be an array of strings');
  }
  if (!isRecord(progress.modules)) throw new TypeError('Progress modules must be an object');
  for (const [moduleId, module] of Object.entries(progress.modules)) {
    if (!validModuleId(moduleId)) throw new TypeError(`Invalid module id: ${moduleId}`);
    if (!isRecord(module)) throw new TypeError(`Progress for ${moduleId} must be an object`);
    if (module.quiz_score !== undefined
      && (!Number.isFinite(module.quiz_score) || module.quiz_score < 0 || module.quiz_score > 100)) {
      throw new TypeError(`Invalid quiz score for ${moduleId}`);
    }
    if (module.exercise_score !== undefined
      && (!Number.isFinite(module.exercise_score) || module.exercise_score < 0 || module.exercise_score > 100)) {
      throw new TypeError(`Invalid exercise score for ${moduleId}`);
    }
    if (module.boss !== undefined && typeof module.boss !== 'boolean') {
      throw new TypeError(`Invalid fight completion for ${moduleId}`);
    }
    if (module.dungeon !== undefined) {
      const dungeon = module.dungeon;
      if (!isRecord(dungeon)
        || !validDate(dungeon.date)
        || !Number.isSafeInteger(dungeon.score)
        || dungeon.score < 0
        || !Number.isSafeInteger(dungeon.max)
        || dungeon.max < 1
        || dungeon.score > dungeon.max
        || !Number.isFinite(dungeon.seconds)
        || dungeon.seconds < 0
        || typeof dungeon.passed !== 'boolean'
        || (dungeon.completed !== undefined && typeof dungeon.completed !== 'boolean')) {
        throw new TypeError(`Invalid dungeon progress for ${moduleId}`);
      }
    }
    if (module.exercises !== undefined) {
      if (!isRecord(module.exercises)) throw new TypeError(`Invalid exercises progress for ${moduleId}`);
      for (const [exerciseId, exercise] of Object.entries(module.exercises)) {
        if (!exerciseId || !isRecord(exercise)
          || (exercise.attempts !== undefined
            && (!Number.isSafeInteger(exercise.attempts) || exercise.attempts < 0))
          || (exercise.correct !== undefined && typeof exercise.correct !== 'boolean')) {
          throw new TypeError(`Invalid progress for exercise ${exerciseId}`);
        }
      }
    }
  }
  if (!Array.isArray(progress.error_journal)) throw new TypeError('Progress error_journal must be an array');
  for (const [index, entry] of progress.error_journal.entries()) {
    if (!isRecord(entry)
      || !validDate(entry.date)
      || !validModuleId(entry.module)
      || typeof entry.cause !== 'string'
      || typeof entry.fix !== 'string') {
      throw new TypeError(`Invalid error journal entry at index ${index}`);
    }
  }
  return progress;
}

function storageOrDefault(storage) {
  const resolved = storage ?? globalThis.localStorage;
  if (!resolved
    || typeof resolved.getItem !== 'function'
    || typeof resolved.setItem !== 'function') {
    throw new Error('Web Storage is unavailable; pass a storage implementation explicitly');
  }
  return resolved;
}

export function createProgress(alias) {
  if (typeof alias !== 'string' || alias.trim() === '') {
    throw new TypeError('Alias must be a non-empty string');
  }
  return {
    version: PROGRESS_VERSION,
    alias: alias.trim(),
    xp_total: 0,
    badges: [],
    modules: {},
    error_journal: [],
  };
}

export function validateProgress(progress) {
  return assertProgress(progress);
}

export function exportProgress(progress) {
  assertProgress(progress);
  return JSON.stringify(progress, null, 2);
}

export function loadProgress(storage) {
  const store = storageOrDefault(storage);
  const serialized = store.getItem(STORAGE_KEY);
  if (serialized === null) return null;
  let progress;
  try {
    progress = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Saved progress is not valid JSON: ${error.message}`, { cause: error });
  }
  return assertProgress(progress);
}

export function saveProgress(progress, storage) {
  assertProgress(progress);
  const store = storageOrDefault(storage);
  store.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
}

export function importProgress(serialized, storage) {
  if (typeof serialized !== 'string') throw new TypeError('Imported progress must be JSON text');
  let progress;
  try {
    progress = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Imported progress is not valid JSON: ${error.message}`, { cause: error });
  }
  assertProgress(progress);
  saveProgress(progress, storage);
  return progress;
}

export function setModuleProgress(progress, moduleId, moduleProgress) {
  assertProgress(progress);
  if (!validModuleId(moduleId)) throw new TypeError(`Invalid module id: ${moduleId}`);
  if (!isRecord(moduleProgress)) throw new TypeError('Module progress must be a JSON object');
  return assertProgress({
    ...progress,
    modules: { ...progress.modules, [moduleId]: moduleProgress },
  });
}
