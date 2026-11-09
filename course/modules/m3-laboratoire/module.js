import { createActivitySession } from '../../assets/js/core/activity-session.js';
import { loadProgress, saveProgress, setModuleProgress } from '../../assets/js/core/progress.js';
import { checkAnswer } from '../../assets/js/core/quiz.js';
import { PythonRunner } from '../../assets/js/runners/py-runner.js';
import { mountAbCalculator } from '../../assets/js/widgets/ab-calc.js';
import { mountBayesCalculator } from '../../assets/js/widgets/bayes.js';
import { mountCltWidget } from '../../assets/js/widgets/clt.js';
import { mountPowerCalculator } from '../../assets/js/widgets/power.js';

const moduleId = 'm3';
const moduleStatus = document.querySelector('#module-status');
const progressStatus = document.querySelector('#module-progress');
const exerciseList = document.querySelector('#exercise-list');
const startFightButton = document.querySelector('#start-fight');
const fightRoot = document.querySelector('#fight-root');
const startBossButton = document.querySelector('#start-boss');
const bossTimer = document.querySelector('#boss-timer');
const bossRoot = document.querySelector('#boss-root');

let activitySession;
let answers;
let exercises;
let quiz;
let boss;
let lore;
let pythonRunner;
let bossTimerHandle;
let bossStartedAt;
let bossActive = false;
const fileCache = new Map();

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossible de charger ${label} (HTTP ${response.status}).`);
  return response.json();
}

function showProgress(progress) {
  const module = progress?.modules?.[moduleId];
  const exercisesDone = Object.values(module?.exercises ?? {})
    .filter(exercise => exercise.correct).length;
  progressStatus.textContent = progress
    ? `Progression de ${progress.alias} · ${exercisesDone}/${exercises.exercises.length} exercices réussis · ${module?.fight?.won ? 'combat gagné' : 'combat à gagner pour valider'}${module?.dungeon?.date ? ` · épreuve ${module.dungeon.score}/${module.dungeon.max} le ${module.dungeon.date}` : ''}`
    : 'Aucune progression chargée. Crée un alias depuis l’accueil pour enregistrer tes activités.';
  const attempt = module?.dungeon;
  const attemptedToday = attempt?.date === localDate();
  startBossButton.disabled = attemptedToday || bossActive;
  startBossButton.textContent = attemptedToday
    ? 'Tentative déjà enregistrée aujourd’hui'
    : bossActive ? 'Épreuve en cours' : 'Commencer l’épreuve de 2 heures';
}

function exerciseSlots(progress) {
  const module = progress.modules[moduleId] ?? {};
  const recorded = { ...(module.exercises ?? {}) };
  for (const exercise of exercises.exercises) {
    recorded[exercise.id] ??= { attempts: 0, correct: false };
  }
  const seeded = setModuleProgress(progress, moduleId, { ...module, exercises: recorded });
  return saveProgress(seeded);
}

function createSession(progress) {
  activitySession = createActivitySession({
    moduleId,
    progress: exerciseSlots(progress),
    onProgress: showProgress,
  });
  showProgress(activitySession.getProgress());
}

async function getPythonRunner() {
  if (!pythonRunner) pythonRunner = new PythonRunner({ timeoutMs: 120_000 });
  return pythonRunner;
}

async function loadExerciseFiles(names) {
  return Promise.all(names.map(async name => {
    if (!fileCache.has(name)) {
      const url = new URL(`../../data/csv/${name}`, import.meta.url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Impossible de charger ${name} (HTTP ${response.status}).`);
      fileCache.set(name, await response.text());
    }
    return { path: name, content: fileCache.get(name) };
  }));
}

function renderExercises() {
  exerciseList.replaceChildren();
  for (const exercise of exercises.exercises) {
    const card = node('article', undefined, 'm3-exercise-card');
    const heading = node('div', undefined, 'm3-exercise-heading');
    heading.append(node('span', `${exercise.id} · ${exercise.xp} XP`), node('h3', exercise.title));
    const prompt = node('p', exercise.prompt);
    const button = node('button', 'Charger Python et commencer', 'button button--secondary');
    button.type = 'button';
    const root = node('div', undefined, 'm3-exercise-root');
    root.id = `exercise-${exercise.id}`;
    button.addEventListener('click', async () => {
      if (!activitySession) {
        moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
        return;
      }
      button.disabled = true;
      button.textContent = 'Chargement des données et de Python…';
      moduleStatus.textContent = '';
      try {
        const [runner, files] = await Promise.all([
          getPythonRunner(),
          loadExerciseFiles(exercise.data),
        ]);
        activitySession.mountExercise(root, { exercise, answerKey: answers, runner, files });
        button.hidden = true;
        root.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Réessayer de charger Python';
        moduleStatus.textContent = `L’exercice ${exercise.id} n’a pas pu démarrer : ${error.message}`;
      }
    });
    card.append(heading, prompt, button, root);
    exerciseList.append(card);
  }
}

async function startFight() {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
    return;
  }
  startFightButton.disabled = true;
  try {
    const { mountFight } = await import('../../assets/js/core/fight-ui.js');
    activitySession.mountFight(fightRoot, {
      questions: quiz.questions,
      answerKey: answers,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      enemyName: lore.bosses.m3,
      onComplete() {
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

function wordCount(text) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function inputFor(field, index) {
  const wrapper = node('div', undefined, 'm3-boss-field');
  const label = node('label', field.label);
  const input = node('input');
  input.id = `boss-${field.key}`;
  input.name = field.key;
  input.type = 'number';
  input.step = 'any';
  input.required = true;
  input.autocomplete = 'off';
  label.htmlFor = input.id;
  wrapper.append(label, input);
  return { wrapper, input, question: { id: `B3.1.${field.key}`, type: 'numeric' }, index };
}

function renderBossForm() {
  const form = node('form', undefined, 'm3-boss-form');
  const fields = boss.fields.map(inputFor);
  const answerGrid = node('div', undefined, 'm3-boss-fields');
  fields.forEach(({ wrapper }) => answerGrid.append(wrapper));
  const memoLabel = node('label', 'Mémo de recommandation — au moins 150 mots');
  const memo = node('textarea');
  memo.id = 'boss-memo';
  memo.name = 'memo';
  memo.rows = 10;
  memo.required = true;
  memoLabel.htmlFor = memo.id;
  const rubricTitle = node('h3', 'Auto-évaluation du mémo');
  const rubric = node('fieldset', undefined, 'm3-boss-rubric');
  rubric.append(node('legend', 'Coche les critères que ton mémo satisfait.'));
  const checks = boss.rubric.map((criterion, index) => {
    const label = node('label');
    const checkbox = node('input');
    checkbox.type = 'checkbox';
    checkbox.name = `rubric-${index}`;
    label.append(checkbox, node('span', criterion));
    rubric.append(label);
    return checkbox;
  });
  const submit = node('button', 'Soumettre l’épreuve', 'button button--primary');
  submit.type = 'submit';
  const status = node('p', '', 'm3-boss-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.append(
    node('p', 'Saisis les quatre estimations calculées depuis exp_boss.csv. Les proportions doivent être exprimées entre 0 et 1.'),
    answerGrid,
    memoLabel,
    memo,
    rubricTitle,
    rubric,
    submit,
    status,
  );
  form.addEventListener('submit', event => {
    event.preventDefault();
    void finishBoss(fields, checks, memo, status, submit, false);
  });
  bossRoot.replaceChildren(form);
}

async function finishBoss(fields, checks, memo, status, submit, timeExpired) {
  if (!bossActive || submit.disabled) return;
  submit.disabled = true;
  let correctCount = 0;
  try {
    const outcomes = await Promise.all(fields.map(async ({ input, question }) => (
      input.value.trim() ? checkAnswer(question, input.value, answers) : false
    )));
    correctCount = outcomes.filter(Boolean).length;
    const memoWords = wordCount(memo.value);
    const rubricScore = checks.filter(check => check.checked).length;
    const score = correctCount + rubricScore;
    const passed = correctCount === boss.required_correct_calculations
      && memoWords >= boss.minimum_memo_words
      && rubricScore >= boss.minimum_self_assessment;
    const elapsed = Math.max(0, Math.floor((performance.now() - bossStartedAt) / 1000));
    activitySession.recordDungeon({
      date: localDate(),
      score,
      max: boss.max_score,
      seconds: elapsed,
      passed,
      completed: true,
    });
    clearInterval(bossTimerHandle);
    bossActive = false;
    bossTimer.textContent = timeExpired ? 'Temps écoulé.' : 'Épreuve terminée.';
    status.textContent = `${timeExpired ? 'Temps écoulé. ' : ''}${correctCount}/4 calculs corrects · mémo : ${memoWords}/${boss.minimum_memo_words} mots minimum · grille : ${rubricScore}/3 · score ${score}/${boss.max_score}. ${passed ? 'Épreuve réussie.' : 'La condition de réussite exige 4 calculs exacts, un mémo de 150 mots et au moins 2 critères cochés.'} Aucun XP n’est attribué.`;
    const result = node('p', `Durée : ${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, '0')} s.`, 'boss-result');
    bossRoot.append(result);
    showProgress(activitySession.getProgress());
    startBossButton.disabled = true;
    startBossButton.textContent = 'Tentative déjà enregistrée aujourd’hui';
  } catch (error) {
    status.textContent = `L’épreuve n’a pas pu être vérifiée ou enregistrée : ${error.message}`;
    submit.disabled = false;
  }
}

async function startBoss() {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
    return;
  }
  if (activitySession.getProgress().modules[moduleId]?.dungeon?.date === localDate()) {
    showProgress(activitySession.getProgress());
    return;
  }
  startBossButton.disabled = true;
  try {
    bossStartedAt = performance.now();
    bossActive = true;
    activitySession.recordDungeon({
      date: localDate(),
      score: 0,
      max: boss.max_score,
      seconds: 0,
      passed: false,
      completed: false,
    });
    renderBossForm();
    const deadline = bossStartedAt + boss.time_limit_seconds * 1000;
    function updateTimer() {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      bossTimer.textContent = `Temps restant : ${Math.floor(remaining / 60)} min ${String(remaining % 60).padStart(2, '0')} s`;
      if (remaining === 0) {
        const form = bossRoot.querySelector('form');
        const submit = form?.querySelector('button[type="submit"]');
        const status = form?.querySelector('[role="status"]');
        const memo = form?.querySelector('textarea');
        const fields = boss.fields.map((field, index) => ({
          ...inputFor(field, index),
          input: form?.querySelector(`#${CSS.escape(`boss-${field.key}`)}`),
        }));
        const checks = [...form.querySelectorAll('input[type="checkbox"]')];
        if (form && submit && status && memo && fields.every(field => field.input)) {
          void finishBoss(fields, checks, memo, status, submit, true);
        }
      }
    }
    showProgress(activitySession.getProgress());
    updateTimer();
    bossTimerHandle = setInterval(updateTimer, 1000);
    bossRoot.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (error) {
    bossActive = false;
    clearInterval(bossTimerHandle);
    startBossButton.disabled = false;
    moduleStatus.textContent = `L’épreuve n’a pas pu démarrer : ${error.message}`;
  }
}

async function init() {
  try {
    const [answerData, exerciseData, quizData, bossData, loreData] = await Promise.all([
      fetchJson(new URL('../../data/expected/answers_hashed.json', import.meta.url), 'les références de correction'),
      fetchJson(new URL('./exercises.json', import.meta.url), 'les exercices'),
      fetchJson(new URL('./quiz.json', import.meta.url), 'le combat'),
      fetchJson(new URL('./boss.json', import.meta.url), 'l’épreuve B3'),
      fetchJson(new URL('../../assets/data/lore.json', import.meta.url), 'les noms du parcours'),
    ]);
    answers = answerData;
    exercises = exerciseData;
    quiz = quizData;
    boss = bossData;
    lore = loreData;
    if (exercises.module !== moduleId || exercises.exercises.length !== 8
      || exercises.exercises.some(exercise => exercise.type !== 'python')
      || quiz.module !== moduleId || quiz.questions.length !== 20
      || [1, 2, 3].some(level => quiz.questions.filter(question => question.difficulty === level).length !== [0, 8, 8, 4][level])
      || boss.id !== 'B3' || boss.fields.length !== 4 || boss.rubric.length !== 3
      || !lore.bosses?.m3) {
      throw new Error('Le contenu du module est incomplet ou invalide.');
    }
    const requiredIds = [
      ...exercises.exercises.map(exercise => exercise.id),
      ...quiz.questions.map(question => question.id),
      ...boss.fields.map(field => `B3.1.${field.key}`),
    ];
    for (const id of requiredIds) {
      if (!answers.items?.[id]) throw new Error(`La référence de correction manque pour ${id}.`);
    }
    mountAbCalculator(document.querySelector('#ab-widget'));
    mountBayesCalculator(document.querySelector('#bayes-widget'));
    mountCltWidget(document.querySelector('#clt-widget'));
    mountPowerCalculator(document.querySelector('#power-widget'));
    renderExercises();
    const progress = loadProgress();
    if (progress) createSession(progress);
    else showProgress(null);
    startFightButton.addEventListener('click', () => void startFight());
    startBossButton.addEventListener('click', () => void startBoss());
  } catch (error) {
    moduleStatus.textContent = `Le module n’a pas pu démarrer complètement : ${error.message}`;
    progressStatus.textContent = 'La progression M3 est momentanément indisponible.';
  }
}

void init();

window.addEventListener('pagehide', () => {
  clearInterval(bossTimerHandle);
  pythonRunner?.dispose();
});
