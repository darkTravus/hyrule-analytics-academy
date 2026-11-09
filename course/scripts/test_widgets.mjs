import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAbTest } from '../assets/js/widgets/ab-calc.js';
import { calculateBayes } from '../assets/js/widgets/bayes.js';
import { simulateSampleMeans } from '../assets/js/widgets/clt.js';
import { calculatePower, sampleSizeForProportions } from '../assets/js/widgets/power.js';
import { normalCdf, normalQuantile } from '../assets/js/widgets/stats-math.js';

test('normal CDF and quantile agree at common confidence levels', () => {
  assert.ok(Math.abs(normalQuantile(0.975) - 1.959964) < 1e-5);
  assert.ok(Math.abs(normalCdf(1.959964) - 0.975) < 1e-6);
});

test('A/B calculator returns rates, a two-sided p-value, and a confidence interval', () => {
  const result = calculateAbTest({
    successesA: 400,
    trialsA: 2000,
    successesB: 480,
    trialsB: 2000,
  });
  assert.ok(Math.abs(result.rateA - 0.2) < 1e-12);
  assert.ok(Math.abs(result.rateB - 0.24) < 1e-12);
  assert.ok(Math.abs(result.difference - 0.04) < 1e-12);
  assert.ok(result.pValue < 0.01);
  assert.ok(result.interval[0] < result.difference && result.interval[1] > result.difference);
  assert.throws(() => calculateAbTest({ successesA: 101, trialsA: 100, successesB: 1, trialsB: 10 }), /successes/);
});

test('power and sample-size estimates are consistent and validate input', () => {
  const sampleSize = sampleSizeForProportions({ baseline: 0.2, effect: 0.04 });
  assert.equal(sampleSize, 1683);
  const estimatedPower = calculatePower({ baseline: 0.2, effect: 0.04, sampleSize });
  assert.ok(estimatedPower >= 0.79 && estimatedPower <= 0.83);
  assert.ok(calculatePower({ baseline: 0.08, effect: 0.04, sampleSize: 300 }) < 0.5);
  assert.throws(() => sampleSizeForProportions({ baseline: 0.2, effect: 0 }), /must not be zero/);
});

test('Bayes calculator reproduces the low-prevalence detector example', () => {
  const result = calculateBayes({ prevalence: 0.005, sensitivity: 0.98, specificity: 0.98 });
  assert.ok(Math.abs(result.posterior - 0.19758) < 0.001);
  assert.throws(() => calculateBayes({ prevalence: 1.1, sensitivity: 0.9, specificity: 0.9 }), /probability/);
});

test('CLT simulation is reproducible and approaches the theoretical standard error', () => {
  const options = { population: [0, 0, 0, 0, 1, 2, 5, 10], sampleSize: 5, repetitions: 5000, seed: 11 };
  const first = simulateSampleMeans(options);
  const second = simulateSampleMeans(options);
  assert.deepEqual(first.means, second.means);
  assert.ok(Math.abs(first.mean - first.populationMean) < 0.15);
  assert.ok(Math.abs(first.standardDeviation - first.theoreticalStandardError) < 0.15);
});
