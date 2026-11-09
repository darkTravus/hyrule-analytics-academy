import { createActivitySession } from '../../assets/js/core/activity-session.js';
import { createCourseRuntime } from '../../assets/js/core/course-runtime.js';
import { loadProgress, saveProgress, setModuleProgress } from '../../assets/js/core/progress.js';

const moduleStatus = document.querySelector('#module-status');
const progressStatus = document.querySelector('#module-progress');
const deliverableStatus = document.querySelector('#deliverable-status');
const deliverableForm = document.querySelector('#deliverable-form');
const startFightButton = document.querySelector('#start-fight');
const startDungeonButton = document.querySelector('#start-dungeon');
const fightRoot = document.querySelector('#fight-root');
const dungeonRoot = document.querySelector('#dungeon-root');
const moduleBase = new URL('./', import.meta.url);
const answerKeyUrl = new URL('../../data/expected/answers_hashed.json', import.meta.url);
const snapshotUrl = new URL('../../data/compendium/compendium_snapshot.json', import.meta.url);

let activitySession;
let courseRuntime;
let runtimePromise;
let pythonRunner;
let answerKey;
let content;
let quiz;
let dungeonConfig;
let lore;
let snapshotText;
let dungeonAttempt;

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function showProgress(progress) {
  const module = progress?.modules?.m0;
  const correctExercises = Object.values(module?.exercises ?? {})
    .filter(exercise => exercise.correct).length;
  const totalExercises = 4;
  progressStatus.textContent = progress
    ? `Progression de ${progress.alias} · ${correctExercises}/${totalExercises} exercices réussis · ${module?.fight?.won ? 'combat gagné' : 'combat à gagner pour valider'}${module?.dungeon?.date ? ` · ${module.dungeon.completed === false ? 'épreuve interrompue' : `épreuve ${module.dungeon.score}/${module.dungeon.max}`} le ${module.dungeon.date}` : ''}`
    : 'Aucune progression chargée. Crée un alias depuis l’accueil pour enregistrer tes activités.';
  if (startDungeonButton) {
    const alreadyAttempted = module?.dungeon?.date === localDate();
    startDungeonButton.disabled = alreadyAttempted;
    startDungeonButton.textContent = alreadyAttempted
      ? 'Tentative déjà enregistrée aujourd’hui'
      : 'Commencer l’épreuve du donjon';
  }
}

function createSession(progress) {
  activitySession = createActivitySession({
    moduleId: 'm0',
    progress,
    onProgress: showProgress,
  });
  showProgress(activitySession.getProgress());
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossible de charger ${label} (HTTP ${response.status}).`);
  return response.json();
}

async function getPythonRunner() {
  if (!runtimePromise) {
    runtimePromise = createCourseRuntime().then(runtime => {
      courseRuntime = runtime;
      return runtime;
    }, error => {
      runtimePromise = undefined;
      throw error;
    });
  }
  const runtime = await runtimePromise;
  if (!pythonRunner) pythonRunner = runtime.createPythonRunner();
  return pythonRunner;
}

async function startExercise(exercise) {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
    return;
  }
  const root = document.querySelector(`#exercise-${CSS.escape(exercise.id)}`);
  const startButton = document.querySelector(`[data-start-exercise="${CSS.escape(exercise.id)}"]`);
  startButton.disabled = true;
  startButton.textContent = 'Préparation de Python…';
  try {
    const runner = await getPythonRunner();
    const files = [];
    if (exercise.id !== 'E0.1') {
      if (snapshotText === undefined) {
        const response = await fetch(snapshotUrl);
        if (!response.ok) throw new Error(`Impossible de charger le snapshot (HTTP ${response.status}).`);
        snapshotText = JSON.stringify(await response.json());
      }
      files.push({ path: 'compendium_snapshot.json', content: snapshotText });
    }
    activitySession.mountExercise(root, {
      exercise,
      answerKey,
      runner,
      files,
    });
    startButton.hidden = true;
    root.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (error) {
    startButton.disabled = false;
    startButton.textContent = 'Réessayer de charger Python';
    moduleStatus.textContent = `L’exercice n’a pas pu démarrer : ${error.message}`;
  }
}

function addExerciseButtons() {
  for (const exercise of content.exercises) {
    const root = document.querySelector(`#exercise-${CSS.escape(exercise.id)}`);
    const button = document.createElement('button');
    button.className = 'button button--secondary';
    button.type = 'button';
    button.dataset.startExercise = exercise.id;
    button.textContent = 'Charger Python et commencer';
    button.addEventListener('click', () => void startExercise(exercise));
    root.before(button);
  }
}

function setupDeliverable() {
  deliverableForm.addEventListener('submit', event => {
    event.preventDefault();
    const urlInput = document.querySelector('#deliverable-url');
    const url = urlInput.value.trim();
    const match = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/data-portfolio\/?$/.exec(url);
    if (!match) {
      deliverableStatus.textContent = 'Entre l’URL complète du dépôt data-portfolio, au format https://github.com/ton-compte/data-portfolio.';
      return;
    }
    if (!document.querySelector('#readme-confirmation').checked) {
      deliverableStatus.textContent = 'Confirme que le README contient dix lignes non vides et ne révèle aucun secret.';
      return;
    }
    if (!activitySession) {
      deliverableStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
      return;
    }
    try {
      activitySession.recordExercise('E0.4', true, 20);
      const current = activitySession.getProgress();
      const updatedModule = setModuleProgress(current, 'm0', {
        ...current.modules.m0,
        deliverable_url: url.replace(/\/$/, ''),
      });
      createSession(saveProgress(updatedModule));
      deliverableStatus.textContent = 'Format accepté et livrable enregistré. La page n’a pas vérifié le dépôt sur GitHub.';
    } catch (error) {
      deliverableStatus.textContent = `Le livrable n’a pas pu être enregistré : ${error.message}`;
    }
  });
}

async function startFight(questions) {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
    return;
  }
  startFightButton.disabled = true;
  moduleStatus.textContent = '';
  try {
    const { mountFight } = await import('../../assets/js/core/fight-ui.js');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    mountFight(fightRoot, {
      questions,
      answerKey,
      seed,
      enemyName: lore.bosses.m0,
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

async function startDungeon() {
  if (!activitySession) {
    moduleStatus.textContent = 'Crée ou importe d’abord ta progression depuis l’accueil.';
    return;
  }
  const storedAttempt = activitySession.getProgress().modules.m0?.dungeon;
  if (storedAttempt?.date === localDate()) {
    startDungeonButton.disabled = true;
    moduleStatus.textContent = 'Une tentative a déjà été enregistrée aujourd’hui sur cet appareil.';
    return;
  }
  startDungeonButton.disabled = true;
  moduleStatus.textContent = '';
  try {
    const { mountDungeon } = await import('./dungeon.js');
    dungeonAttempt = mountDungeon(dungeonRoot, {
      questions: quiz.questions,
      answerKey,
      activitySession,
      ...dungeonConfig,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    });
  } catch (error) {
    startDungeonButton.disabled = false;
    moduleStatus.textContent = `L’épreuve n’a pas pu démarrer : ${error.message}`;
  }
}

async function init() {
  try {
    [answerKey, content, quiz, dungeonConfig, lore] = await Promise.all([
      fetchJson(answerKeyUrl, 'les références de correction'),
      fetchJson(new URL('./exercises.json', moduleBase), 'les exercices du module'),
      fetchJson(new URL('./quiz.json', moduleBase), 'le combat'),
      fetchJson(new URL('./dungeon.json', moduleBase), 'les règles de l’épreuve'),
      fetchJson(new URL('../../assets/data/lore.json', import.meta.url), 'les noms du parcours'),
    ]);
  } catch (error) {
    moduleStatus.textContent = `Le module n’a pas pu charger ses fichiers : ${error.message}`;
    return;
  }
  for (const exercise of content.exercises) {
    if (!answerKey.items?.[exercise.id]) {
      moduleStatus.textContent = `La référence de correction manque pour ${exercise.id}.`;
      return;
    }
  }
  for (const question of quiz.questions) {
    if (!answerKey.items?.[question.id]) {
      moduleStatus.textContent = `La référence de correction manque pour ${question.id}.`;
      return;
    }
    if (typeof lore.bosses?.m0 !== 'string' || !lore.bosses.m0) {
      moduleStatus.textContent = 'Le nom du boss m0 manque dans les données du parcours.';
      return;
    }
  }
  try {
    createSession(loadProgress());
  } catch (error) {
    progressStatus.textContent = `La progression locale n’a pas pu être chargée : ${error.message}`;
  }
  addExerciseButtons();
  setupDeliverable();
  startFightButton.addEventListener('click', () => void startFight(quiz.questions));
  startDungeonButton.addEventListener('click', () => void startDungeon());
}

void init();

window.addEventListener('pagehide', () => {
  pythonRunner?.dispose();
  courseRuntime?.dispose();
  dungeonAttempt?.destroy();
});
