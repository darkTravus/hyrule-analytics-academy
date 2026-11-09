import { createActivitySession } from '../../assets/js/core/activity-session.js';
import { loadProgress } from '../../assets/js/core/progress.js';
import { checkAnswer } from '../../assets/js/core/quiz.js';

const moduleId = 'm1';
const moduleStatus = document.querySelector('#module-status');
const progressStatus = document.querySelector('#module-progress');
const exerciseList = document.querySelector('#exercise-list');
const rubricRoot = document.querySelector('#rubric-root');
const startFightButton = document.querySelector('#start-fight');
const startDungeonButton = document.querySelector('#start-dungeon');
const fightRoot = document.querySelector('#fight-root');
const dungeonRoot = document.querySelector('#dungeon-root');
const dungeonTimer = document.querySelector('#dungeon-timer');
const exportButton = document.querySelector('#export-results');

let activitySession;
let answerKey;
let exercises;
let questions;
let lore;
let dungeonTimerHandle;
let dungeonStartedAt;
let dungeonActive = false;
let results = {};

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function showProgress(progress) {
  const module = progress?.modules?.[moduleId];
  const correctExercises = Object.values(module?.exercises ?? {})
    .filter(exercise => exercise.correct).length;
  const totalExercises = 6;
  progressStatus.textContent = progress
    ? `Progression de ${progress.alias} · ${correctExercises}/${totalExercises} exercices réussis · ${module?.fight?.won ? 'combat gagné' : 'combat à gagner pour valider'}${module?.dungeon?.date ? ` · épreuve ${module.dungeon.score}/${module.dungeon.max} le ${module.dungeon.date}` : ''}`
    : 'Aucune progression chargée. Crée un alias depuis l’accueil pour enregistrer tes activités.';
}

function createSession(progress) {
  activitySession = createActivitySession({
    moduleId,
    progress,
    onProgress: showProgress,
  });
  showProgress(activitySession.getProgress());
}

function inputFor(field, prefix) {
  const wrapper = node('div', undefined, 'm1-field');
  const label = node('label', field.label);
  const input = node('input');
  input.id = `${prefix}-${field.key}`;
  input.name = field.key;
  input.type = field.type === 'numeric' ? 'number' : 'text';
  if (field.type === 'numeric') input.step = 'any';
  input.autocomplete = 'off';
  input.required = true;
  label.htmlFor = input.id;
  wrapper.append(label, input);
  return { wrapper, input };
}

function setResult(exerciseId, fieldKey, fieldType, rawValue) {
  const value = fieldType === 'numeric' ? Number(rawValue) : rawValue.trim();
  results[exerciseId] ??= {};
  results[exerciseId][fieldKey] = value;
}

function renderExercise(exercise) {
  const card = node('article', undefined, 'exercise-card');
  const heading = node('div', undefined, 'exercise-heading');
  heading.append(
    node('span', `${exercise.id} · ${exercise.xp} XP`),
    node('h3', exercise.title),
  );
  card.append(heading, node('p', exercise.prompt));
  const form = node('form', undefined, 'exercise-form m1-exercise-form');
  const fields = exercise.fields.map(field => {
    const control = inputFor(field, exercise.id);
    form.append(control.wrapper);
    return { ...control, field };
  });
  const submit = node('button', 'Vérifier mes réponses', 'button button--secondary');
  submit.type = 'submit';
  const status = node('p', '', 'exercise-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.append(submit, status);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Vérification en cours…';
    try {
      const outcomes = [];
      for (const { input, field } of fields) {
        const answer = field.type === 'numeric' ? input.value : input.value.trim();
        const correct = await checkAnswer({
          id: `${exercise.id}.${field.key}`,
          type: field.type,
        }, answer, answerKey);
        outcomes.push(correct);
        setResult(exercise.id, field.key, field.type, answer);
      }
      const correct = outcomes.every(Boolean);
      if (activitySession) activitySession.recordExercise(exercise.id, correct, exercise.xp);
      status.textContent = correct
        ? 'Toutes les réponses sont correctes.'
        : 'Certaines réponses restent à corriger. Reprends tes filtres et tes calculs.';
      if (!activitySession && correct) status.textContent += ' Crée une progression pour enregistrer tes XP.';
    } catch (error) {
      status.textContent = `Les réponses n’ont pas pu être vérifiées : ${error.message}`;
    } finally {
      submit.disabled = false;
    }
  });
  card.append(form);
  exerciseList.append(card);
}

function renderRubric(exercise) {
  const form = node('form', undefined, 'rubric-form');
  const status = node('p', '', 'exercise-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  exercise.requests.forEach((request, index) => {
    const fieldset = node('fieldset', undefined, 'rubric-item');
    fieldset.append(node('legend', `Demande ${index + 1} — « ${request} »`));
    const responseLabel = node('label', 'Ta question mesurable');
    const response = node('textarea');
    response.id = `E1.6-response-${index}`;
    response.name = `response-${index}`;
    response.required = true;
    response.rows = 3;
    responseLabel.htmlFor = response.id;
    fieldset.append(responseLabel, response);
    const checks = node('div', undefined, 'rubric-checks');
    exercise.criteria.forEach((criterion, criterionIndex) => {
      const label = node('label', criterion, 'rubric-check');
      const checkbox = node('input');
      checkbox.type = 'checkbox';
      checkbox.name = `criterion-${index}-${criterionIndex}`;
      label.prepend(checkbox);
      checks.append(label);
    });
    fieldset.append(checks);
    form.append(fieldset);
  });
  const submit = node('button', 'Valider mon auto-évaluation', 'button button--secondary');
  submit.type = 'submit';
  form.append(submit, status);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const complete = [...form.querySelectorAll('.rubric-item')].every(item =>
      item.querySelector('textarea').value.trim()
      && [...item.querySelectorAll('input[type="checkbox"]')].every(checkbox => checkbox.checked));
    if (!complete) {
      status.textContent = 'Pour chaque demande, écris une question et vérifie les quatre critères.';
      return;
    }
    try {
      if (activitySession) activitySession.recordExercise(exercise.id, true, exercise.xp);
      status.textContent = activitySession
        ? 'Auto-évaluation enregistrée. Tes formulations restent dans cette page et ne sont pas envoyées.'
        : 'Auto-évaluation terminée. Crée une progression pour enregistrer tes XP.';
    } catch (error) {
      status.textContent = `La progression n’a pas pu être enregistrée : ${error.message}`;
    }
  });
  rubricRoot.append(form);
}

function downloadResults() {
  const blob = new Blob([`${JSON.stringify(results, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = node('a');
  link.href = url;
  link.download = 'results.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function startFight() {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
    return;
  }
  startFightButton.disabled = true;
  try {
    const { mountFight } = await import('../../assets/js/core/fight-ui.js');
    mountFight(fightRoot, {
      questions,
      answerKey,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      enemyName: lore.bosses.m1,
      onComplete(result) {
        activitySession.recordFight(result);
        startFightButton.disabled = false;
        startFightButton.textContent = 'Recommencer le combat';
      },
    });
    fightRoot.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (error) {
    startFightButton.disabled = false;
    moduleStatus.textContent = `Le combat n’a pas pu démarrer : ${error.message}`;
  }
}

function renderDungeonForm() {
  const form = node('form', undefined, 'dungeon-question m1-dungeon-form');
  const groups = [
    {
      id: 'B1.1',
      title: 'CA RUPEES de mars 2026',
      fields: [{ key: 'revenue', label: 'Montant', type: 'numeric' }],
    },
    {
      id: 'B1.2',
      title: 'Objet en tête par CA RUPEES',
      fields: [
        { key: 'item', label: 'Nom de l’objet', type: 'code_output' },
        { key: 'revenue', label: 'Montant', type: 'numeric' },
      ],
    },
    {
      id: 'B1.3',
      title: 'Panier moyen EUR sur PC',
      fields: [{ key: 'average_basket', label: 'Montant', type: 'numeric' }],
    },
  ];
  const controls = [];
  groups.forEach((group, groupIndex) => {
    const section = node('section', undefined, 'dungeon-task');
    section.append(node('h3', `Question ${groupIndex + 1} — ${group.title}`));
    group.fields.forEach(field => {
      const control = inputFor(field, group.id);
      section.append(control.wrapper);
      controls.push({ ...control, group, field });
    });
    form.append(section);
  });
  const submit = node('button', 'Vérifier et terminer', 'button button--primary');
  submit.type = 'submit';
  const status = node('p', '', 'dungeon-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.append(submit, status);
  form.addEventListener('submit', event => {
    event.preventDefault();
    void finishDungeon(groups, controls, status, submit, false);
  });
  dungeonRoot.replaceChildren(form);
}

async function finishDungeon(groups, controls, status, submit, timeExpired) {
  if (!dungeonActive) return;
  const allFilled = controls.every(({ input }) => input.value.trim() !== '');
  if (!allFilled && !timeExpired) {
    status.textContent = 'Complète les trois questions avant de terminer.';
    return;
  }
  dungeonActive = false;
  clearInterval(dungeonTimerHandle);
  submit.disabled = true;
  try {
    const outcomes = new Map(groups.map(group => [group.id, []]));
    for (const { input, group, field } of controls) {
      const answer = input.value.trim();
      const correct = answer
        ? await checkAnswer({ id: `${group.id}.${field.key}`, type: field.type }, answer, answerKey)
        : false;
      outcomes.get(group.id).push(correct);
      if (answer) setResult(group.id, field.key, field.type, answer);
    }
    const score = [...outcomes.values()].filter(items => items.every(Boolean)).length;
    const elapsed = Math.min(45 * 60, Math.floor((performance.now() - dungeonStartedAt) / 1000));
    activitySession.recordDungeon({
      date: localDate(),
      score,
      max: groups.length,
      seconds: elapsed,
      passed: score === groups.length,
      completed: true,
    });
    dungeonTimer.textContent = '';
    status.textContent = `${timeExpired ? 'Temps écoulé. ' : ''}Résultat : ${score}/${groups.length}. ${score === groups.length ? 'Épreuve réussie.' : 'Reprends le nettoyage et les filtres avant de retenter.'} Aucun XP n’est attribué.`;
    const summary = node('p', `Durée : ${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, '0')} s.`);
    dungeonRoot.append(summary);
    startDungeonButton.disabled = false;
  } catch (error) {
    dungeonActive = true;
    submit.disabled = false;
    status.textContent = `L’épreuve n’a pas pu être vérifiée : ${error.message}`;
    if (timeExpired) startDungeonButton.disabled = false;
  }
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startDungeon() {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
    return;
  }
  if (dungeonActive) return;
  dungeonActive = true;
  dungeonStartedAt = performance.now();
  startDungeonButton.disabled = true;
  moduleStatus.textContent = '';
  try {
    activitySession.recordDungeon({
      date: localDate(),
      score: 0,
      max: 3,
      seconds: 0,
      passed: false,
      completed: false,
    });
  } catch (error) {
    dungeonActive = false;
    startDungeonButton.disabled = false;
    moduleStatus.textContent = `L’épreuve n’a pas pu démarrer : ${error.message}`;
    return;
  }
  renderDungeonForm();
  const deadline = dungeonStartedAt + 45 * 60 * 1000;
  function updateTimer() {
    const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    dungeonTimer.textContent = `Temps restant : ${Math.floor(remaining / 60)} min ${String(remaining % 60).padStart(2, '0')} s`;
    if (remaining === 0) void finishDungeon(
      [
        { id: 'B1.1' },
        { id: 'B1.2' },
        { id: 'B1.3' },
      ],
      [...dungeonRoot.querySelectorAll('.m1-field input')].map(input => ({
        input,
        group: { id: input.id.slice(0, 4) },
        field: { key: input.name, type: input.type === 'number' ? 'numeric' : 'code_output' },
      })),
      dungeonRoot.querySelector('.dungeon-status'),
      dungeonRoot.querySelector('button[type="submit"]'),
      true,
    );
  }
  updateTimer();
  dungeonTimerHandle = setInterval(updateTimer, 1000);
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossible de charger ${label} (HTTP ${response.status}).`);
  return response.json();
}

async function init() {
  try {
    const [loadedAnswerKey, loadedExercises, quiz, loadedLore] = await Promise.all([
      fetchJson(new URL('../../data/expected/answers_hashed.json', import.meta.url), 'les références de correction'),
      fetchJson(new URL('./exercises.json', import.meta.url), 'les exercices'),
      fetchJson(new URL('./quiz.json', import.meta.url), 'le combat'),
      fetchJson(new URL('../../assets/data/lore.json', import.meta.url), 'les noms du parcours'),
    ]);
    answerKey = loadedAnswerKey;
    exercises = loadedExercises;
    questions = quiz.questions;
    lore = loadedLore;
    const answerIds = [
      ...exercises.exercises.filter(exercise => exercise.fields)
        .flatMap(exercise => exercise.fields.map(field => `${exercise.id}.${field.key}`)),
      ...questions.map(question => question.id),
      'B1.1.revenue',
      'B1.2.item',
      'B1.2.revenue',
      'B1.3.average_basket',
    ];
    for (const id of answerIds) {
      if (!answerKey.items?.[id]) throw new Error(`La référence de correction manque pour ${id}.`);
    }
    if (questions.length !== 20
      || [1, 2, 3].some(level => questions.filter(question => question.difficulty === level).length !== [0, 8, 8, 4][level])) {
      throw new Error('La banque de combat doit contenir 8 questions de difficulté 1, 8 de difficulté 2 et 4 de difficulté 3.');
    }
    if (!lore.bosses?.m1) throw new Error('Le nom du boss m1 manque dans les données du parcours.');
  } catch (error) {
    moduleStatus.textContent = `Le module n’a pas pu démarrer complètement : ${error.message}`;
    return;
  }
  try {
    const progress = loadProgress();
    if (progress) createSession(progress);
    else showProgress(null);
  } catch (error) {
    showProgress(null);
    progressStatus.textContent = `La progression locale n’a pas pu être chargée : ${error.message}`;
  }
  for (const exercise of exercises.exercises) {
    if (exercise.type !== 'rubric') renderExercise(exercise);
  }
  renderRubric(exercises.exercises.find(exercise => exercise.type === 'rubric'));
  startFightButton.addEventListener('click', () => void startFight());
  startDungeonButton.addEventListener('click', startDungeon);
  exportButton.addEventListener('click', downloadResults);
}

void init();

window.addEventListener('pagehide', () => {
  clearInterval(dungeonTimerHandle);
});
