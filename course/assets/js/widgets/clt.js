function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateSampleMeans({
  population,
  sampleSize = 1,
  repetitions = 2000,
  seed = 20261104,
}) {
  if (!Array.isArray(population) || population.length < 2
    || population.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('population must contain at least two finite numbers');
  }
  if (!Number.isInteger(sampleSize) || sampleSize < 1 || sampleSize > 500) {
    throw new RangeError('sampleSize must be an integer from 1 to 500');
  }
  if (!Number.isInteger(repetitions) || repetitions < 100 || repetitions > 10_000) {
    throw new RangeError('repetitions must be an integer from 100 to 10000');
  }
  if (!Number.isInteger(seed)) throw new TypeError('seed must be an integer');
  const random = mulberry32(seed);
  const populationMean = population.reduce((sum, value) => sum + value, 0) / population.length;
  const populationVariance = population.reduce((sum, value) => sum + (value - populationMean) ** 2, 0) / population.length;
  const means = Array.from({ length: repetitions }, () => {
    let total = 0;
    for (let index = 0; index < sampleSize; index++) {
      total += population[Math.floor(random() * population.length)];
    }
    return total / sampleSize;
  });
  const mean = means.reduce((sum, value) => sum + value, 0) / means.length;
  const standardDeviation = Math.sqrt(
    means.reduce((sum, value) => sum + (value - mean) ** 2, 0) / means.length,
  );
  return {
    means,
    populationMean,
    mean,
    standardDeviation,
    theoreticalStandardError: Math.sqrt(populationVariance / sampleSize),
  };
}

export function mountCltWidget(root, {
  population = [0, 0, 0, 0, 1, 2, 5, 10],
  sampleSize = 1,
  repetitions = 2000,
  seed = 20261104,
} = {}) {
  const form = document.createElement('form');
  form.className = 'widget-form';
  const fields = [
    ['sampleSize', 'Taille de chaque échantillon', sampleSize, 1, 500],
    ['repetitions', 'Nombre de tirages répétés', repetitions, 100, 10_000],
  ];
  for (const [name, labelText, value, min, max] of fields) {
    const id = `clt-${name}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = id;
    input.name = name;
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.step = '1';
    input.value = value;
    input.required = true;
    form.append(label, input);
  }
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Simuler les échantillons';
  const output = document.createElement('div');
  output.className = 'widget-output clt-output';
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  form.append(button, output);
  root.replaceChildren(form);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = simulateSampleMeans({
        population,
        sampleSize: Number(data.get('sampleSize')),
        repetitions: Number(data.get('repetitions')),
        seed,
      });
      output.replaceChildren();
      const summary = document.createElement('p');
      summary.textContent = `Moyenne des moyennes : ${result.mean.toFixed(2)} (moyenne de la population : ${result.populationMean.toFixed(2)}). Écart-type observé : ${result.standardDeviation.toFixed(2)} (erreur-type théorique : ${result.theoreticalStandardError.toFixed(2)}).`;
      const histogram = document.createElement('ol');
      histogram.className = 'clt-histogram';
      histogram.setAttribute('aria-label', 'Distribution des moyennes simulées');
      const min = Math.min(...result.means);
      const max = Math.max(...result.means);
      const bins = Array.from({ length: 12 }, () => 0);
      for (const value of result.means) {
        const index = max === min ? 0 : Math.min(bins.length - 1, Math.floor((value - min) / (max - min) * bins.length));
        bins[index]++;
      }
      const peak = Math.max(...bins);
      for (const [index, count] of bins.entries()) {
        const item = document.createElement('li');
        const bar = document.createElement('span');
        bar.style.setProperty('--bar-scale', count / peak);
        bar.setAttribute('aria-hidden', 'true');
        item.append(bar);
        const text = document.createElement('span');
        text.textContent = `${(min + (max - min) * index / bins.length).toFixed(1)} : ${count}`;
        item.append(text);
        histogram.append(item);
      }
      output.append(summary, histogram);
    } catch (error) {
      output.textContent = `Simulation impossible : ${error.message}`;
    }
  });
  form.requestSubmit();
  return { destroy: () => root.replaceChildren() };
}
