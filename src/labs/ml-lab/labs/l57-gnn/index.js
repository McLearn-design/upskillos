import { lazy } from 'react'
import { lessons, sources } from './lessons.js'
import python from './python.js'
import { blocks } from './blocks.js'
import { withBlocks } from '../../kit/blocks.js'
import { gnn } from './ladder.js'

export default {
  number: 57,
  short: 'Graph neural networks',
  question: 'How can a model learn from who is connected to whom?',
  intro: 'Graphs as data, message passing and receptive fields, graph convolutional networks for semi-supervised node classification, over-smoothing and expressiveness limits, and GNNs in practice without leakage.',
  lessons: withBlocks(lessons, blocks), sources, python, figures: () => import('./figures.jsx'), ladders: { gnn },
  math: ['dm.graphs', 'la.matmul', 'la.eigen', 'ai.graphs', 'la.markov'],
  Playground: lazy(() => import('./Playground.jsx')),
  scope: 'Nodes, edges and features, adjacency and sparsity, node, link and graph tasks, permutation invariance and equivariance, homophily, message passing and aggregators, receptive fields and weight sharing, the GCN layer and normalized adjacency, transductive training, baselines, over-smoothing and remedies, Weisfeiler–Lehman limits and over-squashing, GraphSAGE, link prediction, graph readouts and graph leakage.',
}
