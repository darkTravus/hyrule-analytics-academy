import { normalCdf, normalQuantile } from './stats-math.js';

function assertCount(label, successes, trials) {
  if (!Number.isInteger(successes) || !Number.isInteger(trials)
    || trials <= 0 || successes < 0 || successes > trials) {
    throw new RangeError(`${label}: successes must be an integer between zero and positive trials`);
  }
}

export function calculateAbTest({ successesA, trialsA, successesB, trialsB, confidence = 0.95 }) {
  assertCount('A', successesA, trialsA);
  assertCount('B', successesB, trialsB);
  if (typeof confidence !== 'number' || confidence <= 0 || confidence >= 1) {
    throw new RangeError('confidence must be between zero and one');
  }
  const rateA = successesA / trialsA;
  const rateB = successesB / trialsB;
  const difference = rateB - rateA;
  const pooled = (successesA + successesB) / (trialsA + trialsB);
  const standardErrorNull = Math.sqrt(pooled * (1 - pooled) * (1 / trialsA + 1 / trialsB));
  const z = standardErrorNull === 0 ? 0 : difference / standardErrorNull;
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  const alpha = 1 - confidence;
  const critical = normalQuantile(1 - alpha / 2);
  const standardErrorDifference = Math.sqrt(
    rateA * (1 - rateA) / trialsA + rateB * (1 - rateB) / trialsB,
  );
  return {
    rateA,
    rateB,
    difference,
    z,
    pValue,
    confidence,
    interval: [
      difference - critical * standardErrorDifference,
      difference + critical * standardErrorDifference,
    ],
  };
}

export function mountAbCalculator(root, initial = {}) {
  const values = {
    successesA: initial.successesA ?? 20,
    trialsA: initial.trialsA ?? 100,
    successesB: initial.successesB ?? 30,
    trialsB: initial.trialsB ?? 100,
    confidence: initial.confidence ?? 0.95,
  };
  const form = document.createElement('form');
  form.className = 'widget-form';
  const labels = [
    ['successesA', 'Conversions du groupe A', 'number'],
    ['trialsA', 'Participants du groupe A', 'number'],
    ['successesB', 'Conversions du groupe B', 'number'],
    ['trialsB', 'Participants du groupe B', 'number'],
  ];
  for (const [name, text, type] of labels) {
    const id = `ab-${name}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = text;
    const input = document.createElement('input');
    input.id = id;
    input.name = name;
    input.type = type;
    input.min = '0';
    input.step = '1';
    input.required = true;
    input.value = values[name];
    form.append(label, input);
  }
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Comparer les groupes';
  const output = document.createElement('div');
  output.className = 'widget-output';
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  form.append(button, output);
  root.replaceChildren(form);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = calculateAbTest({
        successesA: Number(data.get('successesA')),
        trialsA: Number(data.get('trialsA')),
        successesB: Number(data.get('successesB')),
        trialsB: Number(data.get('trialsB')),
      });
      output.textContent = `A : ${(result.rateA * 100).toFixed(1)} % · B : ${(result.rateB * 100).toFixed(1)} % · écart B−A : ${(result.difference * 100).toFixed(1)} points · IC 95 % : ${(result.interval[0] * 100).toFixed(1)} à ${(result.interval[1] * 100).toFixed(1)} points · p = ${result.pValue.toFixed(4)}.`;
    } catch (error) {
      output.textContent = `Calcul impossible : ${error.message}`;
    }
  });
  return { destroy: () => root.replaceChildren() };
}
