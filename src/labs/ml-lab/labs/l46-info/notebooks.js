// Lab 46 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The distributions, relationships and text are the playground's; SciPy and scikit-learn supply reference values.

export const extras = {
  'l46-entropy': {
    formulaTex: '$$\\begin{aligned} I(x) &= -\\log_2 p(x) \\\\ H(p) &= -\\textstyle\\sum_x p(x)\\log_2 p(x), \\quad 0 \\le H \\le \\log_2 K \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$-\\log_2 p$', '-np.log2(1 / 8)', 'Surprise of one outcome, in bits.'],
        ['$H(p)$', '-np.sum(p * np.log(p)) / np.log(base)', 'Average surprise; base 2 for bits, e for nats.'],
      ],
    },
    notebook: {
      title: 'Lab 46.1 · Surprise and entropy',
      intro: 'Entropy of five distributions in bits and nats, checked against SciPy.',
      cells: [
        {
          title: 'Entropy',
          prose: '**Predict** the entropy of a source that almost always passes.',
          code: `import numpy as np
from scipy.stats import entropy as scipy_entropy
def H(p, base=2):
    p = np.asarray(p, float); p = p[p > 0]
    return max(0.0, -np.sum(p * np.log(p)) / np.log(base))
for name, p in [("fair coin", [0.5, 0.5]), ("CI log (passed, failed, flaky, timeout)", [0.5, 0.25, 0.125, 0.125]),
                ("four equal outcomes", [0.25] * 4), ("almost always passes", [0.97, 0.01, 0.01, 0.01]), ("certain", [1, 0, 0, 0])]:
    print(f"{name:42s} H = {H(p):.3f} bits = {H(p, np.e):.3f} nats   (scipy: {scipy_entropy(p, base=2):.3f})")
print(f"surprise of a timeout at 1/8: {-np.log2(1 / 8):.0f} bits; of a pass at 1/2: {-np.log2(1 / 2):.0f} bit")
print(f"1 nat = {1 / np.log(2):.4f} bits")`,
        },
      ],
    },
  },
  'l46-coding': {
    formulaTex: '$$\\begin{aligned} H(p) &\\le \\bar L_{\\mathrm{Huffman}} < H(p) + 1 \\\\ \\ell(x) &= -\\log_2 p(x) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['Huffman', 'heapq: merge the two least likely nodes', 'Codeword length = depth in the tree.'],
        ['$\\bar L$', 'sum(p_i * L_i)', 'Average bits per outcome.'],
        ['zlib', 'zlib.compress(data, 9)', 'A general-purpose compressor for comparison.'],
      ],
    },
    notebook: {
      title: 'Lab 46.2 · Entropy is the limit of compression',
      intro: 'Huffman codes against the entropy for three sources, and a real compressor on the playground’s text.',
      cells: [
        {
          title: 'Huffman and zlib',
          prose: '**Predict** when Huffman’s average equals the entropy exactly.',
          code: `TEXT = "machine learning systems learn patterns from data rather than following rules written by hand. a model makes predictions, we measure how wrong they are with a loss, and an optimizer adjusts the parameters to reduce that loss. good practice keeps a test set aside, compares every model with a simple baseline, and reports uncertainty honestly. information theory explains why the logarithmic loss is natural: it counts the bits a model needs to describe the data it sees. a model that predicts the next character well compresses text well, and a model that compresses well has learned the structure of its data. entropy measures the unavoidable surprise in a source, cross entropy measures the surprise of a model, and the gap between them is the divergence the model could still remove by learning."

import heapq, zlib
import numpy as np
def huffman_lengths(p):
    heap = [(w, [i]) for i, w in enumerate(p)]; heapq.heapify(heap); length = [0] * len(p)
    while len(heap) > 1:
        w1, s1 = heapq.heappop(heap); w2, s2 = heapq.heappop(heap)   # merge the two least likely nodes
        for i in s1 + s2: length[i] += 1
        heapq.heappush(heap, (w1 + w2, s1 + s2))
    return length
H = lambda p: -sum(v * np.log2(v) for v in p if v > 0)
for p in [[0.5, 0.25, 0.125, 0.125], [0.4, 0.3, 0.2, 0.1], [0.9, 0.05, 0.03, 0.02]]:
    L = huffman_lengths(p)
    print(f"p = {p}: code lengths {L}, average {sum(a * b for a, b in zip(p, L)):.3f} bits, entropy {H(p):.3f}")

# A general-purpose compressor on the playground's text, against its letter-frequency entropy.
chars = [c for c in TEXT.lower() if c in "abcdefghijklmnopqrstuvwxyz "]
counts = np.array([chars.count(c) for c in "abcdefghijklmnopqrstuvwxyz "]); p = counts / counts.sum()
data = "".join(chars).encode()
print(f"{len(chars)} characters: 8 bits each as ASCII; letter-frequency entropy {H(p):.2f} bits; zlib {8 * len(zlib.compress(data, 9)) / len(chars):.2f} bits (it also exploits repeated words)")`,
        },
      ],
    },
  },
  'l46-kl': {
    formulaTex: '$$\\begin{aligned} H(p, q) &= -\\textstyle\\sum p \\log q \\\\ \\mathrm{KL}(p \\Vert q) &= H(p, q) - H(p) \\ge 0 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$H(p, q)$', '-np.sum(p * np.log2(q))', 'Average cost of coding p with a code built for q.'],
        ['KL', 'np.sum(p * np.log2(p / q))', 'The extra cost; not symmetric.'],
        ['log-loss', '-np.mean(y * np.log(prob) + (1 - y) * np.log(1 - prob))', 'Cross-entropy between labels and model (sklearn uses nats).'],
      ],
    },
    notebook: {
      title: 'Lab 46.3 · Cross-entropy and KL divergence',
      intro: 'Cross-entropy and both KLs for a q that neglects one outcome, and log-loss checked against scikit-learn.',
      cells: [
        {
          title: 'Cross-entropy, KL and log-loss',
          prose: '**Predict** which KL is larger when q gives “timeout” almost nothing.',
          code: `import numpy as np
from sklearn.metrics import log_loss
cross = lambda p, q: -np.sum(np.asarray(p) * np.log2(q))
KL = lambda p, q: np.sum(np.asarray(p) * np.log2(np.asarray(p) / np.asarray(q)))
p = np.array([0.5, 0.25, 0.13, 0.12]); q = np.array([0.6, 0.35, 0.049, 0.001])   # q gives "timeout" almost nothing
Hp = -np.sum(p * np.log2(p))
print(f"H(p) {Hp:.3f}, H(p, q) {cross(p, q):.3f}, KL(p || q) = {cross(p, q) - Hp:.3f} bits (direct {KL(p, q):.3f})")
print(f"KL(q || p) = {KL(q, p):.3f} bits — not symmetric: q ignoring an outcome p makes common is what explodes KL(p || q)")

# Log-loss is the cross-entropy between the labels and the model: scikit-learn in nats, here in bits.
y = np.array([0, 1, 1, 0, 1]); prob = np.array([0.1, 0.8, 0.6, 0.3, 0.99])
mine = -np.mean(y * np.log(prob) + (1 - y) * np.log(1 - prob))
print(f"log-loss by hand {mine:.4f} nats = {mine / np.log(2):.4f} bits; scikit-learn {log_loss(y, prob):.4f} nats")
for q_true in [0.5, 0.25, 0.01]:
    print(f"true class given probability {q_true}: costs {-np.log2(q_true):.2f} bits")`,
        },
      ],
    },
  },
  'l46-mi': {
    formulaTex: '$$\\begin{aligned} I(X; Y) &= H(Y) - H(Y \\mid X) \\\\ &= \\textstyle\\sum_{x,y} p(x, y)\\log\\frac{p(x, y)}{p(x)\\,p(y)} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['binned MI', 'np.histogram2d(x, y, bins=[qx, qy])', 'Plug-in estimate on equal-frequency bins.'],
        ['shuffled', 'rng.permutation(y)', 'Break the pairing: any MI left is estimator bias.'],
        ['kNN MI', 'mutual_info_regression(x[:, None], y)', 'A nearest-neighbour estimator (nats; converted to bits).'],
      ],
    },
    notebook: {
      title: 'Lab 46.4 · Mutual information',
      intro: 'Correlation, binned MI with shuffled baselines at 8 and 20 bins, and scikit-learn’s estimator, for four relationships.',
      cells: [
        {
          title: 'MI against correlation',
          prose: '**Predict** the correlation and the MI of the U-shape.',
          code: `import numpy as np
from sklearn.feature_selection import mutual_info_regression
rng = np.random.default_rng(46)
x = rng.uniform(-2, 2, 600)
relations = {"linear": x + 0.5 * rng.normal(size=600), "U-shape": x ** 2 + 0.3 * rng.normal(size=600),
             "wave": np.sin(3 * x) + 0.3 * rng.normal(size=600), "independent": rng.normal(size=600)}
def mi_binned(x, y, bins):
    qx = np.quantile(x, np.linspace(0, 1, bins + 1)); qy = np.quantile(y, np.linspace(0, 1, bins + 1))
    J, _, _ = np.histogram2d(x, y, bins=[qx, qy]); P = J / J.sum()
    px, py = P.sum(1, keepdims=True), P.sum(0, keepdims=True); nz = P > 0
    return np.sum(P[nz] * np.log2(P[nz] / (px @ py)[nz]))
print("relation      correlation   MI 8 bins   shuffled   MI 20 bins   shuffled   kNN MI (sklearn, bits)")
for name, y in relations.items():
    ys = rng.permutation(y)                                   # break the pairing: any MI left is estimator bias
    knn = mutual_info_regression(x[:, None], y, random_state=0)[0] / np.log(2)
    print(f"{name:12s}    {np.corrcoef(x, y)[0, 1]:+.3f}       {mi_binned(x, y, 8):.3f}      {mi_binned(x, ys, 8):.3f}      {mi_binned(x, y, 20):.3f}      {mi_binned(x, ys, 20):.3f}      {knn:.3f}")`,
        },
      ],
    },
  },
  'l46-ml': {
    formulaTex: '$$\\mathrm{perplexity} = 2^{H(p, q)\\ \\text{in bits per token}}$$',
    mathCode: {
      rows: [
        ['perplexity', '2 ** np.mean(bits)', 'Effective number of equally likely choices per character.'],
        ['add-one smoothing', '(pair[(a, b)] + 1) / (prev[a] + 27)', 'Keeps unseen pairs possible.'],
        ['label smoothing', 'target = [0.9, 0.05, 0.05]', 'Limits how far log-loss rewards certainty.'],
      ],
    },
    notebook: {
      title: 'Lab 46.5 · Information theory across machine learning',
      intro: 'Perplexity of three character models on the training text and on a new passage, and label smoothing.',
      cells: [
        {
          title: 'Perplexity and smoothing',
          prose: '**Predict** what an unsmoothed previous-letter model scores on a new passage.',
          code: `TEXT = "machine learning systems learn patterns from data rather than following rules written by hand. a model makes predictions, we measure how wrong they are with a loss, and an optimizer adjusts the parameters to reduce that loss. good practice keeps a test set aside, compares every model with a simple baseline, and reports uncertainty honestly. information theory explains why the logarithmic loss is natural: it counts the bits a model needs to describe the data it sees. a model that predicts the next character well compresses text well, and a model that compresses well has learned the structure of its data. entropy measures the unavoidable surprise in a source, cross entropy measures the surprise of a model, and the gap between them is the divergence the model could still remove by learning."

import numpy as np
from collections import Counter
ALPHA = "abcdefghijklmnopqrstuvwxyz "
clean = lambda t: [c for c in t.lower() if c in ALPHA]
train = clean(TEXT)
held_out = clean("a good baseline is simple and honest. the loss tells us how surprised the model is by data it has not seen before, and a lower loss means a better model.")
uni = Counter(train); pair = Counter(zip(train, train[1:])); prev = Counter(train[:-1])
p_uni = lambda c: (uni[c] + 1) / (len(train) + 27)                    # add-one smoothing so unseen characters are possible
p_bi = lambda a, b: (pair[(a, b)] + 1) / (prev[a] + 27)
def perplexity(text, model):
    bits = [-np.log2(1 / 27) if model == "uniform" else -np.log2(p_uni(c)) if model == "letters" else -np.log2(p_bi(a, c))
            for a, c in zip([" "] + text[:-1], text)]
    return 2 ** np.mean(bits)
raw_bigram = 2 ** -np.mean([np.log2(pair[(a, b)] / prev[a]) for a, b in zip(train, train[1:])])
unseen = sum(pair[(a, b)] == 0 for a, b in zip(held_out, held_out[1:]))
print(f"previous-letter model WITHOUT smoothing: training perplexity {raw_bigram:.1f} (the playground's number); "
      f"the new passage has {unseen} letter pairs never seen in training, each with probability 0 -> infinite perplexity")
print("with add-one smoothing:")
for model in ["uniform", "letters", "previous letter"]:
    print(f"{model:16s} perplexity: training text {perplexity(train, model):5.1f}   a new passage {perplexity(held_out, model):5.1f}")

print(f"perplexity 32 -> 16 is {np.log2(32) - np.log2(16):.0f} bit per token less cross-entropy")
# Label smoothing: the loss of a very confident correct prediction against a hard and a smoothed target (3 classes).
q = np.array([0.999, 0.0005, 0.0005])
for target in [np.array([1, 0, 0]), np.array([0.9, 0.05, 0.05])]:
    print(f"target {target}: loss of q = {q} is {-np.sum(target * np.log2(q)):.3f} bits")`,
        },
      ],
    },
  },
}
