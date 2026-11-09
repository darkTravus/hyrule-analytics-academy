import { checkAnswer } from '../../assets/js/core/quiz.js';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function shuffled(values, seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function answerControls(question, prefix) {
  const fieldset = node('fieldset', undefined, 'dungeon-answers');
  fieldset.append(node('legend', question.prompt));
  if (question.type === 'single' || (question.type === 'code_output' && question.options)) {
    for (const [index, option] of question.options.entries()) {
      const input = node('input');
      input.type = 'radio';
      input.name = `${prefix}-answer`;
      input.id = `${prefix}-${index}`;
      input.value = option.id;
      const label = node('label', option.text);
      label.htmlFor = input.id;
      fieldset.append(input, label);
    }
    return { fieldset, read: () => fieldset.querySelector('input:checked')?.value };
  }
  if (question.type === 'multi') {
    for (const [index, option] of question.options.entries()) {
      const input = node('input');
      input.type = 'checkbox';
      input.name = `${prefix}-answer`;
      input.id = `${prefix}-${index}`;
      input.value = option.id;
      const label = node('label', option.text);
      label.htmlFor = input.id;
      fieldset.append(input, label);
    }
    return { fieldset, read: () => [...fieldset.querySelectorAll('input:checked')].map(input => input.value) };
  }
  const input = node(question.type === 'numeric' ? 'input' : 'textarea');
  input.id = `${prefix}-answer`;
  input.name = input.id;
  if (question.type === 'numeric') {
    input.type = 'number';
    input.step = 'any';
  }
  fieldset.append(input);
  return { fieldset, read: () => input.value };
}

export function mountDungeon(root, {
  questions,
  answerKey,
  activitySession,
  questionCount = 10,
  timeLimitSeconds = 900,
  passPercent = 80,
  seed = Date.now(),
} = {}) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('A DOM root element is required.');
  if (!Array.isArray(questions) || questions.length < questionCount) throw new TypeError('The dungeon needs enough questions.');
  if (!activitySession || typeof activitySession.recordDungeon !== 'function') {
    throw new TypeError('A module activity session is required.');
  }
  if (!Number.isInteger(questionCount) || questionCount < 1
    || !Number.isFinite(timeLimitSeconds) || timeLimitSeconds <= 0
    || !Number.isFinite(passPercent) || passPercent < 0 || passPercent > 100) {
    throw new TypeError('The dungeon rules are invalid.');
  }
  const selectedQuestions = shuffled(questions, seed).slice(0, questionCount);
  const status = node('p', undefined, 'dungeon-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  let index = 0;
  let correctCount = 0;
  let startedAt;
  let remaining = timeLimitSeconds;
  let timer;
  let completed = false;

  function finish() {
    if (completed) return;
    completed = true;
    clearInterval(timer);
    const elapsed = Math.min(timeLimitSeconds, Math.floor((performance.now() - startedAt) / 1000));
    const passed = correctCount / questionCount * 100 >= passPercent;
    activitySession.recordDungeon({
      date: localDate(),
      score: correctCount,
      max: questionCount,
      seconds: elapsed,
      passed,
      completed: true,
    });
    const result = node('section', undefined, 'dungeon-result');
    result.setAttribute('aria-labelledby', 'dungeon-result-title');
    result.append(
      node('h3', passed ? 'Épreuve réussie' : 'Épreuve terminée'),
      node('p', `Résultat : ${correctCount}/${questionCount}. ${passed ? 'Tu as franchi cette épreuve.' : 'Tu pourras la retenter un autre jour.'}`),
      node('p', `Durée : ${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, '0')} s. Aucun XP n’est attribué.`),
      status,
    );
    result.querySelector('h3').id = 'dungeon-result-title';
    root.replaceChildren(result);
    status.textContent = 'Résultat enregistré sur cet appareil.';
  }

  function render() {
    if (index >= questionCount) {
      finish();
      return;
    }
    const question = selectedQuestions[index];
    const section = node('section', undefined, 'dungeon-question');
    section.append(node('p', `Question ${index + 1} sur ${questionCount} · Temps restant : ${Math.floor(remaining / 60)} min ${String(remaining % 60).padStart(2, '0')} s`));
    const controls = answerControls(question, `dungeon-${index}`);
    const submit = node('button', index === questionCount - 1 ? 'Terminer l’épreuve' : 'Valider et continuer');
    submit.type = 'button';
    submit.addEventListener('click', async () => {
      if (completed) return;
      const answer = controls.read();
      if (answer === undefined || answer === '') {
        status.textContent = 'Choisis ou saisis une réponse avant de continuer.';
        return;
      }
      submit.disabled = true;
      try {
        const correct = await checkAnswer(question, answer, answerKey);
        if (completed) return;
        if (correct) correctCount++;
        index++;
        render();
      } catch (error) {
        submit.disabled = false;
        status.textContent = `La réponse n’a pas pu être vérifiée : ${error.message}`;
      }
    });
    section.append(controls.fieldset, submit, status);
    root.replaceChildren(section);
    section.querySelector('input, textarea')?.focus();
  }

  startedAt = performance.now();
  activitySession.recordDungeon({
    date: localDate(),
    score: 0,
    max: questionCount,
    seconds: 0,
    passed: false,
    completed: false,
  });
  render();
  timer = setInterval(() => {
    remaining = Math.max(0, timeLimitSeconds - Math.floor((performance.now() - startedAt) / 1000));
    if (remaining === 0) finish();
    else {
      const countdown = root.querySelector('.dungeon-question > p');
      if (countdown) countdown.textContent = `Question ${Math.min(index + 1, questionCount)} sur ${questionCount} · Temps restant : ${Math.floor(remaining / 60)} min ${String(remaining % 60).padStart(2, '0')} s`;
    }
  }, 1000);
  return { destroy: () => clearInterval(timer) };
}
