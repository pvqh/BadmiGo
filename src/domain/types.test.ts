import { describe, expect, it } from 'vitest';
import { asGameFormat, asTier } from './types';

describe('asGameFormat', () => {
  it('passes a club format through and refuses anything else', () => {
    expect(asGameFormat(21)).toBe(21);
    expect(asGameFormat(25)).toBeNull();
    expect(asGameFormat('21')).toBeNull();
  });
});

describe('asTier', () => {
  it('passes a club tier through and refuses anything else', () => {
    expect(asTier('tb-plus')).toBe('tb-plus');
    expect(asTier('TB+')).toBeNull();
    expect(asTier(null)).toBeNull();
  });
});
