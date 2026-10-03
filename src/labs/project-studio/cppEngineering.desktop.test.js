// Walks "Software Engineering in C++" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-engineering.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-engineering',
  title: 'Software Engineering in C++',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-git', '02-cmake', '03-tests-and-branches', '04-style-and-analysis', '05-sanitizers', '06-ci', '07-release'],
  needsCMake: () => true,
});
