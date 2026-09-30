// Every example game, in the order the Examples list shows them.
import type { GameExample } from './types';
import { potionHunt } from './potionHunt';
import { platformer } from './platformer';

export type { GameExample };
export const EXAMPLES: GameExample[] = [potionHunt, platformer];
