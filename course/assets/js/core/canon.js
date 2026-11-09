// Format canonique des résultats : strictement identique à grading/hashing.py.
// Nombre -> 2 décimales (toFixed arrondit le demi vers +inf pour les positifs ; on traite le signe à part
// pour obtenir « demi à l'écart de zéro », comme Decimal.ROUND_HALF_UP côté Python).
export const cell = v => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') {
    const x = Number(v);
    if (!Number.isFinite(x)) throw new TypeError('numeric cells must be finite');
    const s = Math.abs(x).toFixed(2);
    return (x < 0 && Number(s) !== 0 ? '-' : '') + s; // jamais de « -0.00 »
  }
  return String(v);
};

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashText(key, value, salt) {
  const normalized = String(value).trim().split(/\s+/u).join(' ').toLowerCase();
  return sha256(`${key}|${normalized}|${salt}`);
}

function roundHalfEven(value) {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) return lower;
  if (fraction > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
}

export function numCell(value, tol) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('value must be a finite number');
  }
  if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 0) {
    throw new TypeError('tol must be a finite non-negative number');
  }
  return roundHalfEven(tol ? value / tol : value * 1e6);
}

export async function hashNum(key, value, tol, salt, shift = 0) {
  if (!Number.isInteger(shift)) throw new TypeError('shift must be an integer');
  return sha256(`${key}|${numCell(value, tol) + shift}|${salt}`);
}

export async function matchNum(key, value, tol, salt, expected) {
  const shifts = tol ? [-1, 0, 1] : [0];
  for (const shift of shifts) {
    if (await hashNum(key, value, tol, salt, shift) === expected) return true;
  }
  return false;
}

// Comparaison par point de code Unicode (comme Python), et non par unité UTF-16.
const cmpStr = (a, b) => {
  const A = [...a], B = [...b];
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const d = A[i].codePointAt(0) - B[i].codePointAt(0);
    if (d) return d;
  }
  return A.length - B.length;
};
const cmpRow = (r, s) => {
  for (let i = 0; i < Math.min(r.length, s.length); i++) { const c = cmpStr(r[i], s[i]); if (c) return c; }
  return r.length - s.length;
};

export async function hashRows(key, rows, salt, orderMatters = false) {
  const cells = rows.map(r => r.map(cell));
  if (!orderMatters) cells.sort(cmpRow);
  return sha256(`${key}|${JSON.stringify(cells)}|${salt}`);
}
