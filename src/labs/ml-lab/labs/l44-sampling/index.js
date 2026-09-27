import { lazy } from 'react'
import { lessons, sources } from './lessons.js'
import python from './python.js'
import { blocks } from './blocks.js'
import { withBlocks } from '../../kit/blocks.js'
import { sampling } from './ladder.js'

export default {
  number: 44,
  short: 'Sampling & approximate inference',
  question: 'How do you compute with a posterior that has no formula?',
  intro: 'Monte Carlo, importance sampling, Metropolis–Hastings and Gibbs sampling with honest diagnostics, and variational inference with its characteristic biases.',
  lessons: withBlocks(lessons, blocks), sources, python, figures: () => import('./figures.jsx'), ladders: { sampling },
  math: ['ai.sampling', 'stat.clt', 'calc.integral', 'calc.numint', 'la.markov', 'ai.stochastic'],
  Playground: lazy(() => import('./Playground.jsx')),
  scope: 'Intractable normalizers, Monte Carlo estimates and their 1/√S error, self-normalized importance sampling and ESS, random-walk Metropolis–Hastings and detailed balance, step-size tuning, Gibbs sampling, autocorrelation, burn-in, trace plots, R̂, HMC in outline, the ELBO for variational inference, mean-field variance shrinkage, and forward versus reverse KL.',
}
