import { rotationLabels, stepsByLabel } from './rotationNames';
import type { Slots } from './rotation';

const slots: Slots = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' };

describe('rotationLabels', () => {
  it('names each step after the setter: setter starting at 4 → 4, 3, 2, 1, 6, 5', () => {
    expect(rotationLabels(slots, { d: 'S' })).toEqual([4, 3, 2, 1, 6, 5]);
  });

  it('setter starting at 1 → 1, 6, 5, 4, 3, 2', () => {
    expect(rotationLabels(slots, { a: 'S', b: 'OH' })).toEqual([1, 6, 5, 4, 3, 2]);
  });

  it('with two setters (6-2) the back-row setter counts', () => {
    // Setters at 1 and 4: back row 1; then 6 (and 3); then 5 (and 2); then 1 again (4 front).
    expect(rotationLabels(slots, { a: 'S', d: 'S' })).toEqual([1, 6, 5, 1, 6, 5]);
  });

  it('falls back to counting steps without a setter', () => {
    expect(rotationLabels(slots, { a: 'OH' })).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('stepsByLabel', () => {
  it('orders steps so the jump row reads 1–6', () => {
    // Labels 4, 3, 2, 1, 6, 5: label 1 is step 4, label 2 is step 3, …
    expect(stepsByLabel([4, 3, 2, 1, 6, 5])).toEqual([4, 3, 2, 1, 6, 5]);
    expect(stepsByLabel([1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps step order for equal labels (6-2)', () => {
    expect(stepsByLabel([1, 6, 5, 1, 6, 5])).toEqual([1, 4, 3, 6, 2, 5]);
  });
});
