import { normalCdf, normalQuantile, sampleSizeForProportions } from './stats-math.js';

export function calculatePower({ baseline, effect, sampleSize, alpha = 0.05 }) {
  for (const [name, value] of Object.entries({ baseline, effect, sampleSize, alpha })) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  }
  const treatment = baseline + effect;
  if (baseline <= 0 || baseline >= 1 || treatment <= 0 || treatment >= 1) {
    throw new RangeError('baseline and baseline + effect must be between zero and one');
  }
  if (!Number.isInteger(sampleSize) || sampleSize < 2) throw new RangeError('sampleSize must be an integer of at least two');
  if (alpha <= 0 || alpha >= 1) throw new RangeError('alpha must be between zero and one');
  const pooled = (baseline + treatment) / 2;
  const nullStandardError = Math.sqrt(2 * pooled * (1 - pooled) / sampleSize);
  const alternativeStandardError = Math.sqrt(
    (baseline * (1 - baseline) + treatment * (1 - treatment)) / sampleSize,
  );
  const critical = normalQuantile(1 - alpha / 2) * nullStandardError;
  const meanDifference = Math.abs(effect);
  const power = normalCdf((-critical - meanDifference) / alternativeStandardError)
    + 1 - normalCdf((critical - meanDifference) / alternativeStandardError);
  return Math.min(1, Math.max(0, power));
}

export { sampleSizeForProportions };

export function mountPowerCalculator(root, initial = {}) {
  const fields = [
    ['baseline', 'Taux de référence', initial.baseline ?? 0.2],
    ['effect', 'Effet minimal à détecter', initial.effect ?? 0.04],
    ['sampleSize', 'Participants par groupe', initial.sampleSize ?? 1700],
  ];
  const form = document.createElement('form');
  form.className = 'widget-form';
  for (const [name, labelText, value] of fields) {
    const id = `power-${name}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = id;
    input.name = name;
    input.type = 'number';
    input.min = name === 'sampleSize' ? '2' : '0.001';
    input.step = name === 'sampleSize' ? '1' : '0.001';
    input.required = true;
    input.value = value;
    form.append(label, input);
  }
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Estimer la puissance';
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
      const baseline = Number(data.get('baseline'));
      const effect = Number(data.get('effect'));
      const sampleSize = Number(data.get('sampleSize'));
      const power = calculatePower({ baseline, effect, sampleSize });
      const required = sampleSizeForProportions({ baseline, effect, power: 0.8 });
      output.textContent = `Puissance estimée : ${(power * 100).toFixed(1)} %. Pour viser 80 %, prévois environ ${required.toLocaleString('fr-FR')} personnes par groupe.`;
    } catch (error) {
      output.textContent = `Calcul impossible : ${error.message}`;
    }
  });
  return { destroy: () => root.replaceChildren() };
}
