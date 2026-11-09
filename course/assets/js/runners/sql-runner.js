const SQLJS_VERSION = '1.13.0';
const MAX_ROWS = 200;
export const DEFAULT_SQL_TIMEOUT_MS = 10_000;
const BLOCKED_WORDS = new Set([
  'ALTER', 'ANALYZE', 'ATTACH', 'BEGIN', 'COMMIT', 'CREATE', 'DELETE', 'DETACH',
  'DROP', 'INSERT', 'LOAD_EXTENSION', 'PRAGMA', 'REINDEX', 'RELEASE',
  'REPLACE', 'ROLLBACK', 'SAVEPOINT', 'UPDATE', 'VACUUM',
]);

function sqlTokens(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (/\s/.test(char)) {
      index++;
    } else if (char === '-' && next === '-') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index++;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new TypeError('Commentaire SQL non terminé.');
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
      if (!closed) throw new TypeError('Chaîne ou identifiant SQL non terminé.');
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

export function validateReadOnlyQuery(query) {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new TypeError('Saisis une requête SQL.');
  }
  const tokens = sqlTokens(query);
  const meaningful = tokens.filter(token => token.type !== 'semicolon');
  if (!meaningful.length || !['SELECT', 'WITH'].includes(meaningful[0].value)) {
    throw new TypeError('Seules les requêtes SELECT et WITH sont autorisées.');
  }
  if (tokens.some(token => token.type === 'word' && BLOCKED_WORDS.has(token.value))) {
    throw new TypeError('Cette requête contient une commande interdite en lecture seule.');
  }
  const semicolons = tokens.filter(token => token.type === 'semicolon');
  if (semicolons.length > 1 || (semicolons.length === 1 && tokens.at(-1)?.type !== 'semicolon')) {
    throw new TypeError('Une seule requête SQL est acceptée à la fois.');
  }
  return query.trim().replace(/;$/, '');
}

export class SqlRunner {
  #databaseBytes;
  #workerUrl;
  #timeoutMs;
  #workerFactory;
  #worker;
  #ready;
  #nextId = 0;
  #pending = new Map();

  constructor(databaseBytes, {
    workerUrl = new URL('./sql-worker.js', import.meta.url),
    timeoutMs = DEFAULT_SQL_TIMEOUT_MS,
    workerFactory = url => new Worker(url),
  } = {}) {
    if (!(databaseBytes instanceof Uint8Array) && !(databaseBytes instanceof ArrayBuffer)) {
      throw new TypeError('Database must be provided as bytes.');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be positive');
    this.#databaseBytes = databaseBytes instanceof Uint8Array
      ? new Uint8Array(databaseBytes)
      : new Uint8Array(databaseBytes.slice(0));
    this.#workerUrl = workerUrl;
    this.#timeoutMs = timeoutMs;
    this.#workerFactory = workerFactory;
    this.#startWorker();
  }

  #startWorker() {
    this.#worker = this.#workerFactory(this.#workerUrl);
    this.#ready = new Promise((resolve, reject) => {
      const onMessage = event => {
        const message = event.data;
        if (message?.type === 'ready') {
          resolve();
          return;
        }
        if (message?.type === 'init-error') {
          reject(new Error(message.error));
          return;
        }
        const pending = this.#pending.get(message?.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.#pending.delete(message.id);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error));
      };
      this.#worker.addEventListener('message', onMessage);
      this.#worker.addEventListener('error', event => {
        const error = new Error(event.message || 'Le worker SQL a rencontré une erreur.');
        reject(error);
        this.#rejectPending(error);
        this.#worker.terminate();
        this.#startWorker();
      });
      const bytes = this.#databaseBytes.slice();
      this.#worker.postMessage({ type: 'init', database: bytes.buffer }, [bytes.buffer]);
    });
  }

  #rejectPending(error) {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #restartWorker(error) {
    this.#worker.terminate();
    this.#rejectPending(error);
    this.#startWorker();
  }

  static async fromUrl(databaseUrl, { fetchImpl = globalThis.fetch, ...options } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable.');
    const response = await fetchImpl(databaseUrl);
    if (!response.ok) throw new Error(`Impossible de charger la base SQL (${response.status}).`);
    return new SqlRunner(await response.arrayBuffer(), options);
  }

  async execute(query, { params, maxRows = MAX_ROWS, includeQueryPlan = true } = {}) {
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 500) {
      throw new TypeError('maxRows must be an integer between 1 and 500');
    }
    const sql = validateReadOnlyQuery(query);
    await this.#ready;
    const id = ++this.#nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`Exécution SQL arrêtée après ${this.#timeoutMs} ms.`);
        this.#restartWorker(error);
      }, this.#timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#worker.postMessage({
        type: 'execute',
        id,
        query: sql,
        params,
        maxRows,
        includeQueryPlan,
      });
    });
  }

  dispose() {
    this.#worker.terminate();
    this.#rejectPending(new Error('Runner SQL fermé.'));
  }

  reset() {
    this.#worker.terminate();
    this.#rejectPending(new Error('Runner SQL réinitialisé.'));
    this.#startWorker();
  }
}

export async function createSqlRunner(databaseUrl, options) {
  return SqlRunner.fromUrl(databaseUrl, options);
}

export { MAX_ROWS, SQLJS_VERSION };
