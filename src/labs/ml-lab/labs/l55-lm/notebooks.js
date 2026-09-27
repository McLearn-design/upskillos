// Lab 55 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// Cells 55.1–55.4 use the playground's own corpus and split; the n-gram, interpolation and BPE code reproduce the
// playground's numbers exactly. The neural model is a NumPy copy with NumPy random draws. 55.5 needs no corpus.

export const extras = {
  'l55-chain': {
    formulaTex: '$$\\begin{aligned} p(x_1 \\dots x_T) &= \\textstyle\\prod_t p(x_t \\mid x_{<t}) \\\\ \\text{bits/token} &= -\\tfrac1T \\textstyle\\sum_t \\log_2 p(x_t \\mid x_{<t}) \\\\ \\text{perplexity} &= 2^{\\text{bits/token}} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\prod_t p(x_t \\mid x_{<t})$', 'np.prod(factors)', 'The chain rule for “the”.'],
        ['bits/char', 'bits_per_char(model, TEST)', 'Average −log₂ p of each actual next character.'],
        ['perplexity', '2 ** b', 'Effective number of equally likely choices.'],
      ],
    },
    notebook: {
      title: 'Lab 55.1 · What a language model is',
      intro: 'The chain rule on one word, and bits per character for uniform guessing and letter frequencies.',
      cells: [
        {
          title: 'Chain rule and perplexity',
          prose: '**Predict** the held-out perplexity of letter frequencies alone, against 28 for uniform guessing.',
          code: `import numpy as np
# The playground's corpus (written for this lab): 85% for training, the last 15% held out.
CORPUS = "\\n".join([
    "the build started at nine and finished at ten. the tests ran after the build, and the tests passed. then the "
    "team looked at the logs, because a passing test is not the same as a correct program. the logs showed a slow "
    "step in the middle of the build. the slow step read the same files again and again. the team cached the files,"
    " and the build finished much sooner. after that the tests ran faster too, and the team had more time to read "
    "the results.",
    "a good test checks one idea at a time. when a test fails, the message should say what was expected and what "
    "was found. the team wrote the message first and the test second, so every failure would explain itself. they "
    "kept the tests small, and they kept the data for each test next to the test. when the data changed, the test "
    "changed with it, and nobody had to guess why a number moved.",
    "the model learned from the logs of past builds. it read the size of each change, the files that were touched, "
    "and the time of day. then it guessed how long the next build would take. the guess was not always right, but "
    "it was better than the old rule, which said every build took one hour. the team checked the model every week "
    "against new builds, and they wrote down each time the model was wrong by more than ten minutes.",
    "one week the model was wrong every day. the team looked at the new builds and found a new kind of change that "
    "the model had never seen. the data had drifted. they added the new builds to the training data, trained the "
    "model again, and compared the new model with the old one on the same week. the new model was better, so they "
    "kept it, and they wrote down what had happened so the next person would know.",
    "the team liked to say that a model is a guess with a history. the history is the data, and the guess is only "
    "as good as the data behind it. when the data are old, the guess is old. when the data are wrong, the guess is "
    "wrong. so they read the data before they read the model, and they read the model before they trusted it.",
    "at the end of the year the team wrote a short report. it said what the model did well, where it failed, and "
    "what they would change. the report was short because they had written notes all year. every note said what "
    "they tried, what they expected, and what they saw. the notes made the report easy, and the report made the "
    "next year easier.",
])
SPLIT = int(len(CORPUS) * 0.85)
TRAIN, TEST = CORPUS[:SPLIT], CORPUS[SPLIT:]
VOCAB = sorted(set(CORPUS)); V = len(VOCAB); IDX = {c: i for i, c in enumerate(VOCAB)}

def ngram(text, n, k):
    """Add-k smoothed character n-gram: p(c | the previous n - 1 characters)."""
    counts, ctx_counts = {}, {}
    for i in range(n - 1, len(text)):
        ctx, c = text[i - n + 1:i], text[i]
        counts[ctx, c] = counts.get((ctx, c), 0) + 1; ctx_counts[ctx] = ctx_counts.get(ctx, 0) + 1
    def prob(ctx, c):
        den = ctx_counts.get(ctx, 0) + k * V
        return (counts.get((ctx, c), 0) + k) / den if den else 0.0
    prob.seen = lambda ctx: ctx_counts.get(ctx, 0) > 0
    prob.n = n
    return prob

def bits_per_char(prob, text, n=None):
    n = n or prob.n; p = np.array([prob(text[i - n + 1:i], text[i]) for i in range(n - 1, len(text))])
    with np.errstate(divide='ignore'): return float(np.mean(-np.log2(p)))

def interpolated(text, n):
    """Mix orders 1..n with weights proportional to 1, 2, ..., n, skipping orders whose context was never seen;
    a 0.1% uniform floor keeps every probability positive (as in the playground)."""
    models = [ngram(text, o + 1, 0) for o in range(n)]; w = [(o + 1) / (n * (n + 1) / 2) for o in range(n)]
    def prob(ctx, c):
        p = tot = 0.0
        for o, m in enumerate(models):
            sub = ctx[len(ctx) - o:] if o else ''
            if o == 0 or m.seen(sub): p += w[o] * m(sub, c); tot += w[o]
        return 0.999 * p / tot + 0.001 / V
    prob.n = n
    return prob

# The chain rule: p("the") = p(t) p(h | t) p(e | th). Score it with a trigram model (add-k, k = 0.1) trained on TRAIN.
tri = ngram(TRAIN, 3, 0.1); uni = ngram(TRAIN, 1, 0.1); bi = ngram(TRAIN, 2, 0.1)
factors = [uni('', 't'), bi('t', 'h'), tri('th', 'e')]
print(f"p(t) = {factors[0]:.4f}, p(h | t) = {factors[1]:.4f}, p(e | th) = {factors[2]:.4f}")
print(f"p('the') = {np.prod(factors):.5f}  = 2^-{-np.sum(np.log2(factors)):.3f}  ({-np.mean(np.log2(factors)):.3f} bits per character)")

# Bits per character and perplexity on held-out text: uniform guessing against letter frequencies (a unigram model).
print(f"{V} characters: uniform guessing costs log2({V}) = {np.log2(V):.3f} bits, perplexity {V}")
for name, text in (('training', TRAIN), ('held-out', TEST)):
    b = bits_per_char(ngram(TRAIN, 1, 0), text)
    print(f"unigram on {name} text: {b:.3f} bits per character, perplexity {2 ** b:.2f}")`,
        },
      ],
    },
  },
  'l55-tokens': {
    formulaTex: '$$\\begin{aligned} &\\text{repeat:} \\\\ &(a, b) = \\arg\\max_{\\text{adjacent pairs}} \\mathrm{count}(a, b) \\\\ &\\text{merge } (a, b) \\to ab \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\arg\\max$ count', 'max(counts.values()); min(p for p, c in counts.items() if c == top)', 'Most frequent pair; ties to the alphabetically first.'],
        ['$ab$', 'merge(w, a, b)', 'Replace every adjacent (a, b) with one token.'],
      ],
    },
    notebook: {
      title: 'Lab 55.2 · Tokenization',
      intro: 'Byte-pair encoding learned on the training text and applied to the held-out text.',
      cells: [
        {
          title: 'Byte-pair encoding',
          prose: '**Predict** how many characters per token 200 merges give on this tiny corpus.',
          code: `import numpy as np
# The playground's corpus (written for this lab): 85% for training, the last 15% held out.
CORPUS = "\\n".join([
    "the build started at nine and finished at ten. the tests ran after the build, and the tests passed. then the "
    "team looked at the logs, because a passing test is not the same as a correct program. the logs showed a slow "
    "step in the middle of the build. the slow step read the same files again and again. the team cached the files,"
    " and the build finished much sooner. after that the tests ran faster too, and the team had more time to read "
    "the results.",
    "a good test checks one idea at a time. when a test fails, the message should say what was expected and what "
    "was found. the team wrote the message first and the test second, so every failure would explain itself. they "
    "kept the tests small, and they kept the data for each test next to the test. when the data changed, the test "
    "changed with it, and nobody had to guess why a number moved.",
    "the model learned from the logs of past builds. it read the size of each change, the files that were touched, "
    "and the time of day. then it guessed how long the next build would take. the guess was not always right, but "
    "it was better than the old rule, which said every build took one hour. the team checked the model every week "
    "against new builds, and they wrote down each time the model was wrong by more than ten minutes.",
    "one week the model was wrong every day. the team looked at the new builds and found a new kind of change that "
    "the model had never seen. the data had drifted. they added the new builds to the training data, trained the "
    "model again, and compared the new model with the old one on the same week. the new model was better, so they "
    "kept it, and they wrote down what had happened so the next person would know.",
    "the team liked to say that a model is a guess with a history. the history is the data, and the guess is only "
    "as good as the data behind it. when the data are old, the guess is old. when the data are wrong, the guess is "
    "wrong. so they read the data before they read the model, and they read the model before they trusted it.",
    "at the end of the year the team wrote a short report. it said what the model did well, where it failed, and "
    "what they would change. the report was short because they had written notes all year. every note said what "
    "they tried, what they expected, and what they saw. the notes made the report easy, and the report made the "
    "next year easier.",
])
SPLIT = int(len(CORPUS) * 0.85)
TRAIN, TEST = CORPUS[:SPLIT], CORPUS[SPLIT:]
VOCAB = sorted(set(CORPUS)); V = len(VOCAB); IDX = {c: i for i, c in enumerate(VOCAB)}

def ngram(text, n, k):
    """Add-k smoothed character n-gram: p(c | the previous n - 1 characters)."""
    counts, ctx_counts = {}, {}
    for i in range(n - 1, len(text)):
        ctx, c = text[i - n + 1:i], text[i]
        counts[ctx, c] = counts.get((ctx, c), 0) + 1; ctx_counts[ctx] = ctx_counts.get(ctx, 0) + 1
    def prob(ctx, c):
        den = ctx_counts.get(ctx, 0) + k * V
        return (counts.get((ctx, c), 0) + k) / den if den else 0.0
    prob.seen = lambda ctx: ctx_counts.get(ctx, 0) > 0
    prob.n = n
    return prob

def bits_per_char(prob, text, n=None):
    n = n or prob.n; p = np.array([prob(text[i - n + 1:i], text[i]) for i in range(n - 1, len(text))])
    with np.errstate(divide='ignore'): return float(np.mean(-np.log2(p)))

def interpolated(text, n):
    """Mix orders 1..n with weights proportional to 1, 2, ..., n, skipping orders whose context was never seen;
    a 0.1% uniform floor keeps every probability positive (as in the playground)."""
    models = [ngram(text, o + 1, 0) for o in range(n)]; w = [(o + 1) / (n * (n + 1) / 2) for o in range(n)]
    def prob(ctx, c):
        p = tot = 0.0
        for o, m in enumerate(models):
            sub = ctx[len(ctx) - o:] if o else ''
            if o == 0 or m.seen(sub): p += w[o] * m(sub, c); tot += w[o]
        return 0.999 * p / tot + 0.001 / V
    prob.n = n
    return prob
import re

def learn_bpe(text, merges):
    """Repeatedly merge the most frequent adjacent pair (never across whitespace); ties go to the alphabetically first pair.
    Stops early when no pair occurs more than once."""
    words = [list(w) for w in re.split(r'(\\s+)', text) if w]; rules = []
    for _ in range(merges):
        counts = {}
        for w in words:
            for a, b in zip(w, w[1:]):
                if not (a.isspace() or b.isspace()): counts[a, b] = counts.get((a, b), 0) + 1
        if not counts or max(counts.values()) < 2: break
        top = max(counts.values()); a, b = min(p for p, c in counts.items() if c == top)
        rules.append((a, b)); words = [merge(w, a, b) for w in words]
    return rules

def merge(w, a, b):
    out, i = [], 0
    while i < len(w):
        if i + 1 < len(w) and w[i] == a and w[i + 1] == b: out.append(a + b); i += 2
        else: out.append(w[i]); i += 1
    return out

def apply_bpe(text, rules):
    words = [list(w) for w in re.split(r'(\\s+)', text) if w]
    for a, b in rules: words = [merge(w, a, b) for w in words]
    return [t for w in words for t in w]

rules = learn_bpe(TRAIN, 200)
print(f"asked for 200 merges, learned {len(rules)}; the first twelve: {', '.join(a + '+' + b for a, b in rules[:12])}")
for m in (0, 40, 100, len(rules)):
    toks = apply_bpe(TEST, rules[:m])
    print(f"{m:3d} merges: held-out text {len(TEST)} characters -> {len(toks)} tokens ({len(TEST) / len(toks):.2f} characters per token)")
print('tokens:', [t for t in apply_bpe('the model read the data and the tests', rules) if not t.isspace()])`,
        },
      ],
    },
  },
  'l55-ngram': {
    formulaTex: '$$\\begin{aligned} p(c \\mid \\text{ctx}) &= \\frac{\\mathrm{count}(\\text{ctx}, c) + k}{\\mathrm{count}(\\text{ctx}) + kV} \\\\ p_{\\text{interp}} &= \\textstyle\\sum_o \\lambda_o\\, p_o(c \\mid \\text{last } o - 1) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['add-k', 'ngram(TRAIN, n, 0.1)', 'k = 0.1 added to every count.'],
        ['$\\lambda_o$', '(o + 1) / (n * (n + 1) / 2)', 'Interpolation weights, favouring longer contexts.'],
      ],
    },
    notebook: {
      title: 'Lab 55.3 · n-gram models and smoothing',
      intro: 'The playground’s table: training and held-out bits for every order and smoothing method.',
      cells: [
        {
          title: 'Smoothing table',
          prose: '**Predict** at which order add-k’s held-out bits start rising.',
          code: `import numpy as np
# The playground's corpus (written for this lab): 85% for training, the last 15% held out.
CORPUS = "\\n".join([
    "the build started at nine and finished at ten. the tests ran after the build, and the tests passed. then the "
    "team looked at the logs, because a passing test is not the same as a correct program. the logs showed a slow "
    "step in the middle of the build. the slow step read the same files again and again. the team cached the files,"
    " and the build finished much sooner. after that the tests ran faster too, and the team had more time to read "
    "the results.",
    "a good test checks one idea at a time. when a test fails, the message should say what was expected and what "
    "was found. the team wrote the message first and the test second, so every failure would explain itself. they "
    "kept the tests small, and they kept the data for each test next to the test. when the data changed, the test "
    "changed with it, and nobody had to guess why a number moved.",
    "the model learned from the logs of past builds. it read the size of each change, the files that were touched, "
    "and the time of day. then it guessed how long the next build would take. the guess was not always right, but "
    "it was better than the old rule, which said every build took one hour. the team checked the model every week "
    "against new builds, and they wrote down each time the model was wrong by more than ten minutes.",
    "one week the model was wrong every day. the team looked at the new builds and found a new kind of change that "
    "the model had never seen. the data had drifted. they added the new builds to the training data, trained the "
    "model again, and compared the new model with the old one on the same week. the new model was better, so they "
    "kept it, and they wrote down what had happened so the next person would know.",
    "the team liked to say that a model is a guess with a history. the history is the data, and the guess is only "
    "as good as the data behind it. when the data are old, the guess is old. when the data are wrong, the guess is "
    "wrong. so they read the data before they read the model, and they read the model before they trusted it.",
    "at the end of the year the team wrote a short report. it said what the model did well, where it failed, and "
    "what they would change. the report was short because they had written notes all year. every note said what "
    "they tried, what they expected, and what they saw. the notes made the report easy, and the report made the "
    "next year easier.",
])
SPLIT = int(len(CORPUS) * 0.85)
TRAIN, TEST = CORPUS[:SPLIT], CORPUS[SPLIT:]
VOCAB = sorted(set(CORPUS)); V = len(VOCAB); IDX = {c: i for i, c in enumerate(VOCAB)}

def ngram(text, n, k):
    """Add-k smoothed character n-gram: p(c | the previous n - 1 characters)."""
    counts, ctx_counts = {}, {}
    for i in range(n - 1, len(text)):
        ctx, c = text[i - n + 1:i], text[i]
        counts[ctx, c] = counts.get((ctx, c), 0) + 1; ctx_counts[ctx] = ctx_counts.get(ctx, 0) + 1
    def prob(ctx, c):
        den = ctx_counts.get(ctx, 0) + k * V
        return (counts.get((ctx, c), 0) + k) / den if den else 0.0
    prob.seen = lambda ctx: ctx_counts.get(ctx, 0) > 0
    prob.n = n
    return prob

def bits_per_char(prob, text, n=None):
    n = n or prob.n; p = np.array([prob(text[i - n + 1:i], text[i]) for i in range(n - 1, len(text))])
    with np.errstate(divide='ignore'): return float(np.mean(-np.log2(p)))

def interpolated(text, n):
    """Mix orders 1..n with weights proportional to 1, 2, ..., n, skipping orders whose context was never seen;
    a 0.1% uniform floor keeps every probability positive (as in the playground)."""
    models = [ngram(text, o + 1, 0) for o in range(n)]; w = [(o + 1) / (n * (n + 1) / 2) for o in range(n)]
    def prob(ctx, c):
        p = tot = 0.0
        for o, m in enumerate(models):
            sub = ctx[len(ctx) - o:] if o else ''
            if o == 0 or m.seen(sub): p += w[o] * m(sub, c); tot += w[o]
        return 0.999 * p / tot + 0.001 / V
    prob.n = n
    return prob

zeros = sum(ngram(TRAIN, 2, 0)(TEST[i - 1], TEST[i]) == 0 for i in range(1, len(TEST)))
print(f"held-out character pairs the bigram model never saw: {zeros}")
print(" n | no smoothing (train / held-out) | add-k 0.1 (train / held-out) | interpolated (train / held-out)")
for n in range(1, 7):
    cols = []
    for m in (ngram(TRAIN, n, 0), ngram(TRAIN, n, 0.1), interpolated(TRAIN, n)):
        cols.append(f"{bits_per_char(m, TRAIN):5.3f} / {bits_per_char(m, TEST):5.3f}")
    print(f" {n} | {cols[0]:>31s} | {cols[1]:>28s} | {cols[2]:>31s}")`,
        },
      ],
    },
  },
  'l55-neural': {
    formulaTex: '$$\\begin{aligned} p_T(c) &\\propto p(c)^{1/T} \\\\ \\text{top-}k&: \\text{keep the } k \\text{ largest} \\\\ \\text{top-}p&: \\text{smallest set with } \\textstyle\\sum p \\ge p \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$p^{1/T}$', 'q = p ** (1 / T); q /= q.sum()', 'Temperature.'],
        ['top-k, top-p', 'filtered(p, top_k=2), filtered(p, top_p=0.9)', 'Cut the tail before sampling.'],
        ['softmax', 'np.tanh(X @ P[0] + P[1]) @ P[2] + P[3]', 'The neural model’s logits from one-hot context.'],
      ],
    },
    notebook: {
      title: 'Lab 55.4 · Neural language models and sampling',
      intro: 'Sampling controls on a real next-character distribution, generation at three temperatures, and a small neural model against the best n-gram.',
      cells: [
        {
          title: 'Sampling controls',
          prose: '**Predict** whether low temperature produces fluent copied text or repetitive loops.',
          code: `import numpy as np
# The playground's corpus (written for this lab): 85% for training, the last 15% held out.
CORPUS = "\\n".join([
    "the build started at nine and finished at ten. the tests ran after the build, and the tests passed. then the "
    "team looked at the logs, because a passing test is not the same as a correct program. the logs showed a slow "
    "step in the middle of the build. the slow step read the same files again and again. the team cached the files,"
    " and the build finished much sooner. after that the tests ran faster too, and the team had more time to read "
    "the results.",
    "a good test checks one idea at a time. when a test fails, the message should say what was expected and what "
    "was found. the team wrote the message first and the test second, so every failure would explain itself. they "
    "kept the tests small, and they kept the data for each test next to the test. when the data changed, the test "
    "changed with it, and nobody had to guess why a number moved.",
    "the model learned from the logs of past builds. it read the size of each change, the files that were touched, "
    "and the time of day. then it guessed how long the next build would take. the guess was not always right, but "
    "it was better than the old rule, which said every build took one hour. the team checked the model every week "
    "against new builds, and they wrote down each time the model was wrong by more than ten minutes.",
    "one week the model was wrong every day. the team looked at the new builds and found a new kind of change that "
    "the model had never seen. the data had drifted. they added the new builds to the training data, trained the "
    "model again, and compared the new model with the old one on the same week. the new model was better, so they "
    "kept it, and they wrote down what had happened so the next person would know.",
    "the team liked to say that a model is a guess with a history. the history is the data, and the guess is only "
    "as good as the data behind it. when the data are old, the guess is old. when the data are wrong, the guess is "
    "wrong. so they read the data before they read the model, and they read the model before they trusted it.",
    "at the end of the year the team wrote a short report. it said what the model did well, where it failed, and "
    "what they would change. the report was short because they had written notes all year. every note said what "
    "they tried, what they expected, and what they saw. the notes made the report easy, and the report made the "
    "next year easier.",
])
SPLIT = int(len(CORPUS) * 0.85)
TRAIN, TEST = CORPUS[:SPLIT], CORPUS[SPLIT:]
VOCAB = sorted(set(CORPUS)); V = len(VOCAB); IDX = {c: i for i, c in enumerate(VOCAB)}

def ngram(text, n, k):
    """Add-k smoothed character n-gram: p(c | the previous n - 1 characters)."""
    counts, ctx_counts = {}, {}
    for i in range(n - 1, len(text)):
        ctx, c = text[i - n + 1:i], text[i]
        counts[ctx, c] = counts.get((ctx, c), 0) + 1; ctx_counts[ctx] = ctx_counts.get(ctx, 0) + 1
    def prob(ctx, c):
        den = ctx_counts.get(ctx, 0) + k * V
        return (counts.get((ctx, c), 0) + k) / den if den else 0.0
    prob.seen = lambda ctx: ctx_counts.get(ctx, 0) > 0
    prob.n = n
    return prob

def bits_per_char(prob, text, n=None):
    n = n or prob.n; p = np.array([prob(text[i - n + 1:i], text[i]) for i in range(n - 1, len(text))])
    with np.errstate(divide='ignore'): return float(np.mean(-np.log2(p)))

def interpolated(text, n):
    """Mix orders 1..n with weights proportional to 1, 2, ..., n, skipping orders whose context was never seen;
    a 0.1% uniform floor keeps every probability positive (as in the playground)."""
    models = [ngram(text, o + 1, 0) for o in range(n)]; w = [(o + 1) / (n * (n + 1) / 2) for o in range(n)]
    def prob(ctx, c):
        p = tot = 0.0
        for o, m in enumerate(models):
            sub = ctx[len(ctx) - o:] if o else ''
            if o == 0 or m.seen(sub): p += w[o] * m(sub, c); tot += w[o]
        return 0.999 * p / tot + 0.001 / V
    prob.n = n
    return prob

def filtered(p, T=1.0, top_k=0, top_p=1.0):
    """Temperature p^(1/T), then keep the top-k tokens and/or the smallest set with total probability >= top_p."""
    q = p ** (1 / T); q /= q.sum(); order = np.argsort(-q); keep = np.zeros(len(q), bool)
    n_keep = len(q) if not top_k else top_k
    n_keep = min(n_keep, int(np.searchsorted(np.cumsum(q[order]), top_p - 1e-12)) + 1)
    keep[order[:n_keep]] = True; q = np.where(keep, q, 0); return q / q.sum()

m4 = interpolated(TRAIN, 4); p = np.array([m4('the', c) for c in VOCAB])
show = lambda q: ', '.join(f"'{VOCAB[i]}' {q[i]:.2f}" for i in np.argsort(-q)[:4] if q[i] > 0)
for label, q in (('T = 1', filtered(p)), ('T = 0.5', filtered(p, T=0.5)), ('T = 2', filtered(p, T=2)), ('top-k 2', filtered(p, top_k=2)), ('top-p 0.9', filtered(p, top_p=0.9))):
    print(f"after 'the', {label:9s}: {show(q)}   ({int((q > 0).sum())} tokens allowed)")

def generate(model, prompt, length, T, seed):
    rng = np.random.default_rng(seed); text = prompt
    for _ in range(length):
        q = filtered(np.array([model(text[len(text) - model.n + 1:], c) for c in VOCAB]), T=T); text += VOCAB[rng.choice(V, p=q)]
    return text

def longest_copy(text):
    best = 0
    for i in range(4, len(text)):
        while i + best < len(text) and text[i:i + best + 1] in TRAIN: best += 1
    return best

for T in (0.3, 1.0, 1.8):
    samples = [generate(m4, 'the ', 160, T, s) for s in (1, 2, 3)]
    print(f"\\nT = {T}: longest verbatim copy from the training text {[longest_copy(s) for s in samples]} characters")
    print('  ' + samples[0][:90].replace('\\n', ' / '))`,
        },
        {
          title: 'A neural language model',
          prose: '**Predict** whether any context length beats the interpolated 5-gram on this 2,000-character corpus.',
          code: `import numpy as np
# The playground's corpus (written for this lab): 85% for training, the last 15% held out.
CORPUS = "\\n".join([
    "the build started at nine and finished at ten. the tests ran after the build, and the tests passed. then the "
    "team looked at the logs, because a passing test is not the same as a correct program. the logs showed a slow "
    "step in the middle of the build. the slow step read the same files again and again. the team cached the files,"
    " and the build finished much sooner. after that the tests ran faster too, and the team had more time to read "
    "the results.",
    "a good test checks one idea at a time. when a test fails, the message should say what was expected and what "
    "was found. the team wrote the message first and the test second, so every failure would explain itself. they "
    "kept the tests small, and they kept the data for each test next to the test. when the data changed, the test "
    "changed with it, and nobody had to guess why a number moved.",
    "the model learned from the logs of past builds. it read the size of each change, the files that were touched, "
    "and the time of day. then it guessed how long the next build would take. the guess was not always right, but "
    "it was better than the old rule, which said every build took one hour. the team checked the model every week "
    "against new builds, and they wrote down each time the model was wrong by more than ten minutes.",
    "one week the model was wrong every day. the team looked at the new builds and found a new kind of change that "
    "the model had never seen. the data had drifted. they added the new builds to the training data, trained the "
    "model again, and compared the new model with the old one on the same week. the new model was better, so they "
    "kept it, and they wrote down what had happened so the next person would know.",
    "the team liked to say that a model is a guess with a history. the history is the data, and the guess is only "
    "as good as the data behind it. when the data are old, the guess is old. when the data are wrong, the guess is "
    "wrong. so they read the data before they read the model, and they read the model before they trusted it.",
    "at the end of the year the team wrote a short report. it said what the model did well, where it failed, and "
    "what they would change. the report was short because they had written notes all year. every note said what "
    "they tried, what they expected, and what they saw. the notes made the report easy, and the report made the "
    "next year easier.",
])
SPLIT = int(len(CORPUS) * 0.85)
TRAIN, TEST = CORPUS[:SPLIT], CORPUS[SPLIT:]
VOCAB = sorted(set(CORPUS)); V = len(VOCAB); IDX = {c: i for i, c in enumerate(VOCAB)}

def ngram(text, n, k):
    """Add-k smoothed character n-gram: p(c | the previous n - 1 characters)."""
    counts, ctx_counts = {}, {}
    for i in range(n - 1, len(text)):
        ctx, c = text[i - n + 1:i], text[i]
        counts[ctx, c] = counts.get((ctx, c), 0) + 1; ctx_counts[ctx] = ctx_counts.get(ctx, 0) + 1
    def prob(ctx, c):
        den = ctx_counts.get(ctx, 0) + k * V
        return (counts.get((ctx, c), 0) + k) / den if den else 0.0
    prob.seen = lambda ctx: ctx_counts.get(ctx, 0) > 0
    prob.n = n
    return prob

def bits_per_char(prob, text, n=None):
    n = n or prob.n; p = np.array([prob(text[i - n + 1:i], text[i]) for i in range(n - 1, len(text))])
    with np.errstate(divide='ignore'): return float(np.mean(-np.log2(p)))

def interpolated(text, n):
    """Mix orders 1..n with weights proportional to 1, 2, ..., n, skipping orders whose context was never seen;
    a 0.1% uniform floor keeps every probability positive (as in the playground)."""
    models = [ngram(text, o + 1, 0) for o in range(n)]; w = [(o + 1) / (n * (n + 1) / 2) for o in range(n)]
    def prob(ctx, c):
        p = tot = 0.0
        for o, m in enumerate(models):
            sub = ctx[len(ctx) - o:] if o else ''
            if o == 0 or m.seen(sub): p += w[o] * m(sub, c); tot += w[o]
        return 0.999 * p / tot + 0.001 / V
    prob.n = n
    return prob

def windows(text, ctx):
    """One-hot encodings of every ctx-character window, and the index of the character that follows it."""
    X = np.zeros((len(text) - ctx, ctx * V)); y = np.array([IDX[c] for c in text[ctx:]])
    for i in range(len(text) - ctx):
        for j, c in enumerate(text[i:i + ctx]): X[i, j * V + IDX[c]] = 1
    return X, y

def train_neural(ctx, epochs=6, hidden=48, lr=0.01, seed=1):
    """Context one-hots -> 48 tanh units -> softmax over the 28 characters; cross-entropy, Adam, batches of 64."""
    rng = np.random.default_rng(seed); X, y = windows(TRAIN, ctx); Xt, yt = windows(TEST, ctx)
    P = [rng.normal(0, np.sqrt(1 / (ctx * V)), (ctx * V, hidden)), np.zeros(hidden), rng.normal(0, np.sqrt(1 / hidden), (hidden, V)), np.zeros(V)]
    M, S = [0 * p for p in P], [0 * p for p in P]; t = 0; curve = []
    def bits(X, y):
        z = np.tanh(X @ P[0] + P[1]) @ P[2] + P[3]; z -= z.max(1, keepdims=True)
        return float(np.mean(np.log(np.exp(z).sum(1)) - z[np.arange(len(y)), y]) / np.log(2))
    for e in range(epochs):
        for b in np.array_split(rng.permutation(len(y)), int(np.ceil(len(y) / 64))):
            h = np.tanh(X[b] @ P[0] + P[1]); z = h @ P[2] + P[3]; q = np.exp(z - z.max(1, keepdims=True)); q /= q.sum(1, keepdims=True)
            q[np.arange(len(b)), y[b]] -= 1; g = q / len(b); gh = (g @ P[2].T) * (1 - h ** 2)
            G = [X[b].T @ gh, gh.sum(0), h.T @ g, g.sum(0)]; t += 1
            for i in range(4):
                M[i] = 0.9 * M[i] + 0.1 * G[i]; S[i] = 0.999 * S[i] + 0.001 * G[i] ** 2
                P[i] -= lr * (M[i] / (1 - 0.9 ** t)) / (np.sqrt(S[i] / (1 - 0.999 ** t)) + 1e-8)
        curve.append((bits(X, y), bits(Xt, yt)))
    return curve

best_ngram = bits_per_char(interpolated(TRAIN, 5), TEST)
for ctx in (2, 3, 5):
    curve = train_neural(ctx); e = int(np.argmin([c[1] for c in curve]))
    print(f"context {ctx}: held-out bits by epoch {[round(c[1], 2) for c in curve]}; best {curve[e][1]:.3f} at epoch {e + 1} (training {curve[e][0]:.2f})")
print(f"interpolated 5-gram: {best_ngram:.3f} held-out bits per character")`,
        },
      ],
    },
  },
  'l55-assistants': {
    formulaTex: '$$\\begin{aligned} W\' &= W + BA, \\quad A \\in \\mathbb R^{r \\times d},\\ B \\in \\mathbb R^{d \\times r} \\\\ \\mathcal L_{\\text{DPO}} &= -\\log\\sigma\\big(\\beta[\\Delta_w - \\Delta_l]\\big) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$BA$', 'B @ A', 'The low-rank update; W stays frozen.'],
        ['$2rd$', '2 * r * d', 'Trainable parameters for one d × d matrix.'],
        ['$\\mathcal L_{\\text{DPO}}$', '-np.log(sig(beta * (up - down)))', 'Log-probability changes of preferred and rejected answers, relative to the reference.'],
      ],
    },
    notebook: {
      title: 'Lab 55.5 · From language models to assistants',
      intro: 'LoRA’s parameter savings and a low-rank fit, then the DPO loss for a few preference pairs.',
      cells: [
        {
          title: 'LoRA and DPO',
          prose: '**Predict** the smallest rank that fits a rank-2 change down to the noise.',
          code: `import numpy as np

# LoRA: freeze W and learn a rank-r update BA. Parameter counts for one 4096 x 4096 matrix.
d = 4096
for r in (1, 8, 64):
    print(f"rank {r:2d}: {2 * r * d:>9,} trainable parameters against {d * d:,} ({2 * r * d / (d * d):.2%})")

# A small test: the 'fine-tuning' target differs from the frozen W by a rank-2 change plus a little noise.
rng = np.random.default_rng(55); d, n = 64, 400
W = rng.normal(0, 1 / np.sqrt(d), (d, d)); delta = rng.normal(size=(d, 2)) @ rng.normal(size=(2, d)) / d
X = rng.normal(size=(n, d)); Y = X @ (W + delta).T + 0.01 * rng.normal(size=(n, d))
for r in (1, 2, 4):
    A, B = 0.01 * rng.normal(size=(r, d)), np.zeros((d, r))          # B starts at zero, so training starts from W exactly
    for step in range(1500):
        R = X @ (W + B @ A).T - Y                                      # residuals; W itself never changes
        gB, gA = R.T @ X @ A.T / n, B.T @ R.T @ X / n
        B -= 0.05 * gB; A -= 0.05 * gA
    print(f"rank {r}: {B.size + A.size} trainable numbers, mean squared error {np.mean((X @ (W + B @ A).T - Y) ** 2):.5f} "
          f"(frozen W alone: {np.mean((X @ W.T - Y) ** 2):.5f}; noise floor 0.0001)")

# DPO: the loss for one preference pair, from log-probability changes relative to the reference model.
sig = lambda v: 1 / (1 + np.exp(-v))
for up, down, beta in ((0.4, -0.2, 1.0), (0.0, 0.0, 1.0), (1.5, -1.0, 1.0), (0.4, -0.2, 0.1)):
    margin = beta * (up - down)
    print(f"preferred {up:+.1f}, rejected {down:+.1f}, beta {beta}: margin {margin:.2f}, loss -log sig = {-np.log(sig(margin)):.3f}, "
          f"gradient on the margin {-(1 - sig(margin)):.3f}")`,
        },
      ],
    },
  },
}
