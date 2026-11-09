import { sha256 } from './canon.js';

const MODULE_ID = /^m[0-9]$/;
const TOKEN = /^([A-Za-z0-9_-]+)\.([a-f0-9]{16})$/;
const PAYLOAD_KEYS = ['alias', 'module', 'hearts', 'xp', 'date', 'nonce'];

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Token payload must be an object');
  }
  if (typeof payload.alias !== 'string' || payload.alias.trim() === '') {
    throw new TypeError('Token alias must be a non-empty string');
  }
  if (typeof payload.module !== 'string' || !MODULE_ID.test(payload.module)) {
    throw new TypeError('Token module must be m0 through m9');
  }
  if (!Number.isInteger(payload.hearts) || payload.hearts < 0 || payload.hearts > 3) {
    throw new TypeError('Token hearts must be an integer from 0 to 3');
  }
  if (!Number.isSafeInteger(payload.xp) || payload.xp < 0) {
    throw new TypeError('Token xp must be a non-negative safe integer');
  }
  if (typeof payload.date !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)
    || Number.isNaN(Date.parse(`${payload.date}T00:00:00Z`))
    || new Date(`${payload.date}T00:00:00Z`).toISOString().slice(0, 10) !== payload.date) {
    throw new TypeError('Token date must be a valid YYYY-MM-DD date');
  }
  if (typeof payload.nonce !== 'string' || payload.nonce.trim() === '') {
    throw new TypeError('Token nonce must be a non-empty string');
  }
}

function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function orderedPayload(payload) {
  return Object.fromEntries(PAYLOAD_KEYS.map(key => [key, payload[key]]));
}

export async function createToken({ alias, module, hearts, xp, date, nonce }, salt) {
  if (typeof salt !== 'string' || salt.length === 0) throw new TypeError('Token salt must be a non-empty string');
  const payload = {
    alias,
    module,
    hearts,
    xp,
    date: date ?? new Date().toISOString().slice(0, 10),
    nonce: nonce ?? crypto.randomUUID(),
  };
  validatePayload(payload);
  const charge = JSON.stringify(orderedPayload(payload));
  const encoded = encodeBase64Url(charge);
  const fingerprint = (await sha256(`${charge}${salt}`)).slice(0, 16);
  return `${encoded}.${fingerprint}`;
}

export async function verifyToken(token, salt) {
  if (typeof salt !== 'string' || salt.length === 0) throw new TypeError('Token salt must be a non-empty string');
  if (typeof token !== 'string') return { valid: false, reason: 'Token must be text' };
  const match = TOKEN.exec(token);
  if (!match) return { valid: false, reason: 'Token format is invalid' };

  let charge;
  let payload;
  try {
    charge = decodeBase64Url(match[1]);
    if (encodeBase64Url(charge) !== match[1]) {
      return { valid: false, reason: 'Token payload encoding is not canonical' };
    }
    payload = JSON.parse(charge);
    validatePayload(payload);
  } catch (error) {
    return { valid: false, reason: `Token payload is invalid: ${error.message}` };
  }
  if (JSON.stringify(orderedPayload(payload)) !== charge) {
    return { valid: false, reason: 'Token payload is not canonical' };
  }

  const expected = (await sha256(`${charge}${salt}`)).slice(0, 16);
  if (expected !== match[2]) return { valid: false, reason: 'Token fingerprint does not match' };
  return { valid: true, payload };
}
