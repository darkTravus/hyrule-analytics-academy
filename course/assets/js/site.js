import {
  createProgress,
  exportProgress,
  importProgress,
  loadProgress,
  saveProgress,
} from './core/progress.js';
import { moduleHearts, playerLevel } from './core/progress-rewards.js';

const form = document.querySelector('#create-progress');
const aliasInput = document.querySelector('#alias');
const exportButton = document.querySelector('#export-progress');
const importInput = document.querySelector('#import-file');
const summary = document.querySelector('#progress-summary');
const status = document.querySelector('#site-status');
const playerName = document.querySelector('#player-name');
const playerLevelLabel = document.querySelector('#player-level');
const xpTotal = document.querySelector('#xp-total');
const xpProgress = document.querySelector('#xp-progress');
const xpNext = document.querySelector('#xp-next');
const heartTotal = document.querySelector('#heart-total');
const badgeTotal = document.querySelector('#badge-total');
let progress = null;

function renderProgress(value) {
  progress = value;
  const xp = value?.xp_total ?? 0;
  const level = playerLevel(xp);
  const currentLevelStart = (level - 1) ** 2 * 100;
  const nextLevelXp = level ** 2 * 100;
  const levelProgress = xp - currentLevelStart;
  const needed = nextLevelXp - currentLevelStart;
  const hearts = Object.values(value?.modules ?? {})
    .map(moduleHearts)
    .reduce((total, module) => total + module.quiz + module.exercises + module.fight, 0);

  playerName.textContent = value?.alias ?? 'Nouveau personnage';
  playerLevelLabel.textContent = `Niveau ${level} · ${level === 1 ? 'Explorateur' : 'Aventurier'}`;
  xpTotal.textContent = `${xp.toLocaleString('fr-FR')} XP`;
  xpProgress.max = needed;
  xpProgress.value = levelProgress;
  xpProgress.textContent = `${Math.round(levelProgress / needed * 100)} %`;
  xpNext.textContent = level < 10
    ? `Encore ${(nextLevelXp - xp).toLocaleString('fr-FR')} XP pour atteindre le niveau ${level + 1}.`
    : 'Niveau maximum atteint : bravo, légende des données !';
  heartTotal.textContent = `${hearts} / 30`;
  badgeTotal.textContent = String(value?.badges.length ?? 0);
  exportButton.disabled = !value;
  summary.textContent = value
    ? `Progression de ${value.alias} — ${xp.toLocaleString('fr-FR')} XP, ${Object.keys(value.modules).length} module(s) commencé(s).`
    : 'Aucune progression chargée.';
  if (value) aliasInput.value = value.alias;

  for (const card of document.querySelectorAll('.map-node[data-module]')) {
    const module = value?.modules?.[card.dataset.module];
    const hearts = moduleHearts(module);
    const completed = hearts.quiz === 1
      && hearts.exercises === 1
      && (card.dataset.module === 'm0' ? Boolean(module?.deliverable_url) : hearts.fight === 1);
    card.classList.toggle('map-node--completed', completed);
  }
}

try {
  renderProgress(loadProgress());
} catch (error) {
  renderProgress(null);
  status.textContent = `La progression locale n'a pas pu être chargée : ${error.message}`;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const alias = aliasInput.value.trim();
    const alreadySaved = progress !== null;
    const updated = progress ? { ...progress, alias } : createProgress(alias);
    renderProgress(saveProgress(updated));
    status.textContent = alreadySaved
      ? 'Alias mis à jour. Ton aventure et ses récompenses sont conservés.'
      : 'Ton camp est prêt : progression enregistrée sur cet appareil.';
  } catch (error) {
    status.textContent = `La progression n'a pas pu être enregistrée : ${error.message}`;
  }
});

exportButton.addEventListener('click', () => {
  if (!progress) return;
  try {
    const file = new Blob([exportProgress(progress)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `progression-${progress.alias.replace(/[^a-z0-9_-]/gi, '_')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Fichier de progression exporté.';
  } catch (error) {
    status.textContent = `L'export a échoué : ${error.message}`;
  }
});

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    renderProgress(importProgress(await file.text()));
    status.textContent = 'Progression importée et enregistrée sur cet appareil.';
  } catch (error) {
    status.textContent = `L'import a échoué : ${error.message}`;
  } finally {
    importInput.value = '';
  }
});
