export function normalCdf(value) {
  if (!Number.isFinite(value)) throw new TypeError('value must be finite');
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = 0.3989422804014327 * Math.exp(-0.5 * absolute * absolute);
  const tail = density * t * (
    0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))
  );
  return value >= 0 ? 1 - tail : tail;
}

export function normalQuantile(probability) {
  if (typeof probability !== 'number' || probability <= 0 || probability >= 1) {
    throw new TypeError('probability must be between zero and one');
  }
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;
  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability > high) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = probability - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function sampleSizeForProportions({ baseline, effect, alpha = 0.05, power = 0.8 }) {
  for (const [name, value] of Object.entries({ baseline, effect, alpha, power })) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  }
  const treatment = baseline + effect;
  if (baseline <= 0 || baseline >= 1 || treatment <= 0 || treatment >= 1) {
    throw new RangeError('baseline and baseline + effect must be between zero and one');
  }
  if (effect === 0) throw new RangeError('effect must not be zero');
  if (alpha <= 0 || alpha >= 1 || power <= 0 || power >= 1) {
    throw new RangeError('alpha and power must be between zero and one');
  }
  const mean = (baseline + treatment) / 2;
  const pooledSd = Math.sqrt(2 * mean * (1 - mean));
  const outcomeSd = Math.sqrt(baseline * (1 - baseline) + treatment * (1 - treatment));
  const critical = normalQuantile(1 - alpha / 2);
  const betaCritical = normalQuantile(power);
  return Math.ceil(((critical * pooledSd + betaCritical * outcomeSd) / Math.abs(effect)) ** 2);
}
