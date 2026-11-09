export const DEFAULT_TIMEOUT_MS = 20_000;
export const PYODIDE_VERSION = '314.0.7';

export class PythonRunner {
  #workerUrl;
  #timeoutMs;
  #worker;
  #workerFactory;
  #usesNativeWorker;
  #fetchProxy;
  #defaultFiles;
  #nextId = 0;
  #pending = new Map();

  constructor({
    workerUrl = new URL('./py-worker.js', import.meta.url),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    workerFactory,
    fetchProxy,
    defaultFiles = [],
  } = {}) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be positive');
    this.#workerUrl = workerUrl;
    this.#timeoutMs = timeoutMs;
    this.#usesNativeWorker = workerFactory === undefined;
    this.#workerFactory = workerFactory ?? (url => new Worker(url, { type: 'module' }));
    if (fetchProxy !== undefined && typeof fetchProxy !== 'function') throw new TypeError('fetchProxy must be a function');
    if (!Array.isArray(defaultFiles)) throw new TypeError('defaultFiles must be an array');
    this.#fetchProxy = fetchProxy;
    this.#defaultFiles = defaultFiles.map(file => ({ ...file }));
    this.#startWorker();
  }

  #startWorker() {
    if (this.#usesNativeWorker && typeof Worker !== 'function') {
      throw new Error('Web Workers are unavailable in this browser.');
    }
    if (typeof this.#workerFactory !== 'function') throw new TypeError('workerFactory must be a function');
    this.#worker = this.#workerFactory(this.#workerUrl);
    this.#worker.addEventListener('message', event => {
      if (event.data?.type === 'proxy-fetch') {
        void this.#proxyFetch(event.data);
        return;
      }
      const pending = this.#pending.get(event.data?.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.#pending.delete(event.data.id);
      if (event.data.ok) pending.resolve(event.data.result);
      else pending.reject(new Error(event.data.error));
    });
    this.#worker.addEventListener('error', event => {
      const error = new Error(event.message || 'Le worker Python a rencontré une erreur.');
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.#pending.clear();
      this.#worker.terminate();
      this.#startWorker();
    });
  }

  async #proxyFetch(message) {
    try {
      if (!this.#fetchProxy) throw new Error('No browser fetch proxy is configured.');
      const response = await this.#fetchProxy(message.url, message.init);
      this.#worker.postMessage({
        type: 'proxy-fetch-result',
        proxyId: message.proxyId,
        response: {
          status: response.status,
          headers: [...response.headers.entries()],
          body: await response.text(),
        },
      });
    } catch (error) {
      this.#worker.postMessage({
        type: 'proxy-fetch-result',
        proxyId: message.proxyId,
        error: `${error.name}: ${error.message}`,
      });
    }
  }

  run({ code, tests = '', files = [], packages = [], answerExpression }) {
    if (typeof code !== 'string') return Promise.reject(new TypeError('code must be text'));
    if (answerExpression !== undefined && typeof answerExpression !== 'string') {
      return Promise.reject(new TypeError('answerExpression must be text'));
    }
    const id = ++this.#nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        this.#worker.terminate();
        reject(new Error(`Exécution arrêtée après ${this.#timeoutMs} ms.`));
        this.#startWorker();
      }, this.#timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      const suppliedPaths = new Set(files.map(file => file?.path));
      const mergedFiles = [
        ...this.#defaultFiles.filter(file => !suppliedPaths.has(file.path)),
        ...files,
      ];
      this.#worker.postMessage({
        id,
        type: 'run',
        code,
        tests,
        files: mergedFiles,
        packages,
        answerExpression,
        enableFetchProxy: Boolean(this.#fetchProxy),
      });
    });
  }

  reset() {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Environnement Python réinitialisé.'));
    }
    this.#pending.clear();
    this.#worker.terminate();
    this.#startWorker();
  }

  dispose() {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Runner Python fermé.'));
    }
    this.#pending.clear();
    this.#worker.terminate();
  }
}
