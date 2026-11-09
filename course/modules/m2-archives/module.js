import { createActivitySession } from '../../assets/js/core/activity-session.js';
import { mountExercise } from '../../assets/js/core/exercise-ui.js';
import { checkExerciseResult } from '../../assets/js/core/quiz.js';
import { createSqlRunner } from '../../assets/js/runners/sql-runner.js';
import { loadProgress } from '../../assets/js/core/progress.js';

const moduleId = 'm2';
const progressStatus = document.querySelector('#module-progress');
const moduleStatus = document.querySelector('#module-status');
const schemaRoot = document.querySelector('#schema-root');
const startFightButton = document.querySelector('#start-fight');
const fightRoot = document.querySelector('#fight-root');
const startBossButton = document.querySelector('#start-boss');
const bossRoot = document.querySelector('#boss-root');
const bossTimer = document.querySelector('#boss-timer');

let activitySession;
let answerKey;
let quiz;
let lore;
let exercises;
let boss;
let sqlRunner;
let bossRunner;
let bossTimerHandle;
let bossStartedAt;
let bossActive = false;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function reportProgress(progress) {
  const module = progress?.modules?.[moduleId];
  const completed = Object.entries(module?.exercises ?? {})
    .filter(([id, item]) => id.startsWith('E2.') && item.correct).length;
  progressStatus.textContent = progress
    ? `Progression de ${progress.alias} · ${completed}/30 requêtes réussies · ${module?.fight?.won ? 'combat gagné' : 'combat à gagner pour valider'}${module?.dungeon?.date ? ` · épreuve ${module.dungeon.score}/${module.dungeon.max} le ${module.dungeon.date}` : ''}`
    : 'Aucune progression chargée. Les activités restent accessibles; crée une sauvegarde pour enregistrer tes réussites.';
}

function makeSession(progress) {
  activitySession = createActivitySession({
    moduleId,
    progress,
    onProgress: reportProgress,
  });
  reportProgress(activitySession.getProgress());
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossible de charger ${label} (HTTP ${response.status}).`);
  return response.json();
}

function renderSchema(schema) {
  const map = node('nav', undefined, 'schema-map');
  map.setAttribute('aria-label', 'Tables du modèle relationnel');
  const tableDetails = node('div', undefined, 'schema-tables');
  for (const table of schema.tables) {
    const tableId = `table-${table.name}`;
    const link = node('a', table.name);
    link.href = `#${tableId}`;
    map.append(link);
    const details = node('details', undefined, 'schema-table');
    details.id = tableId;
    const summary = node('summary', table.name);
    const columns = node('ul');
    for (const column of table.columns) columns.append(node('li', column));
    details.append(summary, columns);
    tableDetails.append(details);
  }
  const relationHeading = node('h3', 'Relations et cardinalités');
  const relations = node('ul', undefined, 'schema-relations');
  for (const [from, to, cardinality] of schema.relationships) {
    const item = node('li');
    const fromLink = node('a', from);
    fromLink.href = `#table-${from}`;
    const toLink = node('a', to);
    toLink.href = `#table-${to}`;
    item.append(fromLink, node('span', ` ${cardinality} `), toLink);
    relations.append(item);
  }
  schemaRoot.replaceChildren(map, relationHeading, relations, tableDetails);
}

function exerciseGroup(exercise) {
  if (exercise.id.startsWith('D2.')) return document.querySelector('#debug-exercises');
  if (exercise.difficulty === 1) return document.querySelector('#basic-exercises');
  if (exercise.difficulty === 2) return document.querySelector('#join-exercises');
  return document.querySelector('#window-exercises');
}

function renderExercise(exercise) {
  const isDebugging = exercise.id.startsWith('D2.');
  const card = node('details', undefined, 'm2-exercise-card');
  const summary = node('summary');
  summary.append(
    node('span', exercise.id),
    node('span', isDebugging ? ' · Entraînement bonus · ' : ` · ${exercise.xp} XP · `),
    document.createTextNode(exercise.title),
  );
  const body = node('div', undefined, 'm2-exercise-body');
  const hintBox = node('details', undefined, 'm2-hints');
  hintBox.append(node('summary', 'Ouvrir les indices'));
  exercise.hints.forEach((hint, index) => {
    const hintDetail = node('details');
    hintDetail.append(node('summary', `Indice ${index + 1}`), node('p', hint));
    hintBox.append(hintDetail);
  });
  const root = node('div', undefined, 'exercise-root');
  body.append(hintBox, root);
  card.append(summary, body);
  exerciseGroup(exercise).append(card);
  const options = {
    exercise,
    answerKey,
    runner: sqlRunner,
    onResult(result) {
      if (result.status === 'checked' && result.correct) {
        moduleStatus.textContent = isDebugging
          ? `${exercise.id} réussi. Cet entraînement bonus n’accorde pas d’XP.`
          : activitySession
            ? `${exercise.id} réussi : ${exercise.xp} XP enregistrés (une seule fois).`
            : `${exercise.id} réussi. Crée une sauvegarde pour enregistrer tes XP.`;
      }
    },
  };
  if (activitySession && !isDebugging) activitySession.mountExercise(root, options);
  else mountExercise(root, options);
}

async function startFight() {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil pour enregistrer le combat.';
    return;
  }
  startFightButton.disabled = true;
  try {
    const { mountFight } = await import('../../assets/js/core/fight-ui.js');
    mountFight(fightRoot, {
      questions: quiz.questions,
      answerKey,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      enemyName: lore.bosses.m2,
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

function renderBossForm() {
  const form = node('form', undefined, 'boss-form');
  boss.questions.forEach(question => {
    const section = node('section', undefined, 'boss-question');
    section.append(node('h3', `${question.id} · ${question.title}`), node('p', question.prompt));
    const label = node('label', 'Ta requête SQL');
    const input = node('textarea');
    input.id = `boss-${question.id}`;
    input.name = question.id;
    input.spellcheck = false;
    input.value = question.starter_query;
    label.htmlFor = input.id;
    const status = node('p', '', 'boss-question-status');
    status.setAttribute('role', 'status');
    section.append(label, input, status);
    form.append(section);
  });
  const controls = node('div', undefined, 'boss-controls');
  const finish = node('button', 'Terminer et corriger', 'button button--primary');
  finish.type = 'submit';
  const status = node('p', '', 'm2-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  controls.append(finish, status);
  form.append(controls);
  form.addEventListener('submit', event => {
    event.preventDefault();
    void finishBoss(form, status, finish, false);
  });
  bossRoot.replaceChildren(form);
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function finishBoss(form, status, finish, timeExpired) {
  if (!bossActive) return;
  bossActive = false;
  clearInterval(bossTimerHandle);
  finish.disabled = true;
  const elapsed = Math.min(boss.time_limit_seconds, Math.floor((performance.now() - bossStartedAt) / 1000));
  status.textContent = 'Exécution et vérification des six requêtes…';
  const outcomes = await Promise.all(boss.questions.map(async question => {
    const query = form.elements.namedItem(question.id).value.trim();
    if (!query) {
      form.querySelector(`#${CSS.escape(`boss-${question.id}`)}`).nextElementSibling.textContent = 'Requête vide : réponse non validée.';
      return false;
    }
    try {
      const result = await sqlRunnerForBoss().execute(query);
      const correct = await checkExerciseResult({ id: question.id, type: 'sql' }, result, answerKey);
      form.querySelector(`#${CSS.escape(`boss-${question.id}`)}`).nextElementSibling.textContent = correct
        ? 'Résultat exact.'
        : 'Résultat différent de la référence; vérifie ton grain, tes filtres et tes jointures.';
      return correct;
    } catch (error) {
      form.querySelector(`#${CSS.escape(`boss-${question.id}`)}`).nextElementSibling.textContent = `Requête non validée : ${error.message}`;
      return false;
    }
  }));
  const score = outcomes.filter(Boolean).length;
  const passed = score >= boss.pass_score;
  try {
    if (activitySession) {
      activitySession.recordDungeon({
        date: localDate(),
        score,
        max: boss.question_count,
        seconds: elapsed,
        passed,
        completed: true,
      });
    }
  } catch (error) {
    status.textContent = `Résultat ${score}/${boss.question_count}; l’épreuve a été vérifiée mais sa progression n’a pas pu être enregistrée : ${error.message}`;
    return;
  }
  status.textContent = `${timeExpired ? 'Temps écoulé. ' : ''}Résultat : ${score}/${boss.question_count}. ${passed ? 'Épreuve réussie.' : 'Il faut au moins 5 réponses exactes.'} Aucun XP n’est attribué.${activitySession ? '' : ' Crée une sauvegarde pour enregistrer cette tentative.'}`;
  bossRoot.append(node('p', `Durée : ${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, '0')} s.`, 'boss-result'));
  startBossButton.disabled = false;
  startBossButton.textContent = 'Recommencer l’épreuve';
}

function sqlRunnerForBoss() {
  if (!bossRunner) throw new Error('La base du boss n’est pas chargée.');
  return bossRunner;
}

async function startBoss() {
  if (bossActive) return;
  startBossButton.disabled = true;
  startBossButton.textContent = 'Chargement de la seconde base…';
  try {
    if (!bossRunner) {
      bossRunner = await createSqlRunner(
        new URL('../../data/hqo_boss.sqlite', import.meta.url),
        { timeoutMs: 20_000 },
      );
    }
    bossStartedAt = performance.now();
    bossActive = true;
    renderBossForm();
    if (activitySession) {
      activitySession.recordDungeon({
        date: localDate(),
        score: 0,
        max: boss.question_count,
        seconds: 0,
        passed: false,
        completed: false,
      });
    }
    startBossButton.textContent = 'Épreuve en cours';
    const deadline = bossStartedAt + boss.time_limit_seconds * 1000;
    function updateTimer() {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      bossTimer.textContent = `Temps restant : ${Math.floor(remaining / 60)} min ${String(remaining % 60).padStart(2, '0')} s`;
      if (remaining === 0) {
        const form = bossRoot.querySelector('form');
        const finish = form?.querySelector('button[type="submit"]');
        const status = form?.querySelector('[role="status"]');
        if (form && finish && status) void finishBoss(form, status, finish, true);
      }
    }
    updateTimer();
    bossTimerHandle = setInterval(updateTimer, 1000);
    bossRoot.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (error) {
    bossActive = false;
    clearInterval(bossTimerHandle);
    startBossButton.disabled = false;
    startBossButton.textContent = 'Commencer l’épreuve de 90 minutes';
    moduleStatus.textContent = `L’épreuve n’a pas pu démarrer : ${error.message}`;
  }
}

async function init() {
  try {
    const [loadedAnswers, loadedExercises, loadedQuiz, loadedSchema, loadedLore, loadedBoss] = await Promise.all([
      fetchJson(new URL('../../data/expected/answers_hashed.json', import.meta.url), 'les références de correction'),
      fetchJson(new URL('./exercises.json', import.meta.url), 'les exercices'),
      fetchJson(new URL('./quiz.json', import.meta.url), 'le combat'),
      fetchJson(new URL('./schema.json', import.meta.url), 'le schéma relationnel'),
      fetchJson(new URL('../../assets/data/lore.json', import.meta.url), 'les noms du parcours'),
      fetchJson(new URL('./boss.json', import.meta.url), 'les questions du boss'),
    ]);
    answerKey = loadedAnswers;
    exercises = loadedExercises;
    quiz = loadedQuiz;
    lore = loadedLore;
    boss = loadedBoss;
    if (quiz.module !== moduleId || quiz.questions.length !== 20
      || [1, 2, 3].some(level => quiz.questions.filter(question => question.difficulty === level).length !== [0, 8, 8, 4][level])) {
      throw new Error('La banque de combat doit contenir 8 questions de difficulté 1, 8 de difficulté 2 et 4 de difficulté 3.');
    }
    if (exercises.exercises.length !== 30 || exercises.debugging.length !== 5
      || loadedSchema.tables.length !== 14 || boss.questions.length !== 6) {
      throw new Error('Le contenu du module est incomplet (30 exercices, 5 débogages, 14 tables et 6 questions de boss sont requis).');
    }
    const requiredIds = [
      ...exercises.exercises.map(exercise => exercise.id),
      ...exercises.debugging.map(exercise => exercise.id),
      ...quiz.questions.map(question => question.id),
      ...boss.questions.map(question => question.id),
    ];
    for (const id of requiredIds) {
      if (!answerKey.items?.[id]) throw new Error(`La référence de correction manque pour ${id}.`);
    }
    if (!lore.bosses?.m2) throw new Error('Le nom du boss m2 manque dans les données du parcours.');
    renderSchema(loadedSchema);
    sqlRunner = await createSqlRunner(new URL('../../data/hqo_lite.sqlite', import.meta.url));
  } catch (error) {
    moduleStatus.textContent = `Le module n’a pas pu démarrer complètement : ${error.message}`;
    progressStatus.textContent = 'La progression M2 est momentanément indisponible.';
    return;
  }
  try {
    const progress = loadProgress();
    if (progress) makeSession(progress);
    else reportProgress(null);
  } catch (error) {
    reportProgress(null);
    progressStatus.textContent = `La progression locale n’a pas pu être chargée : ${error.message}`;
  }
  for (const exercise of [...exercises.exercises, ...exercises.debugging]) renderExercise(exercise);
  startFightButton.addEventListener('click', () => void startFight());
  startBossButton.addEventListener('click', () => void startBoss());
}

void init();

window.addEventListener('pagehide', () => {
  clearInterval(bossTimerHandle);
  sqlRunner?.dispose();
  bossRunner?.dispose();
});
