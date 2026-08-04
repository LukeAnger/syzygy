/**
 * In-house dimensional math core.
 *
 * The engine and domain packs depend only on this module for computation.
 * No external math/units library — physics equations are expressed directly
 * as operations over dimensioned Quantities.
 */
export * from './dimension.ts';
export * from './quantity.ts';
export * from './units.ts';
export * from './format.ts';
export * from './constants.ts';
