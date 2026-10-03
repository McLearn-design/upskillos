// Walks "Classes and Abstraction" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-classes.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-classes',
  title: 'Classes and Abstraction',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-invariants', '02-operators', '03-inheritance', '04-interfaces', '05-errors', '06-value-types'],
  needsCMake: (lesson) => ['01-invariants', '02-operators', '04-interfaces', '05-errors', '06-value-types'].includes(lesson),
});
