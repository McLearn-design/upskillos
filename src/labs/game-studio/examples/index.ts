// Every example game, in the order the Examples list shows them.
import type { GameExample } from './types';
import { potionHunt } from './potionHunt';
import { platformer } from './platformer';
import { breakout } from './breakout';
import { mazeChase } from './mazeChase';
import { zombieArena } from './zombieArena';

export type { GameExample };
export const EXAMPLES: GameExample[] = [potionHunt, platformer, breakout, mazeChase, zombieArena];
