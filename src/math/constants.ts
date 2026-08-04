/**
 * Physical constants as dimensioned Quantities.
 *
 * Gravity is stored once in SI (metres) and reused for both unit systems via
 * the units layer, so there is a single source of truth — no more `-9.82`
 * literals scattered through the UI.
 */
import { quantity } from './quantity.ts';
import { ACCELERATION } from './dimension.ts';

/** Standard gravitational acceleration near Earth's surface (downward). */
export const GRAVITY = quantity(-9.81, ACCELERATION);
