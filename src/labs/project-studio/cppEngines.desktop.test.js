// Walks "Games and Engines" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-engines.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-engines',
  title: 'Games and Engines',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-game-loop', '02-entities', '03-collision', '04-data-oriented', '05-profiling'],
  needsCMake: () => true,
});
