import { submitExercise } from './exercise.js';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderSqlResult(container, result) {
  if (!result || !Array.isArray(result.columns) || !Array.isArray(result.rows)) return;
  const table = node('table', undefined, 'exercise-result-table');
  const head = node('thead');
  const headerRow = node('tr');
  for (const column of result.columns) {
    const header = node('th', String(column));
    header.scope = 'col';
    headerRow.append(header);
  }
  head.append(headerRow);
  const body = node('tbody');
  for (const row of result.rows) {
    const tr = node('tr');
    for (const value of row) tr.append(node('td', value === null ? 'NULL' : String(value)));
    body.append(tr);
  }
  table.append(head, body);
  container.append(table);
  if (result.truncated) container.append(node('p', 'Affichage limité : certaines lignes sont masquées.'));
  if (Array.isArray(result.queryPlan) && result.queryPlan.length) {
    const details = node('details');
    details.append(node('summary', 'Voir le plan de requête'));
    details.append(node('pre', JSON.stringify(result.queryPlan, null, 2)));
    container.append(details);
  }
}

function renderPythonResult(container, result) {
  if (result.stdout) {
    container.append(node('h3', 'Sortie'));
    container.append(node('pre', result.stdout));
  }
  if (result.stderr) {
    container.append(node('h3', 'Messages'));
    container.append(node('pre', result.stderr));
  }
  if (result.error) {
    container.append(node('h3', 'Erreur Python'));
    container.append(node('pre', result.traceback || result.error));
  }
  for (const [index, data] of (result.figures ?? []).entries()) {
    const figure = node('figure', undefined, 'exercise-figure');
    const image = node('img');
    image.src = `data:image/png;base64,${data}`;
    image.alt = `Graphique ${index + 1} produit par le code.`;
    figure.append(image, node('figcaption', `Graphique ${index + 1}`));
    container.append(figure);
  }
}

export function mountExercise(root, {
  exercise,
  answerKey,
  runner,
  files = [],
  onResult = () => {},
} = {}) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('A DOM root element is required.');
  if (!exercise || typeof exercise.id !== 'string'
    || typeof exercise.prompt !== 'string' || !exercise.prompt.trim()) {
    throw new TypeError('An exercise id and prompt are required.');
  }
  if (typeof onResult !== 'function') throw new TypeError('onResult must be a function.');
  if (!['python', 'sql', 'text', 'num'].includes(exercise.type)) {
    throw new TypeError(`Unsupported exercise type: ${exercise.type}`);
  }

  const form = node('form', undefined, 'exercise-form');
  const heading = node('h2', exercise.title || exercise.id);
  const prompt = node('p', exercise.prompt);
  const label = node('label', exercise.type === 'python' ? 'Ton code Python'
    : exercise.type === 'sql' ? 'Ta requête SQL'
      : exercise.type === 'num' ? 'Ta réponse numérique' : 'Ta réponse');
  const input = node(['python', 'sql'].includes(exercise.type) ? 'textarea' : 'input');
  const inputId = `exercise-${String(exercise.id).replace(/[^a-zA-Z0-9_-]/g, '-')}-answer`;
  input.id = inputId;
  input.name = inputId;
  label.htmlFor = inputId;
  if (input.tagName === 'TEXTAREA') {
    input.rows = exercise.type === 'python' ? 12 : 8;
    input.spellcheck = false;
    input.value = exercise.type === 'python' ? exercise.starter_code ?? '' : exercise.starter_query ?? '';
  } else if (exercise.type === 'num') {
    input.type = 'number';
    input.step = 'any';
  }
  const submit = node('button', 'Exécuter et vérifier');
  submit.type = 'submit';
  const status = node('p', '', 'exercise-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const output = node('section', undefined, 'exercise-output');
  output.setAttribute('aria-label', 'Résultat de l’exercice');
  output.setAttribute('aria-live', 'off');
  form.append(heading, prompt, label, input, submit, status, output);
  root.replaceChildren(form);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Exécution en cours…';
    output.replaceChildren();
    try {
      const result = await submitExercise({
        exercise,
        runner,
        answerKey,
        code: exercise.type === 'python' ? input.value : undefined,
        query: exercise.type === 'sql' ? input.value : undefined,
        answer: ['text', 'num'].includes(exercise.type)
          ? input.value
          : undefined,
        files,
        packages: exercise.packages ?? [],
      });
      if (result.status === 'error') {
        status.textContent = `Le code n’a pas pu être vérifié : ${result.execution?.error ?? 'erreur d’exécution'}`;
        if (result.execution?.traceback) output.append(node('pre', result.execution.traceback));
      } else {
        status.textContent = result.correct ? 'Bonne réponse.' : 'Ce résultat ne correspond pas encore à la référence.';
        if (exercise.explanation) output.append(node('p', exercise.explanation));
        if (exercise.type === 'python') renderPythonResult(output, result.execution);
        if (exercise.type === 'sql') renderSqlResult(output, result.execution);
      }
      try {
        await onResult(result);
      } catch (error) {
        status.textContent = `La mise à jour de la progression a échoué : ${error.message}`;
      }
    } catch (error) {
      status.textContent = `L’exercice n’a pas pu être exécuté : ${error.message}`;
    } finally {
      submit.disabled = false;
    }
  });

  return {
    destroy() {
      root.replaceChildren();
    },
    getInput() {
      return input;
    },
  };
}
