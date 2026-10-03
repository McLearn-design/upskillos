# Lesson 3.2: how much more precise is a comparison when both strategies face the same rooms?
import numpy as np

from bandit import Learner
from experiment import run_once

n = 400
a = np.array([run_once(lambda k, r: Learner(k, r, epsilon=0.1), 5, 500, s)[0].sum() for s in range(n)])
b = np.array([run_once(lambda k, r: Learner(k, r, initial=5.0, step=0.1), 5, 500, s)[0].sum() for s in range(n)])
paired = (a - b).std(ddof=1) / np.sqrt(n)
unpaired = np.sqrt(a.var(ddof=1) / n + b.var(ddof=1) / n)
print(round(unpaired / paired))
