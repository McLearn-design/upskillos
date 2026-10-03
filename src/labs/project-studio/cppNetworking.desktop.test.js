// Walks "Networking" like a learner; see walkCppTrack.js.
import { walkCppTrack } from './walkCppTrack.js';
import { WALKTHROUGH } from './tracks/cpp-networking.walkthrough.js';

await walkCppTrack({
  trackKey: 'cpp-networking',
  title: 'Networking',
  walkthrough: WALKTHROUGH,
  lessonIds: ['01-sockets', '02-tcp-echo', '03-framing', '04-chat-room', '05-http-server', '06-game-server'],
  needsCMake: () => true,
});
