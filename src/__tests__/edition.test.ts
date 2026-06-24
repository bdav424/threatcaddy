import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEdition } from '../lib/edition';

describe('getEdition', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns pro by default when VITE_EDITION is unset', () => {
    expect(getEdition()).toBe('pro');
  });

  it('returns lite when VITE_EDITION=lite', () => {
    vi.stubEnv('VITE_EDITION', 'lite');
    expect(getEdition()).toBe('lite');
  });

  it('returns mobile when VITE_EDITION=mobile', () => {
    vi.stubEnv('VITE_EDITION', 'mobile');
    expect(getEdition()).toBe('mobile');
  });

  it('returns pro when VITE_EDITION=pro', () => {
    vi.stubEnv('VITE_EDITION', 'pro');
    expect(getEdition()).toBe('pro');
  });

  it('returns pro for unrecognized VITE_EDITION values', () => {
    vi.stubEnv('VITE_EDITION', 'enterprise');
    expect(getEdition()).toBe('pro');
  });
});
