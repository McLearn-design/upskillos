import { lazy } from 'react'
import { lessons, sources } from './lessons.js'
import python from './python.js'
import { blocks } from './blocks.js'
import { withBlocks } from '../../kit/blocks.js'
import { dlreg } from './ladder.js'

export default {
  number: 52,
  short: 'DL regularization & normalization',
  question: 'How do you stop big networks memorizing — and keep deep ones trainable?',
  intro: 'Early stopping, dropout, weight decay and augmentation on a tiny noisy dataset; batch and layer normalization; and residual connections that make depth trainable.',
  lessons: withBlocks(lessons, blocks), sources, python, figures: () => import('./figures.jsx'), ladders: { dlreg },
  math: ['stat.center', 'stat.spread', 'ai.optim', 'ai.stability'],
  Playground: lazy(() => import('./Playground.jsx')),
  scope: 'Overfitting in overparameterized networks, validation curves and early stopping, inverted dropout, L2 versus decoupled weight decay (AdamW), label-preserving augmentation and input noise, combining regularizers, batch normalization and its train/eval modes, layer normalization, the degradation problem, and residual connections.',
}
