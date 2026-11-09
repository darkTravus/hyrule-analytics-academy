import { createFight, nextQuestion, resolve, summary } from './boss-fight.js';
import { checkAnswer } from './quiz.js';

let instanceCount = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function progressMeter(label, value, max) {
  const wrapper = element('div', undefined, 'fight-meter');
  const text = element('span', `${label} : ${value} / ${max}`);
  const meter = element('progress');
  meter.max = max;
  meter.value = value;
  meter.setAttribute('aria-label', label);
  wrapper.append(text, meter);
  return wrapper;
}

function fightArena() {
  const arena = element('section', undefined, 'fight-arena');
  arena.setAttribute('aria-label', 'Arène de combat');
  return arena;
}

function visualImpact(arena, event) {
  const impact = element('div', undefined, `fight-impact fight-impact--${event.type}`);
  impact.setAttribute('aria-hidden', 'true');
  const amount = element('span', `${event.type === 'hit' ? '−' : '+'}${event.dmg}`);
  amount.className = 'fight-impact__amount';
  impact.append(amount);
  for (let index = 0; index < 8; index++) {
    const spark = element('i');
    spark.className = 'fight-impact__spark';
    spark.style.setProperty('--spark-angle', `${index * 45}deg`);
    impact.append(spark);
  }
  arena.append(impact);
  arena.classList.remove('fight-arena--hit', 'fight-arena--hurt');
  void arena.offsetWidth;
  arena.classList.add(event.type === 'hit' ? 'fight-arena--hit' : 'fight-arena--hurt');
  impact.addEventListener('animationend', () => impact.remove(), { once: true });
  setTimeout(() => {
    impact.remove();
    arena.classList.remove('fight-arena--hit', 'fight-arena--hurt');
  }, 1000);
}

function makeAnswerControls(question, idPrefix) {
  const fieldset = element('fieldset', undefined, 'fight-answers');
  fieldset.append(element('legend', question.prompt));
  const selected = () => [...fieldset.querySelectorAll('input:checked')].map(input => input.value);
  if (question.type === 'single' || (question.type === 'code_output' && Array.isArray(question.options))) {
    for (const [index, option] of question.options.entries()) {
      const input = element('input');
      input.type = 'radio';
      input.name = `${idPrefix}-answer`;
      input.value = option.id;
      input.id = `${idPrefix}-${index}`;
      const label = element('label', option.text);
      label.htmlFor = input.id;
      fieldset.append(input, label);
    }
    return { fieldset, read: () => selected()[0] };
  }
  if (question.type === 'multi') {
    for (const [index, option] of question.options.entries()) {
      const input = element('input');
      input.type = 'checkbox';
      input.name = `${idPrefix}-answer`;
      input.value = option.id;
      input.id = `${idPrefix}-${index}`;
      const label = element('label', option.text);
      label.htmlFor = input.id;
      fieldset.append(input, label);
    }
    return { fieldset, read: selected };
  }
  const input = element(question.type === 'numeric' ? 'input' : 'textarea');
  input.id = `${idPrefix}-answer`;
  input.name = input.id;
  if (question.type === 'numeric') {
    input.type = 'number';
    input.step = 'any';
  }
  fieldset.append(input);
  return { fieldset, read: () => input.value };
}

export function mountFight(root, {
  questions,
  answerKey,
  seed,
  rules,
  enemyName = 'Boss',
  onComplete = () => {},
} = {}) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('A DOM root element is required.');
  if (!answerKey || typeof answerKey.salt !== 'string' || !answerKey.salt) {
    throw new TypeError('A valid answer key is required.');
  }
  if (!Array.isArray(questions)) throw new TypeError('Questions must be an array.');
  if (typeof onComplete !== 'function') throw new TypeError('onComplete must be a function.');
  for (const question of questions) {
    if (!question || typeof question.prompt !== 'string' || !question.prompt.trim()
      || typeof question.explanation !== 'string' || !question.explanation.trim()) {
      throw new TypeError('Every fight question needs a prompt and an explanation.');
    }
    if (!['single', 'multi', 'numeric', 'code_output'].includes(question.type)) {
      throw new TypeError(`Unsupported question type: ${question.type}`);
    }
    if (['single', 'multi'].includes(question.type)
      || (question.type === 'code_output' && Array.isArray(question.options))) {
      if (!Array.isArray(question.options) || question.options.length < 2
        || question.options.some(option => !option || typeof option.id !== 'string' || !option.id
          || typeof option.text !== 'string' || !option.text.trim())) {
        throw new TypeError(`Question ${question.id} needs at least two valid options.`);
      }
      if (new Set(question.options.map(option => option.id)).size !== question.options.length) {
        throw new TypeError(`Question ${question.id} has duplicate option ids.`);
      }
    }
  }
  const bank = new Map(questions.map(question => [question.id, question]));
  if (bank.size !== questions.length) throw new TypeError('Question ids must be unique.');
  let state = createFight(questions, { seed, rules });
  let current = null;
  let startedAt;
  let completed = false;
  const idPrefix = `fight-${++instanceCount}`;

  const live = element('p', undefined, 'fight-live');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  function finish() {
    if (completed) return;
    completed = true;
    const seconds = Math.max(0, Math.round((performance.now() - startedAt) / 1000));
    const result = summary(state, seconds);
    const heading = element('h3', state.status === 'won' ? 'Victoire !' : 'Combat terminé');
    const detail = element('p', `${result.rounds} questions, ${Math.round(result.accuracy * 100)} % de bonnes réponses, ${result.pv_left} PV restants.`);
    root.replaceChildren(heading, detail, live);
    live.textContent = state.status === 'won' ? 'Tu as remporté le combat.' : 'Le combat est terminé.';
    try {
      onComplete(result);
    } catch (error) {
      live.textContent = `Le résultat est calculé, mais la progression n'a pas pu être mise à jour : ${error.message}`;
    }
  }

  function renderQuestion() {
    current = nextQuestion(state);
    if (!current) return finish();
    const question = bank.get(current.id);
    const panel = element('section', undefined, 'fight-question');
    panel.append(element('h3', `Question ${state.round + 1} — difficulté ${current.difficulty}`));
    const controls = makeAnswerControls(question, `${idPrefix}-${state.round}`);
    panel.addEventListener('keydown', event => {
      if (!/^[1-4]$/.test(event.key) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const option = panel.querySelectorAll('input[type="radio"], input[type="checkbox"]')[Number(event.key) - 1];
      if (!option) return;
      option.checked = option.type === 'radio' ? true : !option.checked;
      option.focus();
      event.preventDefault();
    });
    const submit = element('button', 'Valider ma réponse');
    submit.type = 'button';
    submit.addEventListener('click', async () => {
      submit.disabled = true;
      try {
        const answer = controls.read();
        const correct = await checkAnswer(question, answer, answerKey);
        state = resolve(state, question.id, correct);
        const outcome = state.event.type === 'hit'
          ? `Bonne réponse : tu infliges ${state.event.dmg} dégâts${state.event.crit ? ', coup critique' : ''}.`
          : `Réponse incorrecte : tu perds ${state.event.dmg} PV.`;
        const feedback = element('p', `${outcome} ${question.explanation}`);
        feedback.className = `fight-feedback fight-feedback--${state.event.type}`;
        const next = element('button', state.status === 'ongoing' ? 'Continuer' : 'Voir le résultat');
        next.type = 'button';
        next.addEventListener('click', () => state.status === 'ongoing' ? renderQuestion() : finish(), { once: true });
        root.replaceChildren(fightArena());
        const arena = root.firstElementChild;
        arena.append(
          progressMeter('Tes PV', state.playerHp, state.r.playerHp),
          progressMeter(`PV de ${enemyName}`, state.bossHp, state.r.bossHp),
          feedback,
          next,
          live,
        );
        visualImpact(arena, state.event);
        live.textContent = outcome;
        next.focus();
      } catch (error) {
        submit.disabled = false;
        live.textContent = `Impossible de vérifier la réponse : ${error.message}`;
      }
    });
    panel.append(controls.fieldset, submit);
    root.replaceChildren(fightArena());
    const arena = root.firstElementChild;
    arena.append(
      progressMeter('Tes PV', state.playerHp, state.r.playerHp),
      progressMeter(`PV de ${enemyName}`, state.bossHp, state.r.bossHp),
      panel,
      live,
    );
    const firstInput = panel.querySelector('input, textarea');
    firstInput?.focus();
  }

  startedAt = performance.now();
  renderQuestion();
  return {
    destroy() {
      root.replaceChildren();
      completed = true;
    },
    getState() {
      return { ...state, pool: [...state.pool] };
    },
  };
}
