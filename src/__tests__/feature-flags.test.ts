import { describe, it, expect, vi, afterEach } from 'vitest';
import { isFeatureEnabled } from '../lib/feature-flags';

const PRO_ONLY = ['virtualcaddy', 'netmap', 'auto-updater', 'desktop-bridges', 'safe-storage'];
const PRO_AND_MOBILE = ['assistant-caddy', 'calendar', 'email'];
const ALL_EDITIONS = ['investigations', 'caddyai', 'reports', 'integrations'];

describe('isFeatureEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Pro-only features disabled on Lite', () => {
    it.each(PRO_ONLY)('%s is disabled on lite', (feature) => {
      vi.stubEnv('VITE_EDITION', 'lite');
      expect(isFeatureEnabled(feature)).toBe(false);
    });
  });

  describe('Pro-only features disabled on Mobile', () => {
    it.each(PRO_ONLY)('%s is disabled on mobile', (feature) => {
      vi.stubEnv('VITE_EDITION', 'mobile');
      expect(isFeatureEnabled(feature)).toBe(false);
    });
  });

  describe('Pro-only features enabled on Pro', () => {
    it.each(PRO_ONLY)('%s is enabled on pro', (feature) => {
      vi.stubEnv('VITE_EDITION', 'pro');
      expect(isFeatureEnabled(feature)).toBe(true);
    });
  });

  describe('Pro+Mobile features', () => {
    it.each(PRO_AND_MOBILE)('%s is enabled on pro', (feature) => {
      vi.stubEnv('VITE_EDITION', 'pro');
      expect(isFeatureEnabled(feature)).toBe(true);
    });

    it.each(PRO_AND_MOBILE)('%s is enabled on mobile', (feature) => {
      vi.stubEnv('VITE_EDITION', 'mobile');
      expect(isFeatureEnabled(feature)).toBe(true);
    });

    it.each(PRO_AND_MOBILE)('%s is disabled on lite', (feature) => {
      vi.stubEnv('VITE_EDITION', 'lite');
      expect(isFeatureEnabled(feature)).toBe(false);
    });
  });

  describe('All-editions features', () => {
    it.each(ALL_EDITIONS)('%s is enabled on lite', (feature) => {
      vi.stubEnv('VITE_EDITION', 'lite');
      expect(isFeatureEnabled(feature)).toBe(true);
    });

    it.each(ALL_EDITIONS)('%s is enabled on pro', (feature) => {
      vi.stubEnv('VITE_EDITION', 'pro');
      expect(isFeatureEnabled(feature)).toBe(true);
    });

    it.each(ALL_EDITIONS)('%s is enabled on mobile', (feature) => {
      vi.stubEnv('VITE_EDITION', 'mobile');
      expect(isFeatureEnabled(feature)).toBe(true);
    });
  });

  it('enables unknown features on all editions', () => {
    for (const edition of ['lite', 'pro', 'mobile']) {
      vi.stubEnv('VITE_EDITION', edition);
      expect(isFeatureEnabled('some-future-feature')).toBe(true);
      vi.unstubAllEnvs();
    }
  });
});
