const SQLJS_VERSION = '1.13.0';
const SQLJS_SCRIPT = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/sql-wasm.js`;
const SQLJS_WASM = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/sql-wasm.wasm`;
const BLOCKED_WORDS = new Set([
  'ALTER', 'ANALYZE', 'ATTACH', 'BEGIN', 'COMMIT', 'CREATE', 'DELETE', 'DETACH',
  'DROP', 'INSERT', 'LOAD_EXTENSION', 'PRAGMA', 'REINDEX', 'RELEASE', 'REPLACE',
  'ROLLBACK', 'SAVEPOINT', 'UPDATE', 'VACUUM',
]);

let SQL;
let databaseBytes;

function sqlTokens(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (/\s/.test(char)) index++;
    else if (char === '-' && next === '-') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index++;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new Error('Commentaire SQL non terminé.');
      index = end + 2;
    } else if (char === '\'' || char === '"' || char === '`' || char === '[') {
      const close = char === '[' ? ']' : char;
      index++;
      let closed = false;
      while (index < source.length) {
        if (source[index] === close) {
          if (source[index + 1] === close && close !== ']') {
            index += 2;
            continue;
          }
          index++;
          closed = true;
          break;
        }
        index++;
      }
      if (!closed) throw new Error('Chaîne ou identifiant SQL non terminé.');
      tokens.push({ type: 'quoted' });
    } else if (char === ';') {
      tokens.push({ type: 'semicolon' });
      index++;
    } else if (/[A-Za-z_]/.test(char)) {
      const start = index++;
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index])) index++;
      tokens.push({ type: 'word', value: source.slice(start, index).toUpperCase() });
    } else {
      tokens.push({ type: 'symbol', value: char });
      index++;
    }
  }
  return tokens;
}

function assertReadOnly(query) {
  const tokens = sqlTokens(query);
  const meaningful = tokens.filter(token => token.type !== 'semicolon');
  if (!meaningful.length || !['SELECT', 'WITH'].includes(meaningful[0].value)) {
    throw new Error('Seules les requêtes SELECT et WITH sont autorisées.');
  }
  if (tokens.some(token => token.type === 'word' && BLOCKED_WORDS.has(token.value))) {
    throw new Error('Cette requête contient une commande interdite en lecture seule.');
  }
  const semicolons = tokens.filter(token => token.type === 'semicolon');
  if (semicolons.length > 1 || (semicolons.length === 1 && tokens.at(-1)?.type !== 'semicolon')) {
    throw new Error('Une seule requête SQL est acceptée à la fois.');
  }
}

function runStatement(database, query, params, limit) {
  const statement = database.prepare(query);
  try {
    if (params !== undefined) statement.bind(params);
    const columns = statement.getColumnNames();
    const rows = [];
    while (rows.length <= limit && statement.step()) rows.push(statement.get());
    const truncated = rows.length > limit;
    if (truncated) rows.pop();
    return { columns, rows, truncated };
  } finally {
    statement.free();
  }
}

function execute(query, params, maxRows, includeQueryPlan) {
  assertReadOnly(query);
  const started = performance.now();
  const database = new SQL.Database(databaseBytes);
  try {
    database.exec('PRAGMA query_only = ON');
    const result = runStatement(database, query, params, maxRows);
    const plan = includeQueryPlan
      ? runStatement(database, `EXPLAIN QUERY PLAN ${query}`, params, 200)
      : { rows: [] };
    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rows.length,
      truncated: result.truncated,
      queryPlan: plan.rows,
      elapsedMs: performance.now() - started,
    };
  } finally {
    database.close();
  }
}

self.onmessage = async event => {
  const message = event.data ?? {};
  try {
    if (message.type === 'init') {
      if (!(message.database instanceof ArrayBuffer)) throw new TypeError('Database bytes are required.');
      databaseBytes = new Uint8Array(message.database);
      importScripts(SQLJS_SCRIPT);
      SQL = await self.initSqlJs({ locateFile: () => SQLJS_WASM });
      self.postMessage({ type: 'ready' });
      return;
    }
    if (message.type !== 'execute' || !SQL || !databaseBytes) {
      throw new Error('SQL worker is not initialized.');
    }
    const result = execute(message.query, message.params, message.maxRows, message.includeQueryPlan);
    self.postMessage({ id: message.id, ok: true, result });
  } catch (error) {
    self.postMessage({
      ...(message.id === undefined ? { type: 'init-error' } : { id: message.id, ok: false }),
      error: `${error.name}: ${error.message}`,
    });
  }
};
