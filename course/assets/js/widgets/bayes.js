export function calculateBayes({ prevalence, sensitivity, specificity }) {
  for (const [name, value] of Object.entries({ prevalence, sensitivity, specificity })) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${name} must be a probability between zero and one`);
    }
  }
  const truePositive = prevalence * sensitivity;
  const falsePositive = (1 - prevalence) * (1 - specificity);
  const positiveRate = truePositive + falsePositive;
  if (positiveRate === 0) throw new RangeError('A positive result has zero probability with these inputs');
  return {
    truePositive,
    falsePositive,
    positiveRate,
    posterior: truePositive / positiveRate,
  };
}

export function mountBayesCalculator(root, initial = {}) {
  const inputs = [
    ['prevalence', 'Prévalence', initial.prevalence ?? 0.005],
    ['sensitivity', 'Sensibilité', initial.sensitivity ?? 0.98],
    ['specificity', 'Spécificité', initial.specificity ?? 0.98],
  ];
  const form = document.createElement('form');
  form.className = 'widget-form';
  for (const [name, labelText, value] of inputs) {
    const label = document.createElement('label');
    const id = `bayes-${name}`;
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = id;
    input.name = name;
    input.type = 'number';
    input.min = '0';
    input.max = '1';
    input.step = '0.001';
    input.required = true;
    input.value = value;
    form.append(label, input);
  }
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Calculer la probabilité';
  const output = document.createElement('p');
  output.className = 'widget-output';
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  form.append(button, output);
  root.replaceChildren(form);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = calculateBayes({
        prevalence: Number(data.get('prevalence')),
        sensitivity: Number(data.get('sensitivity')),
        specificity: Number(data.get('specificity')),
      });
      output.textContent = `Parmi les résultats positifs, ${(result.posterior * 100).toFixed(1)} % correspondent à un vrai cas (valeur prédictive positive).`;
    } catch (error) {
      output.textContent = `Calcul impossible : ${error.message}`;
    }
  });
  return { destroy: () => root.replaceChildren() };
}
