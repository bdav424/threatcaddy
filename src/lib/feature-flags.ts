// src/lib/feature-flags.ts
// Maps feature names to the editions that support them.
//
// Pro-only:    virtualcaddy, netmap, auto-updater, desktop-bridges, safe-storage
// Pro+Mobile:  assistant-caddy, calendar, email
// All editions: investigations, caddyai, reports, integrations (and any unknown feature)

import { getEdition } from './edition';

const PRO_ONLY = new Set([
  'virtualcaddy',
  'netmap',
  'auto-updater',
  'desktop-bridges',
  'safe-storage',
]);

const PRO_AND_MOBILE = new Set([
  'assistant-caddy',
  'calendar',
  'email',
]);

export function isFeatureEnabled(feature: string): boolean {
  const edition = getEdition();
  if (PRO_ONLY.has(feature)) return edition === 'pro';
  if (PRO_AND_MOBILE.has(feature)) return edition === 'pro' || edition === 'mobile';
  return true;
}
