// A small, safe arithmetic evaluator for number fields: "pi/4", "2*1.5",
// "sqrt(2)/2", "-(3 + 4)^2". Recursive descent; no eval, no variables beyond
// pi, tau and e, no access to anything else.
//
// The grammar, one function per rule, loosest-binding first:
//   sum     := product (('+' | '-') product)*
//   product := signed (('*' | '/') signed)*
//   signed  := ('-' | '+') signed | power
//   power   := atom ('^' signed)?
//   atom    := number | constant | function '(' sum ')' | '(' sum ')'
// Spaces separate tokens: "1 2" is two numbers, an error, not 12.
// With a trace (Script: parse("…") with Record traces on), every value read and every operation applied is a
// step, with Predict questions on the first operation's result and on the whole value.

import type { Trace, TraceStep } from './trace';

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, ln: Math.log, log: Math.log10, exp: Math.exp,
  rad: (d) => (d * Math.PI) / 180, deg: (r) => (r * 180) / Math.PI,
};
const CONSTS: Record<string, number> = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E };
/** Own keys only: "constructor" is not a constant. */
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const RULES: Record<string, string> = {
  Sum: '+ and − join products, left to right: a sum is the loosest rule, so it is done last.',
  Product: '* and / join signed values, left to right. A product sits inside a sum, so it is done before any + or − around it.',
  Signed: 'A sign in front of a value. It is looser than ^, so −2^2 is −(2^2) = −4.',
  Power: '^ is the tightest operator. Its right side is parsed as a signed value, which may itself hold a ^, so 2^3^2 is 2^(3^2).',
};

class ParseError extends Error { constructor(message: string, readonly at: number) { super(message); } }

export interface ExprResult { value: number | null; error: string | null; at: number }

/** Parse and evaluate an expression; with a trace, record each value read and each operation applied. */
export function traceExpr(src: string, trace?: Trace): ExprResult {
  const s = src.toLowerCase();
  let i = 0, first = true, last: TraceStep | undefined;
  const show = (x: number) => String(+x.toFixed(6));
  const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const peek = () => { skip(); return s[i]; };
  const fail = (message: string): never => { throw new ParseError(message, i); };
  const read = (label: string, detail: string) => trace?.step({ phase: 'Atom', label, detail });
  const apply = (rule: string, label: string, out: number) => {
    if (!trace) return;
    const step: TraceStep = {
      phase: rule, label, detail: RULES[rule], values: [['result', show(out)]],
      quiz: first ? { prompt: `The parser reads "${src.trim()}". The first operation it carries out gives what value?`, answer: [out], labels: ['value'], rule: 'Operations are done innermost rule first: ^, then a sign, then * and /, then + and −; within a rule, left to right.' } : undefined,
    };
    trace.step(step);
    first = false; last = step;
  };
  const closing = () => { if (peek() !== ')') fail(i >= s.length ? 'a ( was never closed: expected )' : `expected ) but found "${s[i]}"`); i++; };

  function atom(): number {
    skip();
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (m) { i += m[0].length; read(`number ${m[0]}`, 'A number is read whole: its digits, a point and an exponent belong to one token.'); return parseFloat(m[0]); }
    const w = /^[a-z]+/.exec(s.slice(i));
    if (w) {
      const name = w[0];
      if (has(CONSTS, name)) { i += name.length; read(`${name} = ${show(CONSTS[name])}`, 'A named constant.'); return CONSTS[name]; }
      if (has(FUNCS, name)) {
        i += name.length;
        if (peek() !== '(') fail(`${name} needs brackets: ${name}( … )`);
        i++;
        const v = sum(); closing();
        const r = FUNCS[name](v);
        read(`${name}(${show(v)}) = ${show(r)}`, 'A function: the whole sum inside its brackets is worked out first.');
        return r;
      }
      fail(`unknown name "${name}"`);
    }
    if (peek() === '(') { i++; const v = sum(); closing(); read(`( … ) = ${show(v)}`, 'Brackets: the whole sum inside is worked out first, then used as one value.'); return v; }
    return fail(i >= s.length ? 'expected a number, but the text ended' : `expected a number but found "${s[i]}"`);
  }
  function power(): number {
    const b = atom();
    if (peek() !== '^') return b;
    i++;
    const e = signed(), r = b ** e;
    apply('Power', `${show(b)} ^ ${show(e)} = ${show(r)}`, r);
    return r;
  }
  function signed(): number {
    const c = peek();
    if (c !== '-' && c !== '+') return power();
    i++;
    const v = signed();
    if (c === '+') return v;
    apply('Signed', `−(${show(v)}) = ${show(-v)}`, -v);
    return -v;
  }
  function product(): number {
    let v = signed();
    for (let c = peek(); c === '*' || c === '/'; c = peek()) {
      i++;
      const r = signed(), out = c === '*' ? v * r : v / r;
      apply('Product', `${show(v)} ${c} ${show(r)} = ${show(out)}`, out);
      v = out;
    }
    return v;
  }
  function sum(): number {
    let v = product();
    for (let c = peek(); c === '+' || c === '-'; c = peek()) {
      i++;
      const r = product(), out = c === '+' ? v + r : v - r;
      apply('Sum', `${show(v)} ${c === '-' ? '−' : '+'} ${show(r)} = ${show(out)}`, out);
      v = out;
    }
    return v;
  }

  try {
    if (!s.trim()) fail('nothing to read');
    const v = sum();
    if (peek() !== undefined) fail(`expected an operator but found "${s[i]}"`);
    if (!Number.isFinite(v)) fail('the result is not a finite number');
    // The last operation done gives the whole value: ask for it there, before its label shows the answer.
    if (last && !last.quiz) last.quiz = { prompt: `What is the value of the whole of "${src.trim()}"?`, answer: [v], labels: ['value'], rule: '^ first, then signs, then * and /, then + and −; brackets first of all. The last operation done is the loosest one.' };
    trace?.step({ phase: 'Result', label: `"${src.trim()}" = ${show(v)}`, detail: 'The whole text was read and every operation applied.', values: [['value', show(v)]] });
    return { value: v, error: null, at: i };
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    trace?.step({ phase: 'Error', label: `Stopped at character ${e.at + 1}: ${e.message}`, detail: 'The grammar has no rule that can read the text from here, so the field turns red and keeps its old value.', values: [['text', src], ['position', String(e.at + 1)]] });
    return { value: null, error: e.message, at: e.at };
  }
}

export function evalExpr(src: string): number | null {
  return traceExpr(src).value;
}
