import { describe, expect, it } from 'vitest';
import { isValidTcIdentity, maskTcIdentity } from '../src/members/tc-identity.js';

describe('TC kimlik doğrulama', () => {
  it('algoritmaya uyan test numarasını kabul eder', () => {
    expect(isValidTcIdentity('10000000146')).toBe(true);
  });
  it('hatalı numarayı reddeder', () => {
    expect(isValidTcIdentity('12345678901')).toBe(false);
  });
  it('liste görünümünde numarayı maskeler', () => {
    expect(maskTcIdentity('10000000146')).toBe('100•••••146');
  });
});
