// "This formula in code": a formula rewritten as Python, JavaScript and
// MATLAB, each ready to paste into a code cell. Where a language behaves
// differently from Excel (rounding, remainders of negative numbers…), a note
// says so, because those differences are worth learning.
//
// Only a core set of functions is translated; anything else is reported, not
// guessed.
import { formatRange, cellKey, quoteSheet } from './address.js'

export class Untranslatable extends Error {
  constructor(what) { super(what); this.what = what }
}

const LANGS = ['py', 'js', 'matlab']
// Marks a part with no equivalent in one language; anything built from it has
// none either, and that language reports ctx.missing[lang] instead of code.
const NONE = '\u0000none\u0000'
const same = (code, shape = 'scalar') => ({ py: code, js: code, matlab: code, shape })
const each = (fn, shape = 'scalar') => ({ ...Object.fromEntries(LANGS.map((l) => [l, fn(l)])), shape })

// Each argument becomes a single code fragment; lists and tables are flattened
// into one list when a function takes "number1, number2, …".
function flatList(args, lang) {
  if (args.length === 1 && args[0].shape === 'list') return args[0][lang]
  if (args.length === 1 && args[0].shape === 'table') {
    return { py: `[x for row in ${args[0].py} for x in row]`, js: `${args[0].js}.flat()`, matlab: `${args[0].matlab}(:)` }[lang]
  }
  const parts = args.map((a) => {
    if (a.shape === 'scalar') return a[lang]
    if (lang === 'py') return a.shape === 'list' ? `*${a.py}` : `*[x for row in ${a.py} for x in row]`
    if (lang === 'js') return a.shape === 'list' ? `...${a.js}` : `...${a.js}.flat()`
    // MATLAB ranges are variables (see 'range' below): a list is a column
    // already, and t(:) stacks a table's columns into one.
    return a.shape === 'list' ? a.matlab : `${a.matlab}(:)`
  })
  return lang === 'matlab' ? `[${parts.join('; ')}]` : `[${parts.join(', ')}]`
}

const anyList = (args) => args.some((a) => a.shape !== 'scalar')

// OpenMAT, the MATLAB engine in this app, keeps text as whole strings and has
// no functions yet for picking characters out of them.
const noText = (ctx, matlab) => { ctx.missing.matlab = 'OpenMAT, the MATLAB engine here, cannot pick characters out of text yet. In MATLAB itself this is ' + matlab + '.' }
// string(x) turns a number into text; a text literal needs nothing.
const asText = (a) => (a.text ? a.matlab : `string(${a.matlab})`)

// Aggregates: SUM(A1:A10, 5) and friends.
const aggregate = (py, js, matlab) => (args, ctx) => {
  const list = { py: flatList(args, 'py'), js: flatList(args, 'js'), matlab: flatList(args, 'matlab') }
  return { py: py(list.py, ctx), js: js(list.js), matlab: matlab(list.matlab), shape: 'scalar' }
}

const scalar1 = (py, js, matlab) => ([a], ctx) => {
  if (a.shape !== 'scalar') throw new Untranslatable('a whole range inside this function (it would need a loop)')
  return { py: py(a.py, ctx), js: js(a.js), matlab: matlab(a.matlab), shape: 'scalar' }
}

const FUNCTIONS = {
  SUM: aggregate((v) => `sum(${v})`, (v) => `${v}.reduce((a, b) => a + b, 0)`, (v) => `sum(${v})`),
  AVERAGE: aggregate((v, ctx) => { ctx.imports.add('statistics'); return `statistics.mean(${v})` }, (v) => `(${v}).reduce((a, b) => a + b, 0) / (${v}).length`, (v) => `mean(${v})`),
  MIN: aggregate((v) => `min(${v})`, (v) => `Math.min(...${v})`, (v) => `min(${v})`),
  MAX: aggregate((v) => `max(${v})`, (v) => `Math.max(...${v})`, (v) => `max(${v})`),
  MEDIAN: aggregate((v, ctx) => { ctx.imports.add('statistics'); return `statistics.median(${v})` }, (v) => `((s) => s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2)([...${v}].sort((a, b) => a - b))`, (v) => `median(${v})`),
  'STDEV.S': aggregate((v, ctx) => { ctx.imports.add('statistics'); return `statistics.stdev(${v})` }, (v) => `((v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) })(${v})`, (v) => `std(${v})`),
  'VAR.S': aggregate((v, ctx) => { ctx.imports.add('statistics'); return `statistics.variance(${v})` }, (v) => `((v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1) })(${v})`, (v) => `var(${v})`),
  PRODUCT: aggregate((v, ctx) => { ctx.imports.add('math'); return `math.prod(${v})` }, (v) => `${v}.reduce((a, b) => a * b, 1)`, (v) => `prod(${v})`),
  COUNT: (args, ctx) => {
    ctx.notes.add('COUNT counts only numbers, so the code keeps the numbers before counting.')
    // A MATLAB matrix holds only numbers or only text, so "the numbers among
    // these" only has a direct form when every argument is a numeric range.
    const ranges = args.every((a) => a.shape !== 'scalar')
    if (!ranges) ctx.missing.matlab = 'A MATLAB matrix cannot mix numbers and text, so COUNT over single values has no direct form. For a range of numbers, numel(data) counts them.'
    return aggregate((v) => `len([x for x in ${v} if isinstance(x, (int, float)) and not isinstance(x, bool)])`, (v) => `${v}.filter((x) => typeof x === 'number').length`, (v) => (ranges ? `numel(${v})` : NONE))(args, ctx)
  },
  ABS: scalar1((a) => `abs(${a})`, (a) => `Math.abs(${a})`, (a) => `abs(${a})`),
  SQRT: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.sqrt(${a})` }, (a) => `Math.sqrt(${a})`, (a) => `sqrt(${a})`),
  EXP: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.exp(${a})` }, (a) => `Math.exp(${a})`, (a) => `exp(${a})`),
  LN: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.log(${a})` }, (a) => `Math.log(${a})`, (a) => `log(${a})`),
  LOG10: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.log10(${a})` }, (a) => `Math.log10(${a})`, (a) => `log10(${a})`),
  INT: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.floor(${a})` }, (a) => `Math.floor(${a})`, (a) => `floor(${a})`),
  SIN: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.sin(${a})` }, (a) => `Math.sin(${a})`, (a) => `sin(${a})`),
  COS: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.cos(${a})` }, (a) => `Math.cos(${a})`, (a) => `cos(${a})`),
  TAN: scalar1((a, ctx) => { ctx.imports.add('math'); return `math.tan(${a})` }, (a) => `Math.tan(${a})`, (a) => `tan(${a})`),
  PI: (_, ctx) => { ctx.imports.add('math'); return { py: 'math.pi', js: 'Math.PI', matlab: 'pi', shape: 'scalar' } },
  POWER: ([a, b]) => ({ py: `(${a.py}) ** (${b.py})`, js: `(${a.js}) ** (${b.js})`, matlab: `(${a.matlab}) .^ (${b.matlab})`, shape: 'scalar' }),
  ROUND: ([a, d], ctx) => {
    ctx.notes.add('Rounding halves differs: Excel\'s ROUND(2.5, 0) is 3, but Python\'s round(2.5) is 2 (it rounds halves to the even number) and JavaScript\'s Math.round(-2.5) is -2 (halves go up).')
    const digits = d ?? same('0')
    return { py: `round(${a.py}, ${digits.py})`, js: `Math.round((${a.js}) * 10 ** (${digits.js})) / 10 ** (${digits.js})`, matlab: `round(${a.matlab}, ${digits.matlab})`, shape: 'scalar' }
  },
  MOD: ([a, b], ctx) => {
    ctx.notes.add('Remainders of negative numbers: Excel\'s MOD(-3, 2) is 1, like Python\'s -3 % 2 and MATLAB\'s mod(-3, 2), but JavaScript\'s -3 % 2 is -1, so the JavaScript adds b and takes the remainder again.')
    return { py: `(${a.py}) % (${b.py})`, js: `(((${a.js}) % (${b.js})) + (${b.js})) % (${b.js})`, matlab: `mod(${a.matlab}, ${b.matlab})`, shape: 'scalar' }
  },
  IF: ([c, a, b], ctx) => {
    ctx.missing.matlab = 'MATLAB has no "if" inside an expression. Write it as a block: if condition, result = a; else, result = b; end.'
    const no = b ?? same('false')
    return { py: `(${a.py} if ${c.py} else ${no.py})`, js: `(${c.js} ? ${a.js} : ${no.js})`, matlab: NONE, shape: 'scalar' }
  },
  AND: (args) => ({ py: '(' + args.map((a) => a.py).join(' and ') + ')', js: '(' + args.map((a) => a.js).join(' && ') + ')', matlab: '(' + args.map((a) => a.matlab).join(' && ') + ')', shape: 'scalar' }),
  OR: (args) => ({ py: '(' + args.map((a) => a.py).join(' or ') + ')', js: '(' + args.map((a) => a.js).join(' || ') + ')', matlab: '(' + args.map((a) => a.matlab).join(' || ') + ')', shape: 'scalar' }),
  NOT: scalar1((a) => `(not ${a})`, (a) => `!(${a})`, (a) => `~(${a})`),
  LEN: (args, ctx) => { noText(ctx, 'strlength(t)'); return scalar1((a) => `len(str(${a}))`, (a) => `String(${a}).length`, () => NONE)(args, ctx) },
  UPPER: scalar1((a) => `str(${a}).upper()`, (a) => `String(${a}).toUpperCase()`, (a) => `upper(${a})`),
  LOWER: scalar1((a) => `str(${a}).lower()`, (a) => `String(${a}).toLowerCase()`, (a) => `lower(${a})`),
  TRIM: (args, ctx) => {
    ctx.notes.add('Excel\'s TRIM also turns runs of spaces inside the text into single spaces. strip() and strtrim only remove spaces at the ends, so the code does the inside as well.')
    return scalar1((a) => `" ".join(str(${a}).split())`, (a) => `String(${a}).trim().replace(/\\s+/g, " ")`, (a) => `regexprep(strtrim(${a}), " +", " ")`)(args, ctx)
  },
  LEFT: ([t, n], ctx) => { noText(ctx, 'extractBefore(t, n + 1)'); const k = n ?? same('1'); return { py: `str(${t.py})[:${k.py}]`, js: `String(${t.js}).slice(0, ${k.js})`, matlab: NONE, shape: 'scalar' } },
  RIGHT: ([t, n], ctx) => { noText(ctx, 'extractAfter(t, strlength(t) - n)'); const k = n ?? same('1'); return { py: `str(${t.py})[-(${k.py}):]`, js: `String(${t.js}).slice(-(${k.js}))`, matlab: NONE, shape: 'scalar' } },
  MID: ([t, s, n], ctx) => {
    ctx.notes.add('Excel counts characters from 1; Python and JavaScript count from 0, hence the "- 1".')
    noText(ctx, 'extractBetween(t, start, start + n - 1)')
    return { py: `str(${t.py})[(${s.py}) - 1:(${s.py}) - 1 + (${n.py})]`, js: `String(${t.js}).substr((${s.js}) - 1, ${n.js})`, matlab: NONE, shape: 'scalar' }
  },
  CONCAT: (args, ctx) => {
    if (anyList(args)) ctx.missing.matlab = 'A MATLAB matrix cannot mix numbers and text, so joining a whole range has no direct form. Join single values with strcat.'
    return { py: '"".join(str(x) for x in ' + flatList(args, 'py') + ')', js: flatList(args, 'js') + '.join("")', matlab: anyList(args) ? NONE : 'strcat(' + args.map(asText).join(', ') + ')', shape: 'scalar' }
  },
}
FUNCTIONS.STDEV = FUNCTIONS['STDEV.S']
FUNCTIONS.VAR = FUNCTIONS['VAR.S']
FUNCTIONS.CONCATENATE = FUNCTIONS.CONCAT

const OPS = {
  '+': ['+', '+', '+'], '-': ['-', '-', '-'], '*': ['*', '*', '.*'], '/': ['/', '/', './'], '^': ['**', '**', '.^'],
  '=': ['==', '===', '=='], '<>': ['!=', '!==', '~='], '<': ['<', '<', '<'], '>': ['>', '>', '>'], '<=': ['<=', '<=', '<='], '>=': ['>=', '>=', '>='],
}

function node(n, ctx) {
  switch (n.type) {
    case 'number': return same(String(n.value))
    case 'string': return { py: JSON.stringify(n.value), js: JSON.stringify(n.value), matlab: '"' + n.value.replace(/"/g, '""') + '"', shape: 'scalar', text: true }
    case 'bool': return { py: n.value ? 'True' : 'False', js: String(n.value), matlab: String(n.value), shape: 'scalar' }
    case 'group': { const x = node(n.arg, ctx); return { ...each((l) => `(${x[l]})`), shape: x.shape } }
    case 'cell': case 'range': {
      const ref = (n.sheet ? quoteSheet(n.sheet) + '!' : '') + (n.type === 'cell' ? cellKey(n.row, n.col) : formatRange(n))
      if (n.type === 'range' && (n.r2 === Infinity || n.c2 === Infinity)) throw new Untranslatable('whole-column or whole-row ranges such as ' + n.text)
      const shape = n.type === 'cell' ? 'scalar' : n.r1 === n.r2 || n.c1 === n.c2 ? 'list' : 'table'
      if (shape === 'scalar') return same(`xl("${ref}")`, shape)
      // In MATLAB a range is read into a variable first: data = xl("A1:A5").
      // The code reads better, and data(:) and [data; 10] then work.
      if (!ctx.ranges.has(ref)) ctx.ranges.set(ref, ctx.ranges.size ? 'data' + (ctx.ranges.size + 1) : 'data')
      return { ...same(`xl("${ref}")`, shape), matlab: ctx.ranges.get(ref) }
    }
    case 'unary': { const x = node(n.arg, ctx); if (x.shape !== 'scalar') throw new Untranslatable('negating a whole range'); return n.op === '-' ? each((l) => `-${x[l]}`) : x }
    case 'percent': { const x = node(n.arg, ctx); return each((l) => `${x[l]} / 100`) }
    case 'binary': {
      const a = node(n.left, ctx), b = node(n.right, ctx)
      if (n.op === '&') return { py: `str(${a.py}) + str(${b.py})`, js: `String(${a.js}) + String(${b.js})`, matlab: `strcat(${asText(a)}, ${asText(b)})`, shape: 'scalar' }
      if (a.shape !== 'scalar' || b.shape !== 'scalar') {
        if (a.shape === 'table' || b.shape === 'table') throw new Untranslatable('arithmetic on a whole table')
        // Element by element, as the spreadsheet does with ranges.
        const [py, js, m] = OPS[n.op]
        const listPy = a.shape === 'list' && b.shape === 'list' ? `[x ${py} y for x, y in zip(${a.py}, ${b.py})]` : a.shape === 'list' ? `[x ${py} ${b.py} for x in ${a.py}]` : `[${a.py} ${py} y for y in ${b.py}]`
        const listJs = a.shape === 'list' && b.shape === 'list' ? `${a.js}.map((x, i) => x ${js} ${b.js}[i])` : a.shape === 'list' ? `${a.js}.map((x) => x ${js} ${b.js})` : `${b.js}.map((y) => ${a.js} ${js} y)`
        return { py: listPy, js: listJs, matlab: `${a.matlab} ${m} ${b.matlab}`, shape: 'list' }
      }
      const [py, js, m] = OPS[n.op]
      return { py: `${a.py} ${py} ${b.py}`, js: `${a.js} ${js} ${b.js}`, matlab: `${a.matlab} ${m} ${b.matlab}`, shape: 'scalar' }
    }
    case 'call': {
      const f = FUNCTIONS[n.name]
      if (!f) throw new Untranslatable(n.name)
      const args = n.args.map((a) => (a.type === 'missing' ? undefined : node(a, ctx)))
      return f(args, ctx)
    }
    default: throw new Untranslatable('this part of the formula (' + n.type + ')')
  }
}

// Returns { py, js, matlab, notes } as complete code-cell bodies, or
// { unsupported } naming what has no translation yet.
export function translateFormula(tree) {
  const ctx = { imports: new Set(), notes: new Set(), missing: {}, ranges: new Map() }
  let r
  try {
    r = node(tree, ctx)
  } catch (e) {
    if (e instanceof Untranslatable) return { unsupported: e.what }
    throw e
  }
  const imports = [...ctx.imports].sort().map((m) => 'import ' + m)
  const code = {
    py: [...imports, r.py].join('\n'),
    js: 'return ' + r.js,
    matlab: [...[...ctx.ranges].map(([ref, name]) => `${name} = xl("${ref}");`), r.matlab].join('\n'),
  }
  // { lang: code } where a translation exists, and { lang: null } plus a reason where not.
  const missing = {}
  for (const l of LANGS) if (code[l].includes(NONE)) { code[l] = null; missing[l] = ctx.missing[l] ?? 'No equivalent yet.' }
  return { ...code, missing, notes: [...ctx.notes] }
}

export { LANGS }
