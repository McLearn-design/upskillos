// Walks "Graphics from First Principles" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-graphics.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-graphics',
  title: 'Graphics from First Principles',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-pixels', '02-binary-images', '03-vectors', '04-lines-and-triangles', '05-transforms', '06-3d-projection', '07-depth-and-shading', '08-pipeline'],
  needsCMake: () => true,
});
