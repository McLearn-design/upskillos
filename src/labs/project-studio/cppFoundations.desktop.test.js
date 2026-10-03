// Walks "C++ from Zero — Tools of the Trade" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-foundations.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-foundations',
  title: 'C++ from Zero',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-first-program', '02-reading-errors', '03-compiler-and-linker', '04-cmake', '05-first-crash'],
  needsCMake: (lesson) => lesson === '04-cmake',
});
