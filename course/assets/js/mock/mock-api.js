import { ApiProblem, HqoRoutes, errorResponse } from './routes.js';

const API_ORIGIN = 'https://api.hqo-studio.test';
const COMPENDIUM_HOSTS = new Set(['api.hyrule-compendium.com', 'botw-compendium.herokuapp.com']);
const DEFAULT_RATE_WINDOW_MS = 10_000;
const DEFAULT_RATE_LIMIT = 10;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function requestSignature(method, url, body) {
  return `${method}\n${url.pathname}${url.search}\n${body}`;
}

function asResponse(response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export class HqoMockApi {
  #routes;
  #now;
  #sleep;
  #random;
  #latency;
  #rateLimit;
  #rateWindowMs;
  #requests = [];
  #failedSignatures = new Set();
  #sequence = 0;
  #snapshot;
  #originalFetch;

  constructor({
    database,
    snapshot = null,
    now = () => Date.now(),
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    random = Math.random,
    latency = true,
    rateLimit = DEFAULT_RATE_LIMIT,
    rateWindowMs = DEFAULT_RATE_WINDOW_MS,
    seed = 20261104,
  }) {
    this.#routes = new HqoRoutes(database, { now: () => new Date(now()) });
    this.#snapshot = snapshot;
    this.#originalFetch = globalThis.fetch.bind(globalThis);
    this.#now = now;
    this.#sleep = sleep;
    this.#random = random === Math.random ? mulberry32(seed) : random;
    this.#latency = latency;
    this.#rateLimit = rateLimit;
    this.#rateWindowMs = rateWindowMs;
  }

  async fetch(input, init = {}) {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (COMPENDIUM_HOSTS.has(url.hostname)) {
      try {
        const remote = await this.#originalFetch(input, init);
        if (remote.ok || remote.status < 500) return remote;
      } catch {
        return this.mirrorFetch(url);
      }
      return this.mirrorFetch(url);
    }
    if (url.origin !== API_ORIGIN) return this.#originalFetch(input, init);

    const requestId = `req_${String(++this.#sequence).padStart(6, '0')}`;
    let bodyText = '';
    if (request.method.toUpperCase() !== 'GET' && request.method.toUpperCase() !== 'HEAD') {
      bodyText = await request.clone().text();
    }
    const signature = requestSignature(request.method.toUpperCase(), url, bodyText);
    const requestTime = this.#now();
    this.#requests = this.#requests.filter(time => requestTime - time < this.#rateWindowMs);
    if (url.pathname !== '/v1/status') {
      this.#requests.push(requestTime);
      if (this.#requests.length > this.#rateLimit) {
        return errorResponse(new ApiProblem(429, 'rate_limited', 'Trop de requêtes'), requestId);
      }
    }

    if (this.#latency) await this.#sleep(80 + Math.floor(this.#random() * 171));
    if (url.pathname !== '/v1/status'
      && !this.#failedSignatures.has(signature)
      && this.#random() < 0.02) {
      this.#failedSignatures.add(signature);
      return errorResponse(new ApiProblem(500, 'internal_error', 'Erreur interne du serveur simulé.'), requestId);
    }

    try {
      return await this.#routes.handle(request, url);
    } catch (error) {
      return errorResponse(error, requestId);
    }
  }

  mirrorFetch(input) {
    const url = input instanceof URL ? input : new URL(input);
    if (!this.#snapshot || !Array.isArray(this.#snapshot.entries)) {
      return errorResponse(new ApiProblem(503, 'mirror_unavailable', 'Miroir Compendium indisponible.'),
        `req_${String(++this.#sequence).padStart(6, '0')}`);
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const compendiumIndex = segments.indexOf('compendium');
    const legacyEntryIndex = segments.indexOf('entry');
    const actionIndex = compendiumIndex >= 0 ? compendiumIndex + 1 : legacyEntryIndex;
    const action = segments[actionIndex];
    let data;
    if (action === 'all') {
      data = this.#snapshot.entries;
    } else if (action === 'category') {
      const category = segments[actionIndex + 1];
      data = this.#snapshot.entries.filter(entry => entry.category === category);
    } else if (action === 'entry') {
      const entryName = decodeURIComponent(segments[actionIndex + 1] ?? '').replace(/_/g, ' ').toLowerCase();
      const sourceEntry = this.#snapshot.entries.find(item => item.name.toLowerCase() === entryName);
      const entry = sourceEntry && this.#publicCompendiumEntry(sourceEntry);
      if (!entry) {
        return errorResponse(new ApiProblem(404, 'not_found', 'Entrée introuvable.'),
          `req_${String(++this.#sequence).padStart(6, '0')}`);
      }
      data = entry;
    } else {
      return errorResponse(new ApiProblem(404, 'not_found', 'Route Compendium non prise en charge.'),
        `req_${String(++this.#sequence).padStart(6, '0')}`);
    }
    if (Array.isArray(data)) data = data.map(entry => this.#publicCompendiumEntry(entry));
    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Data-Source': 'local-mirror' },
    });
  }

  #publicCompendiumEntry(entry) {
    const { description, image, ...structuredFields } = entry;
    return structuredFields;
  }
}

export function installMockApi(options) {
  const api = new HqoMockApi(options);
  const originalFetch = globalThis.fetch;
  const installedFetch = api.fetch.bind(api);
  globalThis.fetch = installedFetch;
  return {
    api,
    restore() {
      if (globalThis.fetch === installedFetch) globalThis.fetch = originalFetch;
    },
  };
}

export async function getCompendiumJson(url, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
  mirrorFetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable.');
  if (typeof mirrorFetch !== 'function') throw new TypeError('A local mirror fetch function is required.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (response.ok) {
      return {
        data: await response.json(),
        source: response.headers.get('X-Data-Source') === 'local-mirror' ? 'local-mirror' : 'remote',
      };
    }
    if (response.status < 500) throw new Error(`Compendium API returned HTTP ${response.status}.`);
    throw new Error(`Compendium API returned HTTP ${response.status}.`);
  } catch (error) {
    if (!(error instanceof TypeError) && error.name !== 'AbortError' && !/^Compendium API returned HTTP 5/.test(error.message)) {
      throw error;
    }
    const fallback = await mirrorFetch(url);
    if (!fallback.ok) throw new Error(`Compendium indisponible et miroir local en échec (${fallback.status}).`, { cause: error });
    return { data: await fallback.json(), source: 'local-mirror' };
  } finally {
    clearTimeout(timeout);
  }
}

export { API_ORIGIN };
