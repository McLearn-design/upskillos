import { lazy } from 'react'
import { lessons, sources } from './lessons.js'
import python from './python.js'
import { blocks } from './blocks.js'
import { withBlocks } from '../../kit/blocks.js'
import { theory } from './ladder.js'

export default {
  number: 47,
  short: 'Learning theory',
  question: 'Why should training error say anything about data you have not seen — and when does it not?',
  intro: 'Hoeffding and union bounds, ERM guarantees, VC dimension through shattering, double descent, and the approximation–estimation decomposition behind everyday modelling decisions.',
  lessons: withBlocks(lessons, blocks), sources, python, figures: () => import('./figures.jsx'), ladders: { theory },
  math: ['dm.counting', 'dm.proof', 'stat.clt', 'calc.limits'],
  Playground: lazy(() => import('./Playground.jsx')),
  scope: 'True versus empirical risk and the i.i.d. assumption, Hoeffding’s inequality, uniform convergence and the union bound for finite classes, the ERM guarantee, sample complexity, shattering and VC dimension, the VC bound, double descent and minimum-norm interpolation, norm, margin and PAC-Bayes bounds in outline, approximation versus estimation error, validation optimism and no free lunch.',
}
