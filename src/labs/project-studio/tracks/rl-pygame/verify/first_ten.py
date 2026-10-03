# Lesson 3.2: which strategy is worst at finding the best machine in its first 10 pulls?
import numpy as np

from compare_view import STRATEGIES
from experiment import Experiment

shares = {}
for name, _, make in STRATEGIES:
    exp = Experiment(make, k=5, steps=10)
    exp.add_runs(400)
    shares[name] = exp.curves()[2].mean()
print(min(shares, key=shares.get))
