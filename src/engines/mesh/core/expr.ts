// A small, safe arithmetic evaluator for number fields: "pi/4", "2*1.5",
// "sqrt(2)/2", "-(3 + 4)^2". Recursive descent; no eval, no variables beyond
// pi, tau and e, no access to anything else.

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, ln: Math.log, log: Math.log10, exp: Math.exp,
  rad: (d) => (d * Math.PI) / 180, deg: (r) => (r * 180) / Math.PI,
};
const CONSTS: Record<string, number> = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E };

export function evalExpr(src: string): number | null {
  const s = src.replace(/\s+/g, '').toLowerCase();
  let i = 0;
  const peek = () => s[i];
  function num(): number {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    const w = /^[a-z]+/.exec(s.slice(i));
    if (w) {
      i += w[0].length;
      if (w[0] in CONSTS) return CONSTS[w[0]];
      if (w[0] in FUNCS && peek() === '(') { i++; const v = add(); if (peek() !== ')') throw 0; i++; return FUNCS[w[0]](v); }
      throw 0;
    }
    if (peek() === '(') { i++; const v = add(); if (peek() !== ')') throw 0; i++; return v; }
    throw 0;
  }
  function unary(): number { if (peek() === '-') { i++; return -unary(); } if (peek() === '+') { i++; return unary(); } return power(); }
  function power(): number { const b = num(); if (peek() === '^') { i++; return b ** unary(); } return b; }
  function mul(): number { let v = unary(); while (peek() === '*' || peek() === '/') { const op = s[i++]; const r = unary(); v = op === '*' ? v * r : v / r; } return v; }
  function add(): number { let v = mul(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = mul(); v = op === '+' ? v + r : v - r; } return v; }
  try {
    if (!s) return null;
    const v = add();
    return i === s.length && Number.isFinite(v) ? v : null;
  } catch { return null; }
}
