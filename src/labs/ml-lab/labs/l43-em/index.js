import { lazy } from 'react'
import { lessons, sources } from './lessons.js'
import python from './python.js'
import { blocks } from './blocks.js'
import { withBlocks } from '../../kit/blocks.js'
import { em } from './ladder.js'

export default {
  number: 43,
  short: 'Mixtures & EM',
  question: 'How do you fit a model whose most important variable is never observed?',
  intro: 'Gaussian mixture models, the EM algorithm and why it never decreases the likelihood, its relationship to k-means, failure modes, and choosing the number of components.',
  lessons: withBlocks(lessons, blocks), sources, python, figures: () => import('./figures.jsx'), ladders: { em },
  math: ['stat.normal', 'pre.log', 'calc.optim', 'stat.bayes'],
  Playground: lazy(() => import('./Playground.jsx')),
  scope: 'Latent-variable models and mixtures, responsibilities, E- and M-steps, Jensen’s inequality, the ELBO and KL decomposition, monotonicity and local optima, restarts and initialization, k-means as hard EM, collapse and variance floors, label switching, covariance types, BIC, AIC and held-out likelihood.',
}
