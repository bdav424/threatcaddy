// src/lib/edition.ts
// Build-time edition selector driven by VITE_EDITION env var.
// Default is 'pro' so existing builds are unaffected.

export type Edition = 'lite' | 'pro' | 'mobile';

export function getEdition(): Edition {
  const env = import.meta.env.VITE_EDITION as string | undefined;
  if (env === 'lite' || env === 'mobile') return env;
  return 'pro';
}
