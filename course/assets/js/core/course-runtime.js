import { API_ORIGIN as HQO_API_ORIGIN, getCompendiumJson, installMockApi } from '../mock/mock-api.js';
import { PythonRunner } from '../runners/py-runner.js';
import { SqlRunner } from '../runners/sql-runner.js';

async function fetchResource(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Impossible de charger ${url} (HTTP ${response.status}).`);
  return response;
}

export async function createCourseRuntime({
  fetchImpl = globalThis.fetch,
  databaseUrl = new URL('../../../data/hqo_lite.sqlite', import.meta.url),
  snapshotUrl = new URL('../../../data/compendium/compendium_snapshot.json', import.meta.url),
  clientUrl = new URL('../mock/hqo_client.py', import.meta.url),
  mockOptions = {},
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Fetch API is unavailable.');
  const [databaseResponse, snapshotResponse, clientResponse] = await Promise.all([
    fetchResource(databaseUrl, fetchImpl),
    fetchResource(snapshotUrl, fetchImpl),
    fetchResource(clientUrl, fetchImpl),
  ]);
  const [databaseBytes, snapshot, clientSource] = await Promise.all([
    databaseResponse.arrayBuffer(),
    snapshotResponse.json(),
    clientResponse.text(),
  ]);
  const sql = new SqlRunner(databaseBytes);
  const mock = installMockApi({ ...mockOptions, database: sql, snapshot });
  let disposed = false;

  function createPythonFetchProxy(url, init) {
    const target = new URL(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const isHqoApi = target.origin === HQO_API_ORIGIN && ['GET', 'POST'].includes(method);
    const isCompendium = target.protocol === 'https:'
      && ['api.hyrule-compendium.com', 'botw-compendium.herokuapp.com'].includes(target.hostname)
      && method === 'GET';
    if (!isHqoApi && !isCompendium) {
      throw new TypeError('Python network access is limited to the course API and Compendium.');
    }
    return mock.api.fetch(target, init);
  }

  function assertOpen() {
    if (disposed) throw new Error('Course runtime has been disposed.');
  }

  return {
    sql,
    api: mock.api,
    async getCompendiumJson(url, options = {}) {
      assertOpen();
      const target = new URL(url);
      if (target.protocol !== 'https:'
        || !['api.hyrule-compendium.com', 'botw-compendium.herokuapp.com'].includes(target.hostname)) {
        throw new TypeError('Only the configured Compendium API can be queried here.');
      }
      return getCompendiumJson(url, {
        ...options,
        fetchImpl: options.fetchImpl ?? globalThis.fetch,
        mirrorFetch: options.mirrorFetch ?? (input => mock.api.mirrorFetch(new URL(input))),
      });
    },
    createPythonRunner(options = {}) {
      assertOpen();
      if (options.fetchProxy !== undefined || options.defaultFiles !== undefined) {
        throw new TypeError('Course runtime owns the Python runner fetch proxy and shared client file.');
      }
      return new PythonRunner({
        ...options,
        fetchProxy: createPythonFetchProxy,
        defaultFiles: [{ path: 'lib/hqo_client.py', content: clientSource }],
      });
    },
    async apiFetch(input, init) {
      assertOpen();
      const target = new URL(input);
      if (target.origin !== HQO_API_ORIGIN) throw new TypeError('Only the course API can be queried here.');
      return mock.api.fetch(target, init);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mock.restore();
      sql.dispose();
    },
  };
}
