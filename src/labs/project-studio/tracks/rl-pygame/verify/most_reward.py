# Lesson 3.2: which strategy earns the most over 500 pulls, and is the lead bigger than the noise?
import numpy as np

from compare_view import STRATEGIES
from experiment import run_once

totals = {name: np.array([run_once(make, 5, 500, seed)[0].sum() for seed in range(400)]) for name, _, make in STRATEGIES}
ranked = sorted(totals, key=lambda n: totals[n].mean(), reverse=True)
lead = totals[ranked[0]] - totals[ranked[1]]
assert lead.mean() > 2 * lead.std(ddof=1) / np.sqrt(len(lead)), "lead within the noise"
print(ranked[0])
