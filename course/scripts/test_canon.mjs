import test from 'node:test';
import assert from 'node:assert/strict';
import { cell, hashNum, hashRows, hashText, matchNum, numCell } from '../assets/js/core/canon.js';

const salt = 'cross-language';

test('canonicalizes cells and hashes rows with Python-compatible vectors', async () => {
  assert.equal(cell(null), '');
  assert.equal(cell(-0.001), '0.00');
  assert.equal(cell(-2.675), '-2.67');
  assert.equal(
    await hashRows('E2.1', [['😀', 1.005], ['é', -2.675]], salt),
    '541ddfc0316b36858d1a39bba3a1d264c2c06b9093cdc565ea10d7350d40c5f1',
  );
});

test('normalizes text and matches Python hash_text vectors', async () => {
  assert.equal(
    await hashText('E0.1', '  HÉROS\tdu   royaume  ', salt),
    'f7a5f7d80a805b5a52a91353ed59d9077b887639e4edca9f3f94847ed000eb5f',
  );
  assert.equal(
    await hashText('E0.2', '😀 Épée', salt),
    '542274f6074d5aabd8444e2845c0cecb6db070855cccf497cf1082cd3462d041',
  );
});

test('uses ties-to-even for numeric buckets, including negative values', async () => {
  assert.equal(numCell(2.5, 1), 2);
  assert.equal(numCell(-2.5, 1), -2);
  assert.equal(numCell(0.001, 0), 1000);
  assert.equal(numCell(-0.001, 0), -1000);
  assert.equal(
    await hashNum('E1.1', 2.5, 1, salt),
    '4966beeee2bd2dcf76f30398576b0e8438b78675f6a2c59cbae15a1aa1d93353',
  );
  assert.equal(
    await hashNum('E1.2', -2.5, 1, salt),
    'fcbca18c7f307c3977c39222956ca6c0d01a5a68a586876bd83831c9ee4451ac',
  );
  assert.equal(await matchNum('E1.1', 2.5, 1, salt, await hashNum('E1.1', 3, 1, salt)), true);
  assert.equal(await matchNum('E1.1', 2.5, 0, salt, await hashNum('E1.1', 2.5, 0, salt)), true);
});

test('rejects invalid numeric inputs', async () => {
  assert.throws(() => cell(Number.NaN), /must be finite/);
  assert.throws(() => cell(Number.POSITIVE_INFINITY), /must be finite/);
  assert.throws(() => numCell(Number.NaN, 0), /finite number/);
  assert.throws(() => numCell(1, -1), /non-negative/);
  await assert.rejects(hashNum('E1.1', 1, 0, salt, 0.5), /integer/);
});
