// Walks "Systems Programming" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-systems.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-systems',
  title: 'Systems Programming',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-files', '02-processes', '03-pipes', '04-threads', '05-condition-variables', '06-atomics', '07-thread-pool'],
  needsCMake: (lesson) => ['01-files', '04-threads', '05-condition-variables', '06-atomics', '07-thread-pool'].includes(lesson),
});
