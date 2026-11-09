import { hashRows, hashText, matchNum } from './canon.js';

function expectedItem(id, answerKey, kind) {
  if (!answerKey || typeof answerKey.salt !== 'string' || !answerKey.salt
    || !answerKey.items || typeof answerKey.items !== 'object' || Array.isArray(answerKey.items)) {
    throw new TypeError('A valid answer key with salt and items is required.');
  }
  if (!Object.hasOwn(answerKey.items, id)) throw new TypeError(`Missing ${kind} answer key for ${id}`);
  const item = answerKey.items[id];
  if (!item || item.kind !== kind || typeof item.hash !== 'string' || !/^[a-f0-9]{64}$/.test(item.hash)) {
    throw new TypeError(`Missing or invalid ${kind} answer key for ${id}`);
  }
  return item;
}

const textAnswer = async (id, answer, salt, hash) => {
  if (typeof answer !== 'string') throw new TypeError('Answer must be text.');
  return await hashText(id, answer, salt) === hash;
};

export async function checkAnswer(question, answer, answerKey) {
  if (!question || typeof question.id !== 'string') throw new TypeError('A question id is required.');
  if (!['single', 'multi', 'numeric', 'code_output'].includes(question.type)) {
    throw new TypeError(`Unsupported question type: ${question.type}`);
  }
  const kind = question.type === 'numeric' ? 'num' : 'text';
  const expected = expectedItem(question.id, answerKey, kind);
  switch (question.type) {
    case 'single':
    case 'code_output':
      return textAnswer(question.id, answer, answerKey.salt, expected.hash);
    case 'multi': {
      if (!Array.isArray(answer) || answer.length === 0
        || answer.some(value => typeof value !== 'string' || !value.trim())) {
        throw new TypeError('Multi-select answers must contain non-empty text values.');
      }
      const selected = answer.map(value => value.trim());
      if (new Set(selected).size !== selected.length) throw new TypeError('Multi-select answers must be unique.');
      selected.sort();
      return textAnswer(question.id, JSON.stringify(selected), answerKey.salt, expected.hash);
    }
    case 'numeric': {
      const numericAnswer = typeof answer === 'number' ? answer : Number(answer);
      if ((typeof answer === 'string' && answer.trim() === '') || !Number.isFinite(numericAnswer)) {
        throw new TypeError('Numeric answers must be finite numbers.');
      }
      return matchNum(question.id, numericAnswer, expected.tol, answerKey.salt, expected.hash);
    }
    default:
      throw new TypeError(`Unsupported question type: ${question.type}`);
  }
}

export async function checkExerciseResult(exercise, result, answerKey) {
  if (!exercise || typeof exercise.id !== 'string') throw new TypeError('An exercise id is required.');
  switch (exercise.type) {
    case 'text': {
      const expected = expectedItem(exercise.id, answerKey, 'text');
      return textAnswer(exercise.id, result, answerKey.salt, expected.hash);
    }
    case 'python': {
      const resultKind = exercise.result_kind ?? 'text';
      const expected = expectedItem(exercise.id, answerKey, resultKind);
      if (resultKind === 'text') return textAnswer(exercise.id, result, answerKey.salt, expected.hash);
      if (resultKind === 'num') {
        const numericResult = typeof result === 'number' ? result : Number(result);
        if ((typeof result === 'string' && result.trim() === '') || !Number.isFinite(numericResult)) {
          throw new TypeError('Python results must be finite numbers.');
        }
        return matchNum(exercise.id, numericResult, expected.tol, answerKey.salt, expected.hash);
      }
      throw new TypeError(`Unsupported Python result kind: ${resultKind}`);
    }
    case 'num': {
      const expected = expectedItem(exercise.id, answerKey, 'num');
      const numericResult = typeof result === 'number' ? result : Number(result);
      if ((typeof result === 'string' && result.trim() === '') || !Number.isFinite(numericResult)) {
        throw new TypeError('Numeric results must be finite numbers.');
      }
      return matchNum(exercise.id, numericResult, expected.tol, answerKey.salt, expected.hash);
    }
    case 'sql': {
      const expected = expectedItem(exercise.id, answerKey, 'sql');
      if (!result || !Array.isArray(result.rows)) throw new TypeError('SQL result must include rows.');
      return await hashRows(
        exercise.id,
        result.rows,
        answerKey.salt,
        expected.order_matters === true,
      ) === expected.hash;
    }
    default:
      throw new TypeError(`Unsupported exercise type: ${exercise.type}`);
  }
}
