# Lesson 3.1: how many machines does a greedy learner try in 200 pulls?
import numpy as np

from bandit import Bandit, Learner

tried = []
for seed in range(300):
    rng = np.random.default_rng(seed)
    bandit, learner = Bandit(5, rng), Learner(5, rng)
    arms = set()
    for _ in range(200):
        arm = learner.choose()
        learner.learn(arm, bandit.pull(arm))
        arms.add(arm)
    tried.append(len(arms))
share = np.mean(np.array(tried) <= 2)
print("Often only 1 or 2" if share > 0.4 else f"share with 1 or 2: {share}")
