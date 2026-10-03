// Walks "C++ Foundations — Thinking in Types" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-language-basics.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-language-basics',
  title: 'C++ Foundations',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-values-and-input', '02-functions-and-tests', '03-gcd-and-lcm', '04-loops', '05-strings', '06-vectors', '07-structs'],
  needsCMake: (lesson) => lesson !== '04-loops',
});
