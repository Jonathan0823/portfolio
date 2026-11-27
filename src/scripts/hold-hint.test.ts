import { describe, expect, it } from 'vitest';
import { nextStep } from './hold-hint';

describe('nextStep', () => {
  it('moves from click to hold on a click on empty page, and stays on hold until a charge', () => {
    expect(nextStep('click', { charge: 0, clickable: false })).toBe('hold');
    expect(nextStep('hold', { charge: 0.2, clickable: false })).toBe('hold');
  });

  it('does not count a click on a control', () => {
    expect(nextStep('click', { charge: 0, clickable: true })).toBe('click');
  });

  it('ends on a charge big enough to hit the page, wherever it began, and stays ended', () => {
    expect(nextStep('click', { charge: 0.8, clickable: true })).toBe('done');
    expect(nextStep('done', { charge: 0, clickable: false })).toBe('done');
  });
});
