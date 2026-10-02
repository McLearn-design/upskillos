// Lesson 2.8: numbers you can type. MeshLab's number fields read arithmetic ("90/4", "pi/2") with a
// recursive-descent parser: one function per grammar rule, so precedence and grouping come from the grammar.

// The parser the learner builds: tokens, one function per rule, a tree, and its evaluation.
const PARSER = `// Split text into tokens: numbers, names, operators and brackets. Spaces only separate.
function tokens(text) {
  const out = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === ' ') { i++; continue }
    const num = /^\\d+(\\.\\d+)?/.exec(text.slice(i))
    if (num) { out.push(num[0]); i += num[0].length; continue }
    const word = /^[a-z]+/.exec(text.slice(i))
    if (word) { out.push(word[0]); i += word[0].length; continue }
    if ('+-*/^()'.includes(c)) { out.push(c); i++; continue }
    throw new Error('cannot read "' + c + '" at character ' + (i + 1))
  }
  return out
}

// One function per grammar rule. Each returns a tree: a number, or { op, a, b }.
function parse(text) {
  const t = tokens(text)
  let k = 0
  const peek = () => t[k]
  function atom() {                       // atom := number | pi | ( sum )
    const x = t[k++]
    if (x === '(') { const v = sum(); if (t[k++] !== ')') throw new Error('expected )'); return v }
    if (x === 'pi') return Math.PI
    if (x !== undefined && /^\\d/.test(x)) return Number(x)
    throw new Error(x === undefined ? 'expected a number, but the text ended' : 'expected a number but found "' + x + '"')
  }
  function power() {                      // power := atom ( ^ signed )?
    const b = atom()
    if (peek() === '^') { k++; return { op: '^', a: b, b: signed() } }
    return b
  }
  function signed() {                     // signed := - signed | power
    if (peek() === '-') { k++; return { op: 'neg', a: signed() } }
    return power()
  }
  function product() {                    // product := signed ( (* or /) signed )*
    let v = signed()
    while (peek() === '*' || peek() === '/') { const op = t[k++]; v = { op, a: v, b: signed() } }
    return v
  }
  function sum() {                        // sum := product ( (+ or -) product )*
    let v = product()
    while (peek() === '+' || peek() === '-') { const op = t[k++]; v = { op, a: v, b: product() } }
    return v
  }
  const tree = sum()
  if (k < t.length) throw new Error('expected an operator but found "' + t[k] + '"')
  return tree
}

// Work a tree out, innermost first, listing each operation as it is done.
function evaluate(n, done = []) {
  if (typeof n === 'number') return n
  if (n.op === 'neg') { const v = evaluate(n.a, done); done.push('-(' + v + ') = ' + -v); return -v }
  const a = evaluate(n.a, done), b = evaluate(n.b, done)
  const v = n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : a ** b
  done.push(a + ' ' + n.op + ' ' + b + ' = ' + v)
  return v
}
// The tree written with a bracket round every operation.
const brackets = (n) => typeof n === 'number' ? String(+n.toFixed(4)) : n.op === 'neg' ? '-' + brackets(n.a) : '(' + brackets(n.a) + ' ' + n.op + ' ' + brackets(n.b) + ')'
`;

const LEFT_TO_RIGHT = `// A calculator that works strictly left to right, one operator at a time.
const text = '2 + 3 * 4'
const t = text.split(' ')
let v = Number(t[0])
for (let i = 1; i < t.length; i += 2) {
  const b = Number(t[i + 1])
  v = t[i] === '+' ? v + b : t[i] === '-' ? v - b : t[i] === '*' ? v * b : v / b
}
console.log('left to right: ' + v)
console.log('with precedence (as JavaScript does it): ' + (2 + 3 * 4))`;

const TOKENS = `${PARSER}
for (const text of ['2+3*4', ' 2 * ( 1 + 1 ) ', '1 2', 'pi/4']) console.log(JSON.stringify(text) + ' → ' + JSON.stringify(tokens(text)))`;

const PARSE = `${PARSER}
for (const text of ['2 + 3 * 4', '8 - 3 - 2', '-2^2', '2^3^2', '(2 + 3) * 4']) {
  const tree = parse(text), done = []
  const v = evaluate(tree, done)
  console.log(text + ' → ' + brackets(tree) + ' = ' + v + ' (' + done.join(', ') + ')')
}
// Text the grammar has no rule for.
for (const text of ['1 2', '(1 + 2', '2 +']) {
  try { parse(text) } catch (e) { console.log(JSON.stringify(text) + ': ' + e.message) }
}`;

const TREE = `${PARSER}
const text = '2 + 3 * 4'          // try '(2 + 3) * 4', '8 - 3 - 2' or '2^3^2'
const tree = parse(text)
// Lay the tree out: leaves left to right, each operator above the middle of its children.
let next = 0
const nodes = [], lines = []
function place(n, depth) {
  if (typeof n === 'number') { const p = { x: next++, y: depth, label: String(+n.toFixed(2)) }; nodes.push(p); return p }
  const kids = (n.op === 'neg' ? [n.a] : [n.a, n.b]).map((c) => place(c, depth + 1))
  const p = { x: kids.reduce((s, c) => s + c.x, 0) / kids.length, y: depth, label: n.op === 'neg' ? '−' : n.op }
  nodes.push(p)
  kids.forEach((c) => lines.push([p, c]))
  return p
}
place(tree, 0)
const X = (x) => 40 + x * 70, Y = (y) => 30 + y * 60
const w = X(next - 1) + 40, h = Y(Math.max(...nodes.map((n) => n.y))) + 30
let svg = '<svg width="' + w + '" height="' + h + '" font-family="sans-serif" font-size="16" text-anchor="middle" style="display: block; margin: 8px auto">'
for (const [p, c] of lines) svg += '<line x1="' + X(p.x) + '" y1="' + Y(p.y) + '" x2="' + X(c.x) + '" y2="' + Y(c.y) + '" stroke="#94a3b8" stroke-width="2"/>'
for (const n of nodes) svg += '<circle cx="' + X(n.x) + '" cy="' + Y(n.y) + '" r="18" fill="' + (/\\d/.test(n.label) ? '#4f8fd9' : '#f59e0b') + '"/><text x="' + X(n.x) + '" y="' + (Y(n.y) + 5) + '" fill="white">' + n.label + '</text>'
document.body.insertAdjacentHTML('beforeend', svg + '</svg>')
console.log(text + ' → ' + brackets(tree) + ': ' + nodes.length + ' nodes; the operator at the top is done last')`;

const CHALLENGE = `// Show how MeshLab's parser groups each expression: put brackets round every
// operation except the last one done. Example: '2 + 3 * 4' becomes '2 + (3 * 4)'.
const answers = [
  '8 - 3 - 2',
  '-2^2',
  '2^3^2',
  '1 + 2 * 3^2',
]
console.log(answers.join('   |   '))`;

const SOLVED = CHALLENGE.replace(`  '8 - 3 - 2',
  '-2^2',
  '2^3^2',
  '1 + 2 * 3^2',`, `  '(8 - 3) - 2',
  '-(2^2)',
  '2^(3^2)',
  '1 + (2 * (3^2))',`);

const QUESTIONS = ['8 - 3 - 2', '-2^2', '2^3^2', '1 + 2 * 3^2'];
const WHY = [
  '− goes left to right: the first subtraction is done first.',
  '^ binds tighter than a sign in front: the sign applies to the whole power.',
  '^ groups to the right: the top exponent is worked out first.',
  '^ before *, and * before +.',
];

/** Parse an expression into a tree, noting which operations the writer bracketed themselves. */
function tree(text) {
  const t = text.match(/\d+(?:\.\d+)?|[-+*/^()]|\S/g) ?? [];
  let k = 0;
  const atom = () => {
    const x = t[k++];
    if (x === '(') { const v = sum(); if (t[k++] !== ')') throw new Error('a ( is not closed'); if (typeof v === 'object') v.br = true; return v; }
    if (x !== undefined && /^\d/.test(x)) return Number(x);
    throw new Error(x === undefined ? 'it ends where a number should be' : `"${x}" stands where a number should be`);
  };
  const power = () => { const b = atom(); if (t[k] === '^') { k++; return { op: '^', a: b, b: signed() }; } return b; };
  const signed = () => { if (t[k] === '-') { k++; return { op: 'neg', a: signed() }; } return power(); };
  const product = () => { let v = signed(); while (t[k] === '*' || t[k] === '/') { const op = t[k++]; v = { op, a: v, b: signed() }; } return v; };
  const sum = () => { let v = product(); while (t[k] === '+' || t[k] === '-') { const op = t[k++]; v = { op, a: v, b: product() }; } return v; };
  const v = sum();
  if (k < t.length) throw new Error(`"${t[k]}" is left over`);
  return v;
}
const canon = (n) => (typeof n === 'number' ? String(n) : n.op === 'neg' ? `(−${canon(n.a)})` : `(${canon(n.a)} ${n.op === '-' ? '−' : n.op} ${canon(n.b)})`);
const same = (p, q) => (typeof p === 'number' || typeof q === 'number' ? p === q : p.op === q.op && same(p.a, q.a) && (p.op === 'neg' || same(p.b, q.b)));
/** Operations below the root that the writer did not bracket. */
const unbracketed = (n, root = true) => (typeof n === 'number' ? 0 : (!root && !n.br ? 1 : 0) + unbracketed(n.a, false) + (n.op === 'neg' ? 0 : unbracketed(n.b, false)));
const count = (n) => (typeof n === 'number' ? 0 : 1 + count(n.a) + (n.op === 'neg' ? 0 : count(n.b)));

/** The challenge's check: each answer must group like the parser, with every operation but the last bracketed. */
export function checkGrouping(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answers\s*=\s*\[([\s\S]*?)\]/);
  const answers = m ? [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]) : [];
  if (answers.length !== 4) return no('Keep const answers = [ … ] with four quoted expressions, in the same order.');
  for (const [i, text] of answers.entries()) {
    const truth = tree(QUESTIONS[i]);
    let theirs;
    try { theirs = tree(text); } catch (e) { return no(`Answer ${i + 1} could not be read: ${e.message}.`); }
    if (!same(theirs, truth)) return no(`Answer ${i + 1} groups "${QUESTIONS[i]}" as ${canon(theirs)}${Math.abs(evalTree(theirs) - evalTree(truth)) > 1e-9 ? `, which is ${evalTree(theirs)}, not ${evalTree(truth)}` : ''}. ${WHY[i]}`);
    const open = unbracketed(theirs);
    if (open > 0) return no(`Answer ${i + 1} groups correctly, but ${open} of its ${count(theirs) - 1} inner operations ${open === 1 ? 'has' : 'have'} no brackets of ${open === 1 ? 'its' : 'their'} own. Bracket every operation except the last one done.`);
  }
  return { pass: true, message: 'All four group as the parser does: − left to right, a sign looser than ^, ^ to the right, and ^ before * before +. Each rule of the grammar is one level of brackets.' };
}
function evalTree(n) {
  if (typeof n === 'number') return n;
  if (n.op === 'neg') return -evalTree(n.a);
  const a = evalTree(n.a), b = evalTree(n.b);
  return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : a ** b;
}

export default {
  id: 'modelling-geometry-2-008',
  slug: 'numbers-you-can-type',
  chapter: 'modelling-geometry',
  order: 8,
  title: 'Numbers you can type',
  subtitle: 'Type 90/4 into a field and get 22.5: a grammar and a recursive-descent parser, one function per rule.',
  tags: ['parsing', 'grammar', 'operator precedence', 'recursive descent', 'inspector'],
  coreConcept: 'A grammar with one rule per precedence level, loosest first (sum, product, signed, power, atom), parsed by one function per rule, groups an expression correctly: precedence comes from which rule calls which, and left-to-right grouping from a loop.',
  prerequisites: ['modelling-geometry-2-002'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-3-001',

  hook: {
    question: 'Type 2 + 3 * 4 into a field. A pocket calculator that works left to right says 20; MeshLab says 14. How does a program know to multiply first?',
    realWorldContext: 'Every 3D tool lets you type arithmetic into a field: 90/4 for a rotation, 2*1.5 for a size, pi/2 for an angle. Blender, CAD programs and spreadsheets all do it. Behind each field is a small parser, the same idea that reads programming languages, shader code and file formats.',
  },

  intuition: {
    prose: [
      'Read $2 + 3 \\times 4$ strictly left to right: $2 + 3 = 5$, then $5 \\times 4 = 20$. Read it the way maths does: $3 \\times 4 = 12$ first, then $2 + 12 = 14$. Cell 1 runs both. MeshLab gives $14$, because $\\times$ has higher **precedence**: it binds tighter than $+$.',
      'Before running cell 3, predict: what is $8 - 3 - 2$? Is it $(8 - 3) - 2 = 3$ or $8 - (3 - 2) = 7$? And what is $-2^2$: $4$ or $-4$?',
      'Precedence does not settle $8 - 3 - 2$, because both operators are the same. That needs **associativity**: which way equal operators group. Subtraction and division group to the left, $(8 - 3) - 2 = 3$. Powers group to the right: $2^{3^2} = 2^{(3^2)} = 2^9 = 512$.',
      'A sign in front is looser than a power: $-2^2 = -(2^2) = -4$. This matches how $-x^2$ is read in maths.',
      'First the text is split into **tokens**: the smallest pieces that mean something. "$2+3*4$" becomes $2, +, 3, *, 4$. A number is one token, however many digits it has. Spaces only separate tokens, so "$1\\ 2$" is two numbers side by side, not $12$ (cell 2).',
      'A **grammar** is a set of rules saying how tokens may be put together. MeshLab\'s has five, from loosest to tightest: a **sum** is products joined by $+$ or $-$; a **product** is signed values joined by $\\times$ or $\\div$; a **signed** value is a power with an optional $-$ in front; a **power** is an atom with an optional $\\hat{}$ and another signed value; an **atom** is a number, a name like $\\pi$, or a sum in brackets.',
      'Each rule is built from the next tighter one. That is what makes $\\times$ happen first: a sum cannot even see a $\\times$, because the product rule has already used it up.',
      'A **recursive-descent parser** turns each rule into one function that calls the functions for the rules it is made of. sum() calls product(); product() calls signed(); and so on down to atom(), which calls sum() again for brackets: that is the recursion. A loop inside sum() and product() joins equal operators left to right.',
      'The parser builds a **parse tree**: each operator above its two operands (cell 4). Working the tree out from the leaves up gives the value. The operator at the top is done last. If the text breaks every rule, the parser stops at that token and says where: MeshLab turns the field red and keeps the old number.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Parse an expression by recursive descent',
        body: 'Step 1. Split the text into tokens: numbers, names, operators and brackets; skip spaces.\nStep 2. Write one function per rule, loosest first: sum, product, signed, power, atom.\nStep 3. In sum: read a product, then while the next token is $+$ or $-$, take it and read another product, joining left to right.\nStep 4. In product: the same with $\\times$ and $\\div$ over signed values.\nStep 5. In signed: if the next token is $-$, take it and read a signed value; else read a power. In power: read an atom; if $\\hat{}$ follows, take it and read a signed value (so powers group to the right).\nStep 6. In atom: read a number or a name, or $($, a sum and $)$.\nStep 7. After the top sum, every token must be used up; otherwise report the first token that does not fit.',
      },
      {
        type: 'warning',
        title: 'A loop groups left; recursion on the right groups right',
        body: 'Writing sum as "a product, then $+$ or $-$, then a sum" looks the same but groups to the right: $8 - 3 - 2$ becomes $8 - (3 - 2) = 7$. Use a loop for left-grouping operators. Only $\\hat{}$ should call itself on its right.',
      },
      {
        type: 'warning',
        title: 'Never hand the text to eval',
        body: 'JavaScript\'s eval would also give $14$, but it runs any code typed into the field. A parser reads only what its grammar allows: numbers, $\\pi$, a few functions, operators and brackets. Anything else is an error, not a program.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: none here, but parsers everywhere',
        body: 'Nothing on screen depends on parsing a field. But the same method reads the files that carry meshes (OBJ, lesson 1.7) and the shader code the GPU runs: a GLSL compiler starts with a tokenizer and a grammar for expressions with exactly these precedence levels (chapter 9).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "the computer works left to right like a cheap calculator". The tree for $2 + 3 \\times 4$ has $+$ at the top and $\\times$ below it, so $\\times$ is done first. Invariant: the leaves stay in their left-to-right order in every tree; only how they are grouped changes. Try $(2 + 3) \\times 4$: $\\times$ moves to the top.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'Each grammar rule in Step 2 is one function in cell 3: sum(), product(), signed(), power(), atom(). The comment beside each function is its rule.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The parser runs once, when you press Enter; only the number it produces goes into the object\'s transform and on to the GPU.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Every number field in MeshLab and in Game Studio uses one parser (core/expr.ts). In a script, parse("…") runs it, traced rule by rule with Record traces on.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a recursive-descent parser',
        caption: 'Tokens, five grammar rules as five functions, the parse tree, and its value. Then type expressions in MeshLab.',
        props: {
          lesson: {
            title: 'Numbers you can type',
            subtitle: 'Write the parser behind every number field: tokens, a grammar, one function per rule, and a parse tree.',
            cells: [
              { type: 'js', instruction: '### 1. Left to right is wrong\nA calculator that works strictly left to right, against the precedence maths uses.', startCode: LEFT_TO_RIGHT },
              { type: 'js', instruction: '### 2. Tokens\nSplit the text into numbers, names, operators and brackets. Spaces only separate tokens.', startCode: TOKENS },
              { type: 'js', instruction: '### 3. One function per rule\nPredict 8 - 3 - 2 and -2^2 first. Each line shows the grouping, the value, and the operations in the order they are done.', startCode: PARSE },
              { type: 'js', instruction: '### 4. The parse tree\nEach operator sits above its operands; the one at the top is done last. Change the text and run again.', startCode: TREE, showPreviewByDefault: true, outputHeight: 260 },
              { type: 'challenge', instruction: '### 5. Challenge: group like the parser\nBracket every operation except the last one done, the way MeshLab\'s parser groups each expression. The check names any grouping that differs.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkGrouping },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Numbers you can type" in MeshLab](#/lab/mesh-lab?project=numbers-you-can-type). Its script calls parse() on a few expressions, then traces "2 + 3 * 4" with **Record traces** on. In **Predict** mode, predict the first operation\'s result, then the whole value. Compare with cell 3.' },
              { type: 'markdown', instruction: '### Use the tool\n- Every number field in the Inspector reads arithmetic: 90/4, pi/2, 2*1.5, sqrt(2)/2, -(3 + 4)^2. Press Enter (or click away) to apply; Escape to cancel.\n- Names it knows: pi, tau, e; functions sqrt, sin, cos, tan, abs, asin, acos, atan, ln, log, exp, rad, deg.\n- If the text breaks the grammar, the field turns red and keeps the old value.\n- In a script: parse("2 + 3 * 4") gives 14, or throws an error saying where it stopped.\n- **In Blender:** fields accept Python expressions, such as 90/4 or pi/2; units such as 2cm work too.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the rule order gives precedence.** sum() only ever joins whole products. When sum() reads $2 + 3 \\times 4$, its call to product() returns $2$ (the next token, $+$, is not $\\times$), and its second call to product() reads all of $3 \\times 4$. So the tree is $2 + (3 \\times 4)$: the $\\times$ was grouped inside product before sum saw anything after the $+$.',
      '**Why the loop groups left.** sum() keeps a running value $v$. On $8 - 3 - 2$ it reads $8$, then $- 3$, giving $v = 8 - 3$, then $- 2$, giving $v = (8 - 3) - 2$. Each new operand is joined to everything before it.',
      '**Why power groups right.** power() reads an atom, sees $\\hat{}$, and calls signed() for the exponent, which can itself contain a $\\hat{}$. On $2^{3^2}$ the exponent call reads all of $3^2$. So the tree is $2^{(3^2)}$.',
      '**Why the cost is linear.** Every function call takes at least one token before calling deeper, or returns at once. Each token is looked at a fixed number of times, and nothing is ever re-read. So a text of $n$ tokens is parsed in $O(n)$ steps.',
    ],
    equations: [
      { label: 'The grammar', latex: '\\begin{aligned} \\text{sum} &\\to \\text{product}\\ ((+ \\mid -)\\ \\text{product})^* \\\\ \\text{product} &\\to \\text{signed}\\ ((\\times \\mid \\div)\\ \\text{signed})^* \\\\ \\text{signed} &\\to -\\ \\text{signed} \\mid \\text{power} \\\\ \\text{power} &\\to \\text{atom}\\ (\\hat{}\\ \\text{signed})^? \\\\ \\text{atom} &\\to \\text{number} \\mid \\text{name} \\mid (\\ \\text{sum}\\ ) \\end{aligned}' },
      { label: 'Left and right grouping', latex: '8 - 3 - 2 = (8 - 3) - 2 = 3, \\qquad 2^{3^2} = 2^{(3^2)} = 512' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A context-free grammar is a set of rules rewriting one name into a sequence of names and tokens. The grammar here is LL(1): at every choice, the next single token says which alternative to take. For an LL(1) grammar without left recursion, a recursive-descent parser recognises exactly the strings the grammar generates, in time linear in their length, and builds their unique parse tree.',
      '**Invariant viewpoint.** The value of an expression is a property of its tree, not of its text. $2 + 3 \\times 4$, $2+3*4$ and $(2) + ((3) \\times 4)$ have one tree and one value. Precedence and associativity are exactly the rules for choosing that tree from text without brackets.',
      '**Geometric picture.** Draw the tree with leaves in reading order. Each operator\'s node covers a contiguous run of leaves: the part of the text it groups. Brackets in the text force a run to be one subtree. Two trees for one text would mean two runs crossing; the grammar is unambiguous because no such crossing is ever allowed.',
      '**Where this goes.** The same structure reads programming languages: their grammars have a dozen precedence levels, but each is one more function. Shader compilers parse GLSL this way before turning trees into GPU instructions (chapter 9). Lesson 4.7 goes the other way: it turns actions into code text that a parser can read back.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-2-008-ex1',
      title: 'Parse 2 + 3 * 4',
      problem: 'Follow the five rules on the text $2 + 3 \\times 4$.',
      steps: [
        { expression: '2,\\ +,\\ 3,\\ \\times,\\ 4', annotation: 'Step 1: five tokens.' },
        { expression: '\\text{sum} \\to \\text{product} \\to \\text{signed} \\to \\text{power} \\to \\text{atom} = 2', annotation: 'Step 2: sum calls down the rules; atom reads 2. Next token is +, so power, signed and product all return 2.' },
        { expression: '\\text{sum sees } +,\\ \\text{reads a product}', annotation: 'Step 3: sum takes the + and calls product for the right side.' },
        { expression: '\\text{product reads } 3,\\ \\text{sees } \\times,\\ \\text{reads } 4 \\Rightarrow 3 \\times 4', annotation: 'Step 4: product loops while it sees × or ÷, so it groups 3 × 4 itself.' },
        { expression: '2 + (3 \\times 4) = 2 + 12 = 14', annotation: 'Back in sum: the tree has + at the top. Work it out from the leaves up.' },
      ],
      conclusion: 'The parser groups $2 + (3 \\times 4) = 14$: × was finished inside product before sum went on.',
    },
    {
      id: 'modelling-geometry-2-008-ex2',
      title: 'Equal operators: 8 - 3 - 2',
      problem: 'Parse $8 - 3 - 2$ and say which subtraction is done first.',
      steps: [
        { expression: 'v = 8', annotation: 'sum reads its first product: 8.' },
        { expression: 'v = 8 - 3 = 5', annotation: 'Step 3: the loop sees −, reads 3, and joins it to everything so far.' },
        { expression: 'v = (8 - 3) - 2 = 3', annotation: 'The loop runs again: − 2 is joined to (8 − 3).' },
      ],
      conclusion: '$8 - 3 - 2 = (8 - 3) - 2 = 3$: the loop groups equal operators to the left.',
    },
    {
      id: 'modelling-geometry-2-008-ex3',
      title: 'Signs and powers: -2^3^2 / 4',
      problem: 'Parse $-2^{3^2} \\div 4$ (typed as -2^3^2/4) and give its value.',
      steps: [
        { expression: '\\text{product} \\to \\text{signed: sees } -', annotation: 'Step 5: the sign is taken first, and the rest is read as a signed value.' },
        { expression: '\\text{power: } 2\\ \\hat{}\\ \\text{signed} \\to 2^{(3^2)} = 2^9 = 512', annotation: 'power reads 2, sees ^, and its exponent call reads all of 3^2: right grouping.' },
        { expression: '-(512) = -512', annotation: 'The sign applies to the whole power: looser than ^.' },
        { expression: '\\text{product sees } \\div:\\ (-512) \\div 4 = -128', annotation: 'Back in product: ÷ joins the signed value to 4.' },
      ],
      conclusion: 'The text groups as $(-(2^{(3^2)})) \\div 4 = -128$.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-008-ch1',
      difficulty: 'easy',
      problem: 'List the tokens of "$12.5*(pi-1)$".',
      walkthrough: [
        { expression: '12.5', annotation: 'Digits and a point form one number token.' },
        { expression: '\\times,\\ (,\\ \\pi,\\ -,\\ 1,\\ )', annotation: 'Each operator and bracket is one token; "pi" is one name token.' },
      ],
      answer: 'Seven tokens: 12.5, *, (, pi, -, 1 and ).',
    },
    {
      id: 'modelling-geometry-2-008-ch2',
      difficulty: 'medium',
      problem: 'A parser\'s sum rule is written as "sum := product ( (+ or −) sum )?", calling itself on the right. What does it give for $10 - 4 + 1$, and what should it give?',
      walkthrough: [
        { expression: '10 - (4 + 1)', annotation: 'Calling sum on the right groups everything after the first − together.' },
        { expression: '10 - 5 = 5', annotation: 'So it gives 5.' },
        { expression: '(10 - 4) + 1 = 7', annotation: 'Left grouping, from a loop, gives the correct 7.' },
      ],
      answer: 'It gives 5, because recursion on the right groups 10 − (4 + 1); it should give 7, which a loop that joins left to right produces.',
    },
    {
      id: 'modelling-geometry-2-008-ch3',
      difficulty: 'hard',
      problem: 'Add a remainder operator $\\%$ with the same precedence as $\\times$ and $\\div$, grouping to the left. Which rule changes, and what is $7 + 10 \\% 4 \\times 2$?',
      walkthrough: [
        { expression: '\\text{product} \\to \\text{signed}\\ ((\\times \\mid \\div \\mid \\%)\\ \\text{signed})^*', annotation: 'Same precedence as × means the same rule; the loop gives left grouping.' },
        { expression: '7 + ((10 \\% 4) \\times 2)', annotation: 'Product reads 10 % 4 first, then × 2, left to right; sum adds 7.' },
        { expression: '7 + (2 \\times 2) = 11', annotation: '10 % 4 = 2.' },
      ],
      answer: 'Only the product rule changes, to accept % in its loop; then 7 + 10 % 4 * 2 groups as 7 + ((10 % 4) * 2) = 11.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{token}', meaning: 'The smallest piece of text that means something: one number, name, operator or bracket.' },
      { symbol: '\\text{grammar}', meaning: 'A set of rules saying how tokens may be combined; each rule names the pieces one kind of expression is made of.' },
      { symbol: '\\text{precedence}', meaning: 'Which operators bind tighter: × before +, ^ before a sign. Set by how deep an operator\'s rule is.' },
      { symbol: '\\text{associativity}', meaning: 'Which way equal operators group: − and ÷ to the left, ^ to the right. Set by a loop (left) or a call on the right (right).' },
      { symbol: '\\text{parse tree}', meaning: 'Each operator above its operands; evaluating from the leaves up gives the value, and the top operator is done last.' },
      { symbol: 'O(n)', meaning: 'The parser\'s cost: each of the n tokens is read a fixed number of times.' },
    ],
    rulesOfThumb: [
      'One function per precedence level, loosest first, each calling the next tighter one.',
      'Use a loop for operators that group left (+, −, ×, ÷); call yourself on the right only for ^.',
      'Read the whole text: after the top rule returns, any token left over is an error.',
      'When a result looks wrong, write the expression with every bracket; the wrong grouping shows at once.',
      'Report where parsing stopped, not just that it failed: that is what makes a red field fixable.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-002', label: 'Translate, rotate, scale', note: 'The transform fields these expressions are typed into, and degrees for rotation.' },
      { lessonId: 'modelling-geometry-1-007', label: 'Files: OBJ and glTF', note: 'Reading an OBJ file line by line: the same splitting of text into tokens.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-4-007', label: 'Every click is code', note: 'The GUI → code log writes actions as code text that a parser can read back.' },
      { lessonId: 'modelling-geometry-9-001', label: 'Light and the cosine law', note: 'Chapter 9 writes shaders in GLSL, which the GPU driver parses with the same kind of grammar, with more precedence levels.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-2-008-1', label: 'Read how precedence and associativity decide the grouping', type: 'read' },
    { id: 'cp-modelling-geometry-2-008-2', label: 'Read the five grammar rules, loosest first', type: 'read' },
    { id: 'cp-modelling-geometry-2-008-3', label: 'Read why a loop groups left and a call on the right groups right', type: 'read' },
    { id: 'cp-modelling-geometry-2-008-4', label: 'Run cells 1 to 4, and draw the tree for (2 + 3) * 4', type: 'lab' },
    { id: 'cp-modelling-geometry-2-008-5', label: 'Run the traced parse in MeshLab in Predict mode, and type 90/4 into a field', type: 'lab' },
    { id: 'cp-modelling-geometry-2-008-6', label: 'Work through example 2, equal operators', type: 'example' },
    { id: 'cp-modelling-geometry-2-008-7', label: 'Work through example 3, signs and powers', type: 'example' },
    { id: 'cp-modelling-geometry-2-008-8', label: 'Complete the challenge: group like the parser', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-008-assess-1',
        type: 'choice',
        text: 'What does MeshLab\'s parser give for 2^3^2?',
        options: ['512', '64', '36', 'An error'],
        answer: '512',
        hint: '^ groups to the right: 2^(3^2) = 2^9.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-2-008-quiz-1',
      type: 'choice',
      text: 'What does MeshLab\'s parser give for 2 + 3 * 4?',
      options: ['14', '20', '24', '9'],
      answer: '14',
      hints: ['× binds tighter than +.', 'The product rule groups 3 * 4 before the sum rule sees it.'],
      reviewSection: 'Intuition: the first paragraph, and example 1',
    },
    {
      id: 'modelling-geometry-2-008-quiz-2',
      type: 'choice',
      text: 'What is -2^2 in MeshLab?',
      options: ['-4', '4', '-2', 'An error'],
      answer: '-4',
      hints: ['A sign in front is looser than ^.', '−(2^2).'],
      reviewSection: 'Intuition: the paragraph on signs, and cell 3',
    },
    {
      id: 'modelling-geometry-2-008-quiz-3',
      type: 'choice',
      text: 'You type "1 2" into a field. What happens?',
      options: ['The field turns red: two numbers side by side break the grammar', 'It reads 12', 'It reads 1', 'It reads 3'],
      answer: 'The field turns red: two numbers side by side break the grammar',
      hints: ['Spaces separate tokens.', 'Which rule allows a number straight after a number?'],
      reviewSection: 'Intuition: the tokens paragraph, and cell 2',
    },
    {
      id: 'modelling-geometry-2-008-quiz-4',
      type: 'choice',
      text: 'Which way of writing the sum rule groups 8 − 3 − 2 WRONGLY?',
      options: ['sum := product ((+ or −) sum)?', 'sum := product ((+ or −) product)*, read with a loop', 'A loop that keeps a running value v and joins each new product to it', 'Reading products left to right and combining as they arrive'],
      answer: 'sum := product ((+ or −) sum)?',
      hints: ['Three of these are the same left-grouping loop.', 'Calling sum on the right groups everything after the first − together.'],
      reviewSection: 'Warning "A loop groups left; recursion on the right groups right"',
    },
    {
      id: 'modelling-geometry-2-008-quiz-5',
      type: 'choice',
      text: 'In a parse tree, which operation is done last?',
      options: ['The one at the top', 'The leftmost one', 'The one at the bottom', 'The rightmost one'],
      answer: 'The one at the top',
      hints: ['Working out a tree goes from the leaves up.', 'The top needs both its children\'s values first.'],
      reviewSection: 'Callout "What the picture shows (cell 4)"',
    },
    {
      id: 'modelling-geometry-2-008-quiz-6',
      type: 'choice',
      text: 'Why does MeshLab parse fields itself instead of using JavaScript\'s eval?',
      options: ['eval would run any code typed into the field', 'eval gets 2 + 3 * 4 wrong', 'eval cannot read decimals', 'eval is not available in browsers'],
      answer: 'eval would run any code typed into the field',
      hints: ['eval does get the arithmetic right.', 'What else could someone type into a field?'],
      reviewSection: 'Warning "Never hand the text to eval"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A program works an expression out left to right, like typing it into a basic calculator.',
      whyStudentsThinkIt: 'Simple calculators do, and text is read left to right.',
      correctionExample: 'MeshLab gives 2 + 3 * 4 = 14, not 20: the product rule groups 3 * 4 before the sum rule adds 2.',
      contrastCase: '8 − 3 − 2: here left to right is right, (8 − 3) − 2 = 3, because both operators are equal and group left.',
    },
    {
      falseBelief: 'A minus sign in front binds tighter than a power, so −2^2 = 4.',
      whyStudentsThinkIt: 'The sign is written next to the 2, so it seems to belong to the 2.',
      correctionExample: 'MeshLab gives −2^2 = −4: the signed rule is looser than power, so it is −(2^2).',
      contrastCase: '(−2)^2 = 4: brackets make the signed value an atom, so the power applies to −2.',
    },
    {
      falseBelief: 'Spaces are ignored, so "1 2" means 12.',
      whyStudentsThinkIt: 'Spaces are ignored around operators: "2 * 3" and "2*3" are the same.',
      correctionExample: '"1 2" is the tokens 1 and 2 with no operator between them: an error, and the field turns red.',
      contrastCase: '"12" is one token, the number twelve.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A level editor lets designers type formulas such as "base * 1.5 + bonus" into a damage field.',
      competingTechniques: ['Hand the text to eval', 'Replace the names with numbers, then parse with a grammar like this one, plus names in the atom rule'],
      whyThisTechniqueWins: 'A grammar reads only arithmetic and the known names; eval would run any code a designer pasted in, and give no position for a typo.',
    },
    {
      situation: 'A CAD tool must accept "3 in + 2 cm" in a length field.',
      competingTechniques: ['Strip the letters and add the numbers', 'Add a unit to the atom rule (a number followed by a unit name), converting to one unit'],
      whyThisTechniqueWins: 'Making units part of the atom keeps precedence right and converts each length before it is added; stripping letters gives 5, a meaningless number.',
    },
  ],

  debugging: [
    {
      commonError: 'Writing sum (or product) as a call to itself on the right.',
      symptom: '8 − 3 − 2 gives 7 and 16 / 4 / 2 gives 8, while + and × look fine.',
      whyItHappened: 'Calling the rule on the right groups to the right; only − and ÷ show it, because + and × do not care how they group.',
      repairStrategy: 'Use a loop that keeps a running value and joins each new operand to it; test with 8 - 3 - 2 = 3.',
    },
    {
      commonError: 'Not checking for tokens left over after the top rule.',
      symptom: '"2 3" is accepted as 2, silently dropping the 3.',
      whyItHappened: 'sum() stops at the first token it cannot use and returns; the caller never looked at what remained.',
      repairStrategy: 'After the top rule returns, report an error if any token is left, naming it and its position.',
    },
    {
      commonError: 'Removing every space before tokenizing.',
      symptom: '"1 2" is read as 12 instead of turning the field red.',
      whyItHappened: 'Deleting spaces joins two tokens into one; spaces must separate tokens, not vanish. (MeshLab\'s own parser had this bug until this lesson was written.)',
      repairStrategy: 'Skip spaces between tokens inside the tokenizer, never across a token.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write a tokenizer and a recursive-descent parser for + − × ÷ ^, signs and brackets, and evaluate its tree.',
    explainVerbally: 'Explain how the order of the rules gives precedence, and how a loop or a call on the right sets the grouping.',
    detectIncorrectApplication: 'Spot a parser that groups − to the right, drops leftover tokens, or joins tokens across spaces, from its output on test expressions.',
    transferToUnfamiliar: 'Extend the grammar with a new operator, units or named variables, keeping precedence and grouping right.',
  },
};
