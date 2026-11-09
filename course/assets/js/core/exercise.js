import { checkExerciseResult } from './quiz.js';

export async function submitExercise({
  exercise,
  runner,
  answerKey,
  code,
  query,
  answer,
  files = [],
  packages = [],
  params,
} = {}) {
  if (!exercise || typeof exercise.id !== 'string') throw new TypeError('An exercise id is required.');

  let execution;
  let result;
  switch (exercise.type) {
    case 'python':
      if (!runner || typeof runner.run !== 'function') throw new TypeError('A Python runner is required.');
      if (typeof exercise.answer_expression !== 'string' || !exercise.answer_expression.trim()) {
        throw new TypeError(`Python exercise ${exercise.id} needs an answer expression.`);
      }
      execution = await runner.run({
        code,
        tests: exercise.tests ?? '',
        files,
        packages,
        answerExpression: exercise.answer_expression,
      });
      if (!execution || execution.ok !== true) return { status: 'error', execution };
      result = execution.answer;
      if (result === undefined) throw new TypeError(`Python exercise ${exercise.id} returned no answer.`);
      break;
    case 'sql':
      if (!runner || typeof runner.execute !== 'function') throw new TypeError('A SQL runner is required.');
      execution = await runner.execute(query, { params });
      result = execution;
      break;
    case 'text':
    case 'num':
      result = answer;
      break;
    default:
      throw new TypeError(`Unsupported exercise type: ${exercise.type}`);
  }

  return {
    status: 'checked',
    correct: await checkExerciseResult(exercise, result, answerKey),
    execution,
  };
}
