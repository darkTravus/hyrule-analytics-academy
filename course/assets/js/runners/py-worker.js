const PYODIDE_VERSION = '314.0.7';
const ALLOWED_PACKAGES = new Set([
  'numpy', 'pandas', 'scipy', 'matplotlib', 'statsmodels', 'scikit-learn',
]);

let pyodidePromise;
const proxyResponses = new Map();
let nextProxyId = 0;

function loadPyodideRuntime() {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = import(
    `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`
  ).then(({ loadPyodide }) => loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  }));
  return pyodidePromise;
}

function validateFiles(files) {
  if (!Array.isArray(files)) throw new TypeError('files must be an array');
  return files.map(file => {
    if (!file || typeof file.path !== 'string'
      || file.path.startsWith('/')
      || file.path.includes('..')
      || file.path.includes('\\')) {
      throw new TypeError('Each file needs a safe relative path');
    }
    if (typeof file.content !== 'string') throw new TypeError(`File content must be text: ${file.path}`);
    return file;
  });
}

function pythonLiteral(value) {
  return JSON.stringify(value);
}

function encodeBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

self.onmessage = async event => {
  if (event.data?.type === 'proxy-fetch-result') {
    const pending = proxyResponses.get(event.data.proxyId);
    if (!pending) return;
    proxyResponses.delete(event.data.proxyId);
    if (event.data.error) pending.reject(new Error(event.data.error));
    else pending.resolve(JSON.stringify(event.data.response));
    return;
  }
  const { id, type, code, tests = '', files = [], packages = [], answerExpression } = event.data ?? {};
  try {
    if (type !== 'run') throw new TypeError(`Unsupported worker message type: ${type}`);
    if (typeof code !== 'string' || typeof tests !== 'string') {
      throw new TypeError('Python code and tests must be strings');
    }
    if (answerExpression !== undefined && typeof answerExpression !== 'string') {
      throw new TypeError('answerExpression must be text');
    }
    const safeFiles = validateFiles(files);
    if (!Array.isArray(packages) || packages.some(name => !ALLOWED_PACKAGES.has(name))) {
      throw new TypeError('A requested Python package is not on the allowlist');
    }

    const pyodide = await loadPyodideRuntime();
    if (packages.length) await pyodide.loadPackage(packages);
    pyodide.registerJsModule('hqo_bridge', {
      fetch: (url, method, headersJson) => new Promise((resolve, reject) => {
        const proxyId = ++nextProxyId;
        proxyResponses.set(proxyId, { resolve, reject });
        self.postMessage({
          type: 'proxy-fetch',
          proxyId,
          url: String(url),
          init: { method: String(method), headers: JSON.parse(String(headersJson)) },
        });
      }),
    });
    const fileSetup = safeFiles.map(file => {
      const base64 = encodeBase64(new TextEncoder().encode(file.content));
      return `\n_path = Path('/data') / ${pythonLiteral(file.path)}\n_path.parent.mkdir(parents=True, exist_ok=True)\n_path.write_bytes(base64.b64decode(${pythonLiteral(base64)}))`;
    }).join('\n');
    const execution = `
import ast, base64, contextlib, inspect, io, json, os, sys, traceback
from pathlib import Path
_namespace = {'__name__': '__main__'}
if ${event.data.enableFetchProxy ? 'True' : 'False'}:
    import asyncio
    import hqo_bridge
    class _HQOResponse:
        def __init__(self, value):
            self.status = value['status']
            self.headers = {key.title(): item for key, item in value['headers']}
            self._body = value['body']
        async def json(self):
            return json.loads(self._body)
    async def _hqo_request(url, method='GET', headers=None):
        response = await hqo_bridge.fetch(str(url), str(method), json.dumps(headers or {}))
        return _HQOResponse(json.loads(response))
    async def get_json(url):
        response = await _hqo_request(url)
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f'La requête a échoué avec le statut HTTP {response.status}.')
        return await response.json()
    _namespace['_hqo_request'] = _hqo_request
    _namespace['get_json'] = get_json
    sys.path.insert(0, '/data/lib')
${fileSetup}
_stdout = io.StringIO()
_stderr = io.StringIO()
_figure_data = []
try:
    with contextlib.redirect_stdout(_stdout), contextlib.redirect_stderr(_stderr):
        _student_execution = eval(compile(${pythonLiteral(code)}, '<student-code>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT, dont_inherit=True), _namespace)
        if inspect.isawaitable(_student_execution):
            await _student_execution
        _test_execution = eval(compile(${pythonLiteral(tests)}, '<exercise-tests>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT, dont_inherit=True), _namespace)
        if inspect.isawaitable(_test_execution):
            await _test_execution
    _answer = eval(compile(${pythonLiteral(answerExpression ?? 'None')}, '<exercise-answer>', 'eval'), _namespace)
    try:
        import matplotlib.pyplot as _plt
        for _number in _plt.get_fignums():
            _buffer = io.BytesIO()
            _plt.figure(_number).savefig(_buffer, format='png', bbox_inches='tight')
            _figure_data.append(base64.b64encode(_buffer.getvalue()).decode('ascii'))
        _plt.close('all')
    except ImportError:
        pass
    _result_json = json.dumps({'ok': True, 'answer': _answer, 'stdout': _stdout.getvalue(), 'stderr': _stderr.getvalue(), 'figures': _figure_data}, default=str)
except BaseException as _error:
    _result_json = json.dumps({'ok': False, 'stdout': _stdout.getvalue(), 'stderr': _stderr.getvalue(), 'error': str(_error), 'traceback': traceback.format_exc(), 'figures': _figure_data})
`;
    await pyodide.runPythonAsync(execution);
    const output = JSON.parse(pyodide.runPython('_result_json'));
    self.postMessage({ id, ok: true, result: output });
  } catch (error) {
    self.postMessage({ id, ok: false, error: `${error.name}: ${error.message}` });
  }
};
