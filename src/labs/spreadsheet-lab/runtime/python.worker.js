// Runs Python cells with Pyodide (Python compiled for the browser), in a worker
// so a long calculation cannot freeze the page. Each cell runs in a fresh
// namespace: like a formula, its value depends only on the cells it reads.
import { createPyodide } from '../../../utils/pyodideRuntime.js'

let ready = null

const PRELUDE = `
import ast, json, math, sys, traceback, base64, io, datetime

def _ss_plain(v, depth=0):
    """A Python value as plain JSON data the sheet understands."""
    if v is None or isinstance(v, (bool, str)):
        return v
    if isinstance(v, (int, float)):
        return v if math.isfinite(v) else {'error': '#NUM!'}
    if depth > 4:
        return repr(v)
    mod = type(v).__module__ or ''
    if mod.startswith('pandas'):
        name = type(v).__name__
        if name == 'DataFrame':
            frame = v if type(v.index).__name__ == 'RangeIndex' else v.reset_index()
            return {'__table__': True, 'columns': [str(c) for c in frame.columns], 'rows': [[_ss_plain(x, depth + 1) for x in row] for row in frame.itertuples(index=False)]}
        if name == 'Series':
            return [_ss_plain(x, depth + 1) for x in v.tolist()]
        if name == 'Timestamp':
            return v.isoformat()
    if hasattr(v, 'tolist') and mod.startswith('numpy'):
        return _ss_plain(v.tolist(), depth)
    if isinstance(v, (list, tuple, range, set)):
        return [_ss_plain(x, depth + 1) for x in v]
    if isinstance(v, dict):
        return {str(k): _ss_plain(x, depth + 1) for k, x in v.items()}
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    if type(v).__name__ == 'Figure':
        return None  # shown below the code instead
    return repr(v)

def _ss_figures():
    if 'matplotlib.pyplot' not in sys.modules:
        return []
    import matplotlib.pyplot as plt
    out = []
    for n in plt.get_fignums()[:6]:
        buf = io.BytesIO()
        plt.figure(n).savefig(buf, format='png', bbox_inches='tight', dpi=110)
        out.append(base64.b64encode(buf.getvalue()).decode())
    plt.close('all')
    return out

def _ss_run(code, inputs_json):
    inputs = json.loads(inputs_json)
    def xl(ref, headers=False):
        """The value of a cell or range on the sheet. With headers=True a range
        becomes a pandas DataFrame whose column names are its first row."""
        if ref not in inputs:
            raise KeyError(f'xl("{ref}") can only read an address written directly in quotes, such as xl("A1:B5").')
        v = inputs[ref]
        if headers:
            import pandas as pd
            rows = v if v and isinstance(v[0], list) else [[x] for x in v]
            return pd.DataFrame(rows[1:], columns=rows[0])
        return v
    ns = {'xl': xl, '__name__': '__main__'}
    try:
        tree = ast.parse(code, '<cell>', 'exec')
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, '<cell>', 'exec'), ns)
        value = eval(compile(last, '<cell>', 'eval'), ns) if last is not None else None
        return json.dumps({'value': _ss_plain(value), 'figures': _ss_figures(), 'noValue': last is None})
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == '<cell>']
        text = ''.join(traceback.format_list(frames)) + ''.join(traceback.format_exception_only(type(e), e))
        line = f' (line {frames[-1].lineno})' if frames else ''
        return json.dumps({'error': '#CODE!', 'detail': f'{type(e).__name__}: {e}{line}', 'traceback': text, 'figures': _ss_figures()})
`

function start() {
  ready ??= (async () => {
    self.postMessage({ type: 'status', state: 'loading', text: 'Starting Python (the first time downloads about 10 MB)…' })
    const py = await createPyodide({ fullStdLib: false })
    py.runPython(PRELUDE)
    self.postMessage({ type: 'status', state: 'ready', text: 'Python ready.' })
    return py
  })()
  return ready
}

self.onmessage = async ({ data }) => {
  let py
  try {
    py = await start()
  } catch (e) {
    ready = null
    self.postMessage({ job: data.job, error: '#CODE!', detail: 'Python could not start: ' + (e?.message ?? e) + ' Check your connection and edit the cell to try again.' })
    return
  }
  const out = []
  py.setStdout({ batched: (s) => { if (out.join('\n').length < 20000) out.push(s) } })
  py.setStderr({ batched: (s) => out.push(s) })
  try {
    // Libraries named in import statements (numpy, pandas, matplotlib…) are downloaded on first use.
    const imports = data.source + (/headers\s*=\s*True/.test(data.source) ? '\nimport pandas' : '')
    self.postMessage({ type: 'status', state: 'running', text: 'Running Python…' })
    await py.loadPackagesFromImports(imports)
    const started = performance.now()
    const result = JSON.parse(py.globals.get('_ss_run')(data.source, JSON.stringify(data.inputs)))
    if (result.noValue && !result.error) out.push('(The last line is not an expression, so the cell is empty. End with the value to show, for example total.)')
    self.postMessage({ job: data.job, ...result, stdout: out.join('\n'), ms: performance.now() - started })
  } catch (e) {
    self.postMessage({ job: data.job, error: '#CODE!', detail: String(e?.message ?? e), stdout: out.join('\n') })
  } finally {
    self.postMessage({ type: 'status', state: 'ready', text: 'Python ready.' })
  }
}
