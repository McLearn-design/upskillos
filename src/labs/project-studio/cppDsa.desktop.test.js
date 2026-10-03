// Walks "Data Structures and Algorithms, Measured" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-dsa.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-dsa',
  title: 'Data Structures and Algorithms, Measured',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-complexity', '02-sequences', '03-hash-map', '04-search-trees', '05-heaps', '06-graphs', '07-dynamic-programming', '08-mini-database'],
  needsCMake: (lesson) => ['02-sequences', '03-hash-map', '04-search-trees', '05-heaps', '06-graphs', '07-dynamic-programming', '08-mini-database'].includes(lesson),
});
