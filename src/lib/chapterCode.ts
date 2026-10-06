import { CHAPTER_CODE } from '../api/types';

/** Letters and digits that are hard to confuse when read off a projector (no 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A random 5-character chapter code for sessions where the facilitator doesn't type one. */
export function newChapterCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return CHAPTER_CODE.test(s) ? s : newChapterCode(rand);
}
