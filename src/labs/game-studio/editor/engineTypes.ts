// The engine's Game API as TypeScript declarations, for the script editor's completion
// and hover. Generated from core/apiReference.ts, which the tests check against the real
// engine (ADR 5): nothing here that a script cannot use, and nothing a script can use missing.
import { engineDts } from '../core/apiReference';

export const ENGINE_DTS = engineDts();
