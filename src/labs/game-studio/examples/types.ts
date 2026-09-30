// An example game: an ordinary project, built by Scene API code from starter art
// (docs/game-studio-architecture.md, ADR 12). Opening one makes a new project, adds
// its images from the starter art, and runs its code as one command, so GUI → code
// shows exactly how it was built.

export interface GameExample {
  id: string;
  title: string;
  /** One or two sentences: what the game is and what it shows. */
  blurb: string;
  /** Where its art comes from. */
  art: string;
  /** Starter-art paths the code uses; added to the project first. */
  images: string[];
  /** Scene API code that builds the game. It begins by creating its scene. */
  code: string;
  /** What to look at and try, in order. */
  guide: string[];
}
