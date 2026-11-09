const API_KEY = 'hqo_demo_key_2026';
const PAGE_SIZE_DEFAULT = 100;
const PAGE_SIZE_MAX = 500;
const CURSOR_PREFIX = 'c_';
const EVENT_NAMES = new Set(['session_start', 'session_end', 'quest_complete', 'boss_fight', 'purchase']);
const TABLES = new Set([
  'players', 'sessions', 'regions', 'quests', 'bosses', 'patches', 'shop_items',
  'orders', 'experiments', 'experiment_assignments', 'reviews',
]);

export class ApiProblem extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function validDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function parsePage(url) {
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? PAGE_SIZE_DEFAULT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_SIZE_MAX) {
    throw new ApiProblem(400, 'invalid_parameter', 'Le paramètre limit doit être compris entre 1 et 500.', [
      { field: 'limit', problem: 'valeur attendue entre 1 et 500' },
    ]);
  }
  const cursor = url.searchParams.get('cursor');
  let offset = 0;
  if (cursor !== null) {
    const match = /^c_(\d{1,12})$/.exec(cursor);
    if (!match || !Number.isSafeInteger(Number(match[1]))) {
      throw new ApiProblem(400, 'invalid_parameter', 'Le curseur est invalide.', [
        { field: 'cursor', problem: 'format de curseur invalide' },
      ]);
    }
    offset = Number(match[1]);
  }
  return { limit, offset };
}

function validateParams(url, allowed) {
  const accepted = new Set(['limit', 'cursor', ...allowed]);
  for (const key of url.searchParams.keys()) {
    if (!accepted.has(key)) {
      throw new ApiProblem(400, 'invalid_parameter', `Paramètre inconnu : ${key}.`, [
        { field: key, problem: 'paramètre non pris en charge' },
      ]);
    }
  }
}

function buildWhere(filters) {
  const clauses = [];
  const params = [];
  for (const filter of filters) {
    if (filter.value === null || filter.value === undefined || filter.value === '') continue;
    if (filter.validate && !filter.validate(filter.value)) {
      throw new ApiProblem(400, 'invalid_parameter', `Valeur invalide pour ${filter.name}.`, [
        { field: filter.name, problem: filter.problem ?? 'valeur invalide' },
      ]);
    }
    clauses.push(`${filter.column} ${filter.operator ?? '='} ?`);
    params.push(filter.convert ? filter.convert(filter.value) : filter.value);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function quotePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ApiProblem(400, 'invalid_parameter', 'Chemin URL mal formé.');
  }
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function validateEvent(body) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiProblem(422, 'invalid_event', 'Le corps doit être un objet JSON.', [
      { field: 'body', problem: 'objet JSON attendu' },
    ]);
  }
  if (!EVENT_NAMES.has(body.event)) details.push({ field: 'event', problem: 'type d’événement inconnu' });
  if (typeof body.player_id !== 'string' || !/^P\d{6}$/.test(body.player_id)) {
    details.push({ field: 'player_id', problem: 'format P suivi de 6 chiffres attendu' });
  }
  if (!isIsoTimestamp(body.ts)) details.push({ field: 'ts', problem: 'format ISO 8601 attendu' });

  const requiredByEvent = {
    session_start: ['session_id'],
    session_end: ['session_id'],
    quest_complete: ['quest_id'],
    boss_fight: ['boss_id', 'result'],
    purchase: ['order_id'],
  };
  for (const field of requiredByEvent[body.event] ?? []) {
    if (body[field] === undefined || body[field] === null) {
      details.push({ field, problem: 'champ obligatoire pour cet événement' });
    }
  }
  if (body.event === 'boss_fight' && body.result !== undefined && !['win', 'lose'].includes(body.result)) {
    details.push({ field: 'result', problem: 'valeur attendue : win ou lose' });
  }
  if (details.length) throw new ApiProblem(422, 'invalid_event', 'Événement invalide.', details);
}

function encodeCursor(offset) {
  return offset ? `${CURSOR_PREFIX}${String(offset).padStart(6, '0')}` : null;
}

export class HqoRoutes {
  constructor(database, { now = () => new Date() } = {}) {
    if (!database || typeof database.execute !== 'function') {
      throw new TypeError('A SQL runner instance is required.');
    }
    this.database = database;
    this.now = now;
  }

  async #query(sql, params = []) {
    const result = await this.database.execute(sql, { params, maxRows: PAGE_SIZE_MAX, includeQueryPlan: false });
    return result.rows.map(row => Object.fromEntries(result.columns.map((column, index) => [column, row[index]])));
  }

  async #tablePage(table, url, allowed, filters = [], orderBy = '1') {
    if (!TABLES.has(table)) throw new Error(`Unknown API table: ${table}`);
    validateParams(url, allowed);
    const { limit, offset } = parsePage(url);
    const where = buildWhere(filters);
    const total = (await this.#query(`SELECT COUNT(*) AS count FROM ${table} ${where.sql}`, where.params))[0].count;
    const rows = await this.#query(
      `SELECT * FROM ${table} ${where.sql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...where.params, limit, offset],
    );
    return response({
      data: rows,
      meta: {
        limit,
        next_cursor: offset + rows.length < total ? encodeCursor(offset + rows.length) : null,
        total,
      },
    });
  }

  async handle(request, url) {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method.toUpperCase();
    if (method === 'GET' && path === '/v1/status') {
      return response({ data: { status: 'ok', version: '1.4.0', server_time: '2026-07-01T00:00:00Z' } });
    }
    if (request.headers.get('X-API-Key') !== API_KEY) {
      throw new ApiProblem(401, 'unauthorized', 'Clé API absente ou invalide.');
    }

    if (method === 'GET' && path === '/v1/players') {
      return this.#tablePage('players', url, ['signup_from', 'signup_to', 'platform', 'channel'], [
        { name: 'signup_from', column: 'signup_date', operator: '>=', value: url.searchParams.get('signup_from'), validate: validDate, problem: 'date ISO attendue' },
        { name: 'signup_to', column: 'signup_date', operator: '<', value: url.searchParams.get('signup_to'), validate: validDate, problem: 'date ISO attendue' },
        { name: 'platform', column: 'platform', value: url.searchParams.get('platform') },
        { name: 'channel', column: 'acquisition_channel', value: url.searchParams.get('channel') },
      ], 'player_id');
    }
    const playerMatch = /^\/v1\/players\/([^/]+)(\/sessions)?$/.exec(path);
    if (method === 'GET' && playerMatch && !playerMatch[2]) {
      const playerId = quotePathSegment(playerMatch[1]);
      const player = (await this.#query('SELECT * FROM players WHERE player_id = ? LIMIT 1', [playerId]))[0];
      if (!player) throw new ApiProblem(404, 'not_found', 'Joueur introuvable.');
      return response({ data: player });
    }
    if (method === 'GET' && playerMatch?.[2]) {
      const playerId = quotePathSegment(playerMatch[1]);
      return this.#tablePage('sessions', url, ['from', 'to'], [
        { name: 'player_id', column: 'player_id', value: playerId },
        { name: 'from', column: 'start_ts', operator: '>=', value: url.searchParams.get('from'), validate: validDate },
        { name: 'to', column: 'start_ts', operator: '<', value: url.searchParams.get('to'), validate: validDate },
      ], 'session_id');
    }
    if (method === 'GET' && path === '/v1/sessions') {
      return this.#tablePage('sessions', url, ['from', 'to', 'region_id'], [
        { name: 'from', column: 'start_ts', operator: '>=', value: url.searchParams.get('from'), validate: validDate },
        { name: 'to', column: 'start_ts', operator: '<', value: url.searchParams.get('to'), validate: validDate },
        { name: 'region_id', column: 'region_id', value: url.searchParams.get('region_id'), validate: value => /^\d+$/.test(value), convert: Number },
      ], 'session_id');
    }
    const simpleLists = {
      '/v1/regions': ['regions', 'region_id'],
      '/v1/quests': ['quests', 'quest_id'],
      '/v1/bosses': ['bosses', 'boss_id'],
      '/v1/patches': ['patches', 'patch_id'],
      '/v1/experiments': ['experiments', 'experiment_id'],
    };
    if (method === 'GET' && simpleLists[path]) {
      const [table, orderBy] = simpleLists[path];
      if (path === '/v1/experiments') {
        const rows = await this.#query('SELECT * FROM experiments ORDER BY experiment_id');
        return response({ data: rows });
      }
      return this.#tablePage(table, url, [], [], orderBy);
    }
    if (method === 'GET' && path === '/v1/shop/items') {
      return this.#tablePage('shop_items', url, ['category'], [
        { name: 'category', column: 'category', value: url.searchParams.get('category') },
      ], 'item_id');
    }
    if (method === 'GET' && path === '/v1/orders') {
      validateParams(url, ['status', 'from', 'to']);
      const { limit, offset } = parsePage(url);
      const where = buildWhere([
        { name: 'status', column: 'status', value: url.searchParams.get('status') },
        { name: 'from', column: 'order_ts', operator: '>=', value: url.searchParams.get('from'), validate: validDate },
        { name: 'to', column: 'order_ts', operator: '<', value: url.searchParams.get('to'), validate: validDate },
      ]);
      const total = (await this.#query(`SELECT COUNT(*) AS count FROM orders ${where.sql}`, where.params))[0].count;
      const orders = await this.#query(
        `SELECT * FROM orders ${where.sql} ORDER BY order_id LIMIT ? OFFSET ?`,
        [...where.params, limit, offset],
      );
      if (orders.length) {
        const placeholders = orders.map(() => '?').join(', ');
        const lines = await this.#query(
          `SELECT * FROM order_lines WHERE order_id IN (${placeholders}) ORDER BY order_id, line_no`,
          orders.map(order => order.order_id),
        );
        const grouped = new Map(orders.map(order => [order.order_id, []]));
        for (const line of lines) grouped.get(line.order_id).push(line);
        for (const order of orders) order.lines = grouped.get(order.order_id);
      }
      return response({
        data: orders,
        meta: { limit, next_cursor: offset + orders.length < total ? encodeCursor(offset + orders.length) : null, total },
      });
    }
    const assignmentsMatch = /^\/v1\/experiments\/([^/]+)\/assignments$/.exec(path);
    if (method === 'GET' && assignmentsMatch) {
      const experimentId = quotePathSegment(assignmentsMatch[1]);
      return this.#tablePage('experiment_assignments', url, [], [
        { name: 'experiment_id', column: 'experiment_id', value: experimentId },
      ], 'player_id');
    }
    if (method === 'GET' && path === '/v1/reviews') {
      return this.#tablePage('reviews', url, ['lang', 'min_rating'], [
        { name: 'lang', column: 'lang', value: url.searchParams.get('lang') },
        { name: 'min_rating', column: 'rating', operator: '>=', value: url.searchParams.get('min_rating'), validate: value => /^[1-5]$/.test(value), convert: Number },
      ], 'review_id');
    }
    if (method === 'POST' && path === '/v1/events/validate') {
      let body;
      try {
        body = await request.json();
      } catch {
        throw new ApiProblem(400, 'invalid_json', 'Le corps doit contenir du JSON valide.');
      }
      validateEvent(body);
      return response({ data: { valid: true } });
    }
    throw new ApiProblem(404, 'not_found', 'Route introuvable.');
  }
}

export function errorResponse(error, requestId) {
  if (error instanceof ApiProblem) {
    return response({
      error: {
        code: error.code,
        message: error.message,
        request_id: requestId,
        ...(error.details ? { details: error.details } : {}),
      },
    }, error.status, error.status === 429 ? { 'Retry-After': '2' } : {});
  }
  return response({
    error: { code: 'internal_error', message: 'Erreur interne du serveur simulé.', request_id: requestId },
  }, 500);
}

export { API_KEY, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, validDate };
