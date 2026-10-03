// Walks "Memory, Lifetime and Ownership" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-memory.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-memory',
  title: 'Memory, Lifetime and Ownership',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-lifetime', '02-use-after-free', '03-dynamic-array', '04-copies', '05-move-semantics', '06-smart-pointers'],
  needsCMake: (lesson) => ['03-dynamic-array', '04-copies', '05-move-semantics'].includes(lesson),
});
