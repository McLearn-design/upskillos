// predictions.js
// Prediction checkpoints: a ```predict fence in a lesson step asks the learner to commit to an
// answer before running something. The explanation stays hidden until they lock it in.
//
//   ```predict
//   question: After 20 presses, how close will "slid" be to 0.2?
//   choice: Exactly 0.2
//   choice: Within about 0.1 of it, but rarely exact
//   answer: Within about 0.1 of it, but rarely exact
//   explain: 20 presses is a small sample...
//   verify: .venv/Scripts/python -c "print(...)"
//   ```
//
// Kinds: with `choice:` lines it's multiple choice (`answer:` repeats the right choice's text);
// with a numeric `answer:` and no choices it's a number (`tolerance:` optional, default 0);
// with no `answer:` it's open: the learner writes a prediction, then compares it with the
// explanation and says how they did. A line that doesn't start with a key continues the line
// before it, so `explain:` can run over several lines and paragraphs.
//
// `verify:` is never shown to the learner. The track's walkthrough test runs it in the project
// after the step and checks that it prints the stated answer, so a prediction can't claim
// something the code doesn't do.
const KEYS = ['question', 'choice', 'answer', 'tolerance', 'explain', 'verify'];
const LIST_KEYS = new Set(['choice']);

export function parsePrediction(raw) {
  const fields = { question: '', choice: [], answer: null, tolerance: null, explain: '', verify: null };
  let last = null;
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^(\w+):\s?(.*)$/);
    if (m && KEYS.includes(m[1])) {
      last = m[1];
      if (LIST_KEYS.has(last)) fields[last].push(m[2]);
      else fields[last] = m[2];
      continue;
    }
    if (!last) {
      if (line.trim()) throw new Error(`Prediction line before any key: ${line}`);
      continue;
    }
    if (LIST_KEYS.has(last)) {
      const list = fields[last];
      list[list.length - 1] += `\n${line}`;
    } else {
      fields[last] = `${fields[last] ?? ''}\n${line}`;
    }
  }

  const question = fields.question.trim();
  const explain = fields.explain.trim();
  const choices = fields.choice.map((c) => c.trim());
  const answer = fields.answer?.trim() ?? null;
  if (!question) throw new Error('A prediction needs a question:');
  if (!explain) throw new Error(`Prediction "${question}" needs an explain:`);

  let kind = 'open';
  if (choices.length) {
    kind = 'choice';
    if (choices.length < 2) throw new Error(`Prediction "${question}" needs at least two choices`);
    if (!choices.includes(answer)) throw new Error(`Prediction "${question}": answer must repeat one choice exactly`);
  } else if (answer != null) {
    kind = 'number';
    if (!Number.isFinite(parseNumber(answer))) throw new Error(`Prediction "${question}": answer "${answer}" is not a number`);
  }
  const tolerance = fields.tolerance == null ? 0 : Number(fields.tolerance.trim());
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error(`Prediction "${question}": bad tolerance`);

  return { kind, question, choices, answer, tolerance, explain, verify: fields.verify?.trim() || null };
}

// Accepts 0.25, -3, 1e-3 and simple fractions such as 1/4. Nothing is evaluated.
export function parseNumber(text) {
  const t = String(text).trim();
  const fraction = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}

export function isCorrect(prediction, response) {
  if (prediction.kind === 'choice') return response === prediction.answer;
  if (prediction.kind === 'number') {
    const value = parseNumber(response);
    const want = parseNumber(prediction.answer);
    return Number.isFinite(value) && Math.abs(value - want) <= prediction.tolerance + 1e-9 * Math.max(1, Math.abs(want));
  }
  return null;
}

// Where a prediction sat in the step's text: parseTrack replaces each fence with this marker.
export const MARKER = (i) => `@@predict-${i}@@`;
export const MARKER_SPLIT = /^@@predict-(\d+)@@$/m;
