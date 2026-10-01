# LSTM and GRU

The last lesson ended with the plain RNN's weakness: the gradient that connects a late step to an early one is a product of one factor per step, so it shrinks exponentially, and the network cannot learn to use anything more than about ten steps back. The **long short-term memory** network (LSTM), invented in 1997, solves this with a simple but powerful idea: alongside the hidden state, keep a second vector, the **cell state**, which runs through time with nothing but element-wise multiplications and additions acting on it. Small learned **gates** decide, at every step, what to erase from it, what to write into it and what to read out of it. When the gates choose to keep something, it, and its gradient, can travel for hundreds of steps.

This lesson builds the LSTM cell, shows why its gradients survive, trains a plain RNN and an LSTM on a memory task in NumPy and compares them, and introduces the **GRU**, a simpler gated network that works about as well.

## Gates

A **gate** is a vector of numbers between 0 and 1, made by a sigmoid, that multiplies another vector element by element. A gate value of 1 lets that element through unchanged; 0 blocks it; 0.5 halves it. Because the gate is computed from the current input and hidden state, the network learns **when** to let things through.

## The LSTM cell

At each step the LSTM computes four vectors from the input xₜ and the previous hidden state hₜ₋₁, each with its own weights:

- the **forget gate** fₜ = σ(…): what to keep of the old cell state;
- the **input gate** iₜ = σ(…): how much of the new candidate to write;
- the **candidate** gₜ = tanh(…): new information that could be written;
- the **output gate** oₜ = σ(…): what to reveal as the hidden state.

Each "(…)" is xₜW + hₜ₋₁U + b with that vector's own W, U and b; in practice all four are computed at once with one big matrix and split. Then:

\[
c_t = f_t \odot c_{t-1} + i_t \odot g_t, \qquad h_t = o_t \odot \tanh(c_t)
\]

The cell state update is the heart of it. Forget some of the old memory, add some of the new, and nothing else: no weight matrix, no squashing function applied to cₜ₋₁ on its way to cₜ. The hidden state hₜ, which is what the next layer and the output see, is a gated view of the memory.

## Why the gradient survives

Follow the gradient backwards along the cell state. Since cₜ = fₜ ⊙ cₜ₋₁ + (terms not involving cₜ₋₁ directly), the gradient passes from cₜ to cₜ₋₁ multiplied by fₜ, element by element. Over many steps, it is multiplied by the forget gates' values, nothing more. If the network has learned to keep a memory (forget gate near 1), the gradient comes back almost undiminished; the plain RNN, by contrast, multiplies by W_h and a tanh derivative at every step. Because a forget gate value of exactly 1 would never be learned from scratch, LSTMs are usually initialised with a **forget gate bias of about 1 or 2**, so that σ(b) starts near 0.75–0.9 and memories are kept by default until the network learns to drop them.

Compare the surviving fraction after 50 steps. Predict first: if a plain RNN's factor is about 0.5 per step (as measured in the last lesson) and an LSTM's forget gate stays at 0.95, how big is each product?

```python
import numpy as np

for steps in [10, 50, 100]:
    print(f"{steps:>3} steps: plain RNN factor 0.5 → {0.5 ** steps:.1e}   LSTM forget gate 0.95 → {0.95 ** steps:.2f}   forget gate 0.99 → {0.99 ** steps:.2f}")
```

After 50 steps, 0.5 per step has shrunk the gradient to about 10⁻¹⁵; a forget gate of 0.95 keeps 8% of it, and one of 0.99 keeps 61%. The LSTM can still learn from something 50 or even 100 steps back.

## A memory test

Now train both kinds of network on a task that needs long memory. Each sequence starts with a signal, +2 or −2, followed by random noise; the label is simply which signal came first. The network must carry one bit of information through every noisy step to the end. Both networks below use 8 hidden units, read a 50-step sequence, predict from their final hidden state with a sigmoid, and train with Adam using backpropagation through time. Before running, predict: which network will get the answer right?

```python
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def make_data(n, T, rng):
    X = rng.normal(0, 1.0, (n, T))
    first = rng.choice([-1.0, 1.0], n)
    X[:, 0] = 2 * first
    return X[:, :, None], (first > 0).astype(float)

def run(kind, T, steps=250, H=8, lr=0.03, seed=0):
    rng = np.random.default_rng(seed)
    width = H if kind == "RNN" else 4 * H
    p = {"Wx": rng.normal(0, 0.5, (1, width)), "Wh": rng.normal(0, 1 / np.sqrt(H), (H, width)), "b": np.zeros(width),
         "v": rng.normal(0, 0.1, H), "c0": np.zeros(1)}
    if kind == "LSTM":
        p["b"][:H] = 2.0
    m = {k: np.zeros_like(v) for k, v in p.items()}
    s = {k: np.zeros_like(v) for k, v in p.items()}

    def forward(X):
        n = len(X)
        h, c, cache = np.zeros((n, H)), np.zeros((n, H)), []
        for t in range(T):
            z = X[:, t] @ p["Wx"] + h @ p["Wh"] + p["b"]
            if kind == "RNN":
                new_h = np.tanh(z)
                cache.append((h, new_h))
                h = new_h
            else:
                f, i, g, o = sigmoid(z[:, :H]), sigmoid(z[:, H:2 * H]), np.tanh(z[:, 2 * H:3 * H]), sigmoid(z[:, 3 * H:])
                new_c = f * c + i * g
                cache.append((h, c, f, i, g, o, new_c))
                h, c = o * np.tanh(new_c), new_c
        return h, cache

    for step in range(1, steps + 1):
        X, y = make_data(64, T, rng)
        h, cache = forward(X)
        prob = sigmoid(h @ p["v"] + p["c0"][0])
        d = (prob - y) / len(y)
        grads = {k: np.zeros_like(v) for k, v in p.items()}
        grads["v"], grads["c0"] = h.T @ d, np.array([d.sum()])
        dh, dc = np.outer(d, p["v"]), np.zeros_like(h)
        for t in reversed(range(T)):
            if kind == "RNN":
                h_prev, new_h = cache[t]
                dz = dh * (1 - new_h ** 2)
            else:
                h_prev, c_prev, f, i, g, o, new_c = cache[t]
                tanh_c = np.tanh(new_c)
                dc = dc + dh * o * (1 - tanh_c ** 2)
                dz = np.concatenate([dc * c_prev * f * (1 - f), dc * g * i * (1 - i),
                                     dc * i * (1 - g ** 2), dh * tanh_c * o * (1 - o)], axis=1)
                dc = dc * f
            grads["Wx"] += X[:, t].T @ dz
            grads["Wh"] += h_prev.T @ dz
            grads["b"] += dz.sum(axis=0)
            dh = dz @ p["Wh"].T
        for k in p:
            m[k] = 0.9 * m[k] + 0.1 * grads[k]
            s[k] = 0.999 * s[k] + 0.001 * grads[k] ** 2
            p[k] -= lr * (m[k] / (1 - 0.9 ** step)) / (np.sqrt(s[k] / (1 - 0.999 ** step)) + 1e-8)

    X_test, y_test = make_data(1000, T, np.random.default_rng(99))
    h, _ = forward(X_test)
    return ((sigmoid(h @ p["v"] + p["c0"][0]) > 0.5) == y_test).mean()

for kind in ["RNN", "LSTM"]:
    print(f"{kind:<4} on 50-step sequences: test accuracy {run(kind, 50):.3f}")
```

Both networks share one function: `kind` chooses between the plain tanh step and the LSTM step, whose four gates come out of a single matrix product (`z` has 4H columns, split into f, i, g and o). The backward pass is BPTT as in the last lesson, plus the cell state's own gradient `dc`. At each step `dc` collects the gradient arriving through hₜ = oₜ ⊙ tanh(cₜ), feeds the gradients of the four gate pre-activations (each gate's derivative is its effect on cₜ or hₜ times its sigmoid or tanh slope), and is multiplied by fₜ on its way back: exactly the surviving path described above. The forget-gate biases (the first H entries of `b`) start at 2.

The plain RNN ends at about 0.48: chance. It never learns that the answer was the very first input, because the gradient from the end of the sequence barely reaches step 0. The LSTM reaches about 0.99. Try other seeds (the `seed` argument): in our runs the RNN stayed near chance in three of four and reached 0.70 once, while the LSTM scored 0.97 or more every time. (On 5-step sequences both solve the task easily; the difference is entirely about distance.)

## The GRU

The **gated recurrent unit** (GRU), from 2014, simplifies the LSTM: no separate cell state, and two gates instead of three.

- The **update gate** zₜ = σ(…) decides how much of the state to replace.
- The **reset gate** rₜ = σ(…) decides how much of the old state to use when proposing the new one.
- The **candidate** h̃ₜ = tanh(xₜW + (rₜ ⊙ hₜ₋₁)U + b).
- The new state blends old and new: hₜ = (1 − zₜ) ⊙ hₜ₋₁ + zₜ ⊙ h̃ₜ.

When zₜ is near 0, the state is copied forward unchanged, giving the same protected path for gradients that the LSTM's forget gate provides. With three blocks of weights instead of four, a GRU has about three-quarters of an LSTM's parameters, and in practice the two perform similarly; which is better depends on the task.

## Where they stand

LSTMs and GRUs powered most of the progress in speech recognition, machine translation and text generation from about 2014 to 2018. Common extras: **stacking** several recurrent layers, each reading the hidden states of the one below; **bidirectional** networks, which read the sequence both forwards and backwards and combine the two, useful when the whole sequence is available at once (as in tagging the words of a sentence). For language they have since been largely replaced by transformers, which the next lessons build, because those process all positions at once rather than one step at a time and so train far faster on modern hardware. Recurrent networks remain in use for streaming data, small devices and many time-series problems.

::: challenge One LSTM step [easy]
Write `lstm_step(x, h, c, W, U, b)` for a batch: `x` has shape `(n, input_size)`, `h` and `c` have shape `(n, H)`, `W` has shape `(input_size, 4H)`, `U` has shape `(H, 4H)` and `b` has length 4H. Compute z = xW + hU + b, split its columns into four blocks of H in the order forget, input, candidate, output, and return the new `(h, c)`, using sigmoid for the three gates and tanh for the candidate.

```python starter
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def lstm_step(x, h, c, W, U, b):
    return h, c
```

```python solution
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def lstm_step(x, h, c, W, U, b):
    H = h.shape[1]
    z = x @ W + h @ U + b
    f = sigmoid(z[:, :H])
    i = sigmoid(z[:, H:2 * H])
    g = np.tanh(z[:, 2 * H:3 * H])
    o = sigmoid(z[:, 3 * H:])
    new_c = f * c + i * g
    return o * np.tanh(new_c), new_c
```

```python test
import numpy as _np
assert "lstm_step" in dir(), "Keep the function's name as lstm_step."
_s = lambda z: 1 / (1 + _np.exp(-z))
_r = _np.random.default_rng(0)
_x, _h, _c = _r.normal(size=(5, 3)), _r.normal(size=(5, 4)), _r.normal(size=(5, 4))
_W, _U, _b = _r.normal(size=(3, 16)), _r.normal(size=(4, 16)), _r.normal(size=16)
_nh, _nc = lstm_step(_x, _h, _c, _W, _U, _b)
_z = _x @ _W + _h @ _U + _b
_f, _i, _g, _o = _s(_z[:, :4]), _s(_z[:, 4:8]), _np.tanh(_z[:, 8:12]), _s(_z[:, 12:])
assert _np.shape(_nh) == (5, 4) and _np.shape(_nc) == (5, 4), "Both outputs should have shape (n, H)."
assert _np.allclose(_nc, _f * _c + _i * _g), "The new cell state should be f ⊙ c + i ⊙ g, with the blocks in the order forget, input, candidate, output."
assert _np.allclose(_nh, _o * _np.tanh(_nc)), "The new hidden state should be o ⊙ tanh(new c)."
_keep_b = _np.zeros(16); _keep_b[:4] = 50; _keep_b[4:8] = -50
_kh, _kc = lstm_step(_x, _h, _c, _np.zeros((3, 16)), _np.zeros((4, 16)), _keep_b)
assert _np.allclose(_kc, _c), "With the forget gate fully open and the input gate shut, the cell state should be carried over unchanged."
"SUCCESS: Forget, write, read: the cell state moves on with nothing but gating acting on it."
```

Hint: `H = h.shape[1]`; the four blocks are `z[:, :H]`, `z[:, H:2 * H]`, `z[:, 2 * H:3 * H]` and `z[:, 3 * H:]`.
:::

::: challenge One GRU step, and counting parameters [medium]
Write `gru_step(x, h, Wz, Uz, bz, Wr, Ur, br, Wc, Uc, bc)` for a batch, following the lesson's GRU equations: update gate z, reset gate r, candidate h̃ = tanh(xWc + (r ⊙ h)Uc + bc), and new h = (1 − z) ⊙ h + z ⊙ h̃.

Then write `recurrent_parameters(kind, input_size, hidden)` returning the number of weights and biases in one layer: an `"rnn"` has one block of (input_size × hidden + hidden × hidden + hidden), a `"gru"` three blocks and an `"lstm"` four. Store the counts for input size 100 and hidden size 256 in a dictionary `counts` with keys `"rnn"`, `"gru"` and `"lstm"`.

```python starter
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def gru_step(x, h, Wz, Uz, bz, Wr, Ur, br, Wc, Uc, bc):
    return h

def recurrent_parameters(kind, input_size, hidden):
    return 0

counts = {}
print(counts)
```

```python solution
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def gru_step(x, h, Wz, Uz, bz, Wr, Ur, br, Wc, Uc, bc):
    z = sigmoid(x @ Wz + h @ Uz + bz)
    r = sigmoid(x @ Wr + h @ Ur + br)
    candidate = np.tanh(x @ Wc + (r * h) @ Uc + bc)
    return (1 - z) * h + z * candidate

def recurrent_parameters(kind, input_size, hidden):
    blocks = {"rnn": 1, "gru": 3, "lstm": 4}[kind]
    return blocks * (input_size * hidden + hidden * hidden + hidden)

counts = {kind: recurrent_parameters(kind, 100, 256) for kind in ["rnn", "gru", "lstm"]}
print(counts)
```

```python test
import numpy as _np
assert "gru_step" in dir() and "recurrent_parameters" in dir(), "Keep both function names."
_s = lambda z: 1 / (1 + _np.exp(-z))
_r = _np.random.default_rng(1)
_x, _h = _r.normal(size=(4, 3)), _r.normal(size=(4, 5))
_P = [_r.normal(size=s) for s in [(3, 5), (5, 5), (5,)] * 3]
_out = gru_step(_x, _h, *_P)
_z = _s(_x @ _P[0] + _h @ _P[1] + _P[2])
_rr = _s(_x @ _P[3] + _h @ _P[4] + _P[5])
_cand = _np.tanh(_x @ _P[6] + (_rr * _h) @ _P[7] + _P[8])
assert _np.shape(_out) == (4, 5), "The new state should have shape (n, H)."
_wrong = _np.tanh(_x @ _P[6] + _h @ _P[7] + _P[8])
assert not _np.allclose(_out, (1 - _z) * _h + _z * _wrong), "The reset gate must multiply the old state inside the candidate: (r ⊙ h) @ Uc."
assert _np.allclose(_out, (1 - _z) * _h + _z * _cand), "The new state should be (1 − z) ⊙ h + z ⊙ candidate."
_shut = [_np.zeros((3, 5)), _np.zeros((5, 5)), _np.full(5, -50.0)] + _P[3:]
assert _np.allclose(gru_step(_x, _h, *_shut), _h), "With the update gate shut (z ≈ 0), the state should be copied forward unchanged."
assert recurrent_parameters("rnn", 100, 256) == 100 * 256 + 256 * 256 + 256, "An RNN layer has input × hidden + hidden × hidden + hidden parameters."
assert counts == {"rnn": 91392, "gru": 274176, "lstm": 365568}, f"Expected rnn 91,392, gru 274,176 and lstm 365,568, but got {counts}."
"SUCCESS: The GRU keeps a copy-forward path like the LSTM's, with three quarters of the parameters."
```

Hint: Compute `z` and `r` like LSTM gates, each from its own weights. In the candidate, the old state is multiplied by `r` **before** going through `Uc`. For the counts, look up the number of blocks in a dictionary and multiply.
:::

::: challenge Choosing the forget bias [medium]
If a forget gate holds a constant value f, a fraction fᵀ of the cell state, and of its gradient, survives T steps. Write `forget_value_for(T, fraction)` returning the constant forget gate value f needed for exactly `fraction` to survive `T` steps, and `bias_for(f)` returning the bias b with σ(b) = f (when all other inputs to the gate are zero), which is ln(f / (1 − f)).

Then store, in `needed`, a dictionary mapping each `T` in `[10, 100, 1000]` to the bias needed for half the memory to survive `T` steps.

```python starter
import numpy as np

def forget_value_for(T, fraction):
    return 1.0

def bias_for(f):
    return 0.0

needed = {}
print(needed)
```

```python solution
import numpy as np

def forget_value_for(T, fraction):
    return fraction ** (1 / T)

def bias_for(f):
    return float(np.log(f / (1 - f)))

needed = {T: bias_for(forget_value_for(T, 0.5)) for T in [10, 100, 1000]}
print(needed)
```

```python test
import numpy as _np
assert "forget_value_for" in dir() and "bias_for" in dir(), "Keep both function names."
assert _np.isclose(forget_value_for(10, 0.5) ** 10, 0.5), "forget_value_for(T, fraction) raised to the power T should give fraction."
assert _np.isclose(forget_value_for(1, 0.3), 0.3), "For one step, the forget value is the fraction itself."
_s = lambda z: 1 / (1 + _np.exp(-z))
for _f in (0.1, 0.5, 0.88, 0.999):
    assert _np.isclose(_s(bias_for(_f)), _f), f"sigmoid(bias_for({_f})) should equal {_f}. Use ln(f / (1 − f))."
assert sorted(needed) == [10, 100, 1000], "needed should have keys 10, 100 and 1000."
assert _np.isclose(needed[100], _np.log(0.5 ** 0.01 / (1 - 0.5 ** 0.01))), "needed[100] is wrong."
f"SUCCESS: Keeping half a memory for 10 steps needs a forget bias of {needed[10]:.1f}; for 100 steps {needed[100]:.1f}; for 1000 steps {needed[1000]:.1f}. Long memory means a gate held very close to 1, which is why LSTMs start with positive forget biases and learn the rest."
```

Hint: Solve fᵀ = fraction for f: f = fraction ** (1 / T). For the bias, invert the sigmoid: b = ln(f / (1 − f)), with `np.log`.
:::

## What you learned

- A gate is a sigmoid vector multiplying another vector element by element; the network learns when to open and close it.
- An LSTM keeps a cell state updated by cₜ = fₜ ⊙ cₜ₋₁ + iₜ ⊙ gₜ (forget, input gate, candidate) and outputs hₜ = oₜ ⊙ tanh(cₜ).
- Backwards along the cell state, the gradient is only multiplied by the forget gates, so it survives when they are near 1 (0.95⁵⁰ ≈ 8% versus 0.5⁵⁰ ≈ 10⁻¹⁵). Initialise forget biases at 1 to 2.
- On a 50-step memory task a plain RNN stayed at chance while an LSTM reached about 99%.
- A GRU uses an update gate and a reset gate, hₜ = (1 − zₜ) ⊙ hₜ₋₁ + zₜ ⊙ h̃ₜ, with about three quarters of an LSTM's parameters and similar performance.
- Recurrent layers can be stacked and made bidirectional; for language they have largely given way to transformers.

Every model so far has fed words or characters in as one-hot vectors, which say nothing about meaning: "cat" is as different from "kitten" as from "volcano". The next lesson learns **embeddings**, dense vectors in which similar things end up close together.
