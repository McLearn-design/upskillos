// Walks "Generic Programming" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-generic.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-generic',
  title: 'Generic Programming',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-function-templates', '02-class-templates', '03-concepts', '04-iterators', '05-lambdas', '06-ranges', '07-flat-set'],
  needsCMake: (lesson) => ['02-class-templates', '03-concepts', '04-iterators', '05-lambdas', '06-ranges', '07-flat-set'].includes(lesson),
});
