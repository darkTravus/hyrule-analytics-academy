import test from 'node:test';
import assert from 'node:assert/strict';
import { API_KEY } from '../assets/js/mock/routes.js';
import { HqoMockApi, API_ORIGIN, getCompendiumJson } from '../assets/js/mock/mock-api.js';

const players = [
  { player_id: 'P000001', platform: 'ios', country: 'FR' },
  { player_id: 'P000002', platform: 'pc', country: 'US' },
  { player_id: 'P000003', platform: 'ios', country: 'CA' },
];

class FixtureDatabase {
  execute(sql, { params = [] } = {}) {
    if (/SELECT COUNT\(\*\) AS count FROM players/.test(sql)) {
      const platform = params.length === 1 ? params[0] : null;
      const filtered = players.filter(player => !platform || player.platform === platform);
      return { columns: ['count'], rows: [[filtered.length]] };
    }
    if (/SELECT \* FROM players WHERE player_id = \?/.test(sql)) {
      const row = players.find(player => player.player_id === params[0]);
      return { columns: row ? Object.keys(row) : [], rows: row ? [Object.values(row)] : [] };
    }
    if (/SELECT \* FROM players/.test(sql)) {
      const limit = params.at(-2);
      const offset = params.at(-1);
      const filtered = players.filter(player => !params.slice(0, -2).includes('pc') || player.platform === 'pc');
      const rows = filtered.slice(offset, offset + limit);
      return { columns: ['player_id', 'platform', 'country'], rows: rows.map(Object.values) };
    }
    throw new Error(`Unexpected SQL in fixture: ${sql}`);
  }
}

function request(path, { method = 'GET', apiKey = API_KEY, body } = {}) {
  const headers = {};
  if (apiKey !== null) headers['X-API-Key'] = apiKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(`${API_ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('status and authenticated pagination follow the public response format', async () => {
  const api = new HqoMockApi({ database: new FixtureDatabase(), latency: false });
  const status = await api.fetch(request('/v1/status', { apiKey: null }));
  assert.equal(status.status, 200);
  assert.equal((await status.json()).data.status, 'ok');

  const response = await api.fetch(request('/v1/players?limit=1'));
  const page = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(page.data, [players[0]]);
  assert.deepEqual(page.meta, { limit: 1, next_cursor: 'c_000001', total: 3 });
});

test('reports auth, validation, and not-found failures with expected status codes', async () => {
  const api = new HqoMockApi({ database: new FixtureDatabase(), latency: false, random: () => 0.9 });
  const unauthorized = await api.fetch(request('/v1/players', { apiKey: null }));
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).error.code, 'unauthorized');
  assert.equal((await api.fetch(request('/v1/players?limit=1000'))).status, 400);
  assert.equal((await api.fetch(request('/v1/players/P999999'))).status, 404);
  const invalidEvent = await api.fetch(request('/v1/events/validate', {
    method: 'POST',
    body: { event: 'boss_fight', player_id: 'wrong', ts: 'bad', boss_id: 1, result: 'win' },
  }));
  assert.equal(invalidEvent.status, 422);
  assert.equal((await invalidEvent.json()).error.details.some(detail => detail.field === 'ts'), true);
});

test('returns a reproducible 500 once for a request signature, then allows retry', async () => {
  const api = new HqoMockApi({ database: new FixtureDatabase(), latency: false, random: () => 0 });
  const first = await api.fetch(request('/v1/players/P000001'));
  const retry = await api.fetch(request('/v1/players/P000001'));
  assert.equal(first.status, 500);
  assert.equal(retry.status, 200);
});

test('applies the sliding-window rate limit with Retry-After', async () => {
  let time = 0;
  const api = new HqoMockApi({
    database: new FixtureDatabase(),
    latency: false,
    random: () => 0.9,
    now: () => time,
    rateLimit: 1,
  });
  assert.equal((await api.fetch(request('/v1/players/P000001'))).status, 200);
  const limited = await api.fetch(request('/v1/players/P000002'));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '2');
  time = 10_001;
  assert.equal((await api.fetch(request('/v1/players/P000002'))).status, 200);
});

test('serves a Compendium snapshot when the real API is unavailable', async () => {
  const api = new HqoMockApi({
    database: new FixtureDatabase(),
    latency: false,
    snapshot: { entries: [{ id: 1, name: 'white-maned lynel', category: 'monsters' }] },
  });
  const result = await getCompendiumJson(
    'https://api.hyrule-compendium.com/v3/compendium/entry/white-maned_lynel',
    {
      fetchImpl: async () => { throw new TypeError('network unavailable'); },
    mirrorFetch: url => api.mirrorFetch(new URL(url)),
    },
  );
  assert.equal(result.source, 'local-mirror');
  assert.deepEqual(result.data.data, { id: 1, name: 'white-maned lynel', category: 'monsters' });
  const all = await api.mirrorFetch(new URL('https://api.hyrule-compendium.com/v3/compendium/all'));
  assert.equal(JSON.stringify(await all.json()).includes('"description"'), false);
});

test('preserves the source header when the mock API serves its local mirror', async () => {
  const result = await getCompendiumJson(
    'https://api.hyrule-compendium.com/v3/compendium/all',
    {
      fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
        headers: { 'Content-Type': 'application/json', 'X-Data-Source': 'local-mirror' },
      }),
      mirrorFetch: async () => new Response(JSON.stringify({ data: [] })),
    },
  );
  assert.equal(result.source, 'local-mirror');
});

test('routes reject unknown parameters and expose API key constant for lesson wiring', async () => {
  const api = new HqoMockApi({ database: new FixtureDatabase(), latency: false, random: () => 0.9 });
  const invalid = await api.fetch(request('/v1/players?unexpected=1'));
  assert.equal(invalid.status, 400);
  assert.equal(API_KEY, 'hqo_demo_key_2026');
});
