import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BgImageLayer } from './BgImageLayer';
import { BgEffectLayer } from './BgEffectLayer';
import type { BackgroundEffectPattern } from '../../types';

interface AppLayoutProps {
  header: ReactNode;
  sidebar: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
  bgImageEnabled?: boolean;
  bgImageOpacity?: number;
  bgImagePosX?: number;
  bgImagePosY?: number;
  bgImageZoom?: number;
  bgImageBlur?: number;
  bgEffectPattern?: BackgroundEffectPattern;
  bgEffectColor?: string;
  bgEffectIntensity?: number;
  bgEffectSize?: number;
  bgGlowIntensity?: number;
  bgGlowColor?: string;
  bgParticleGlow?: number;
  bgEffectTrail?: number;
  theme?: 'dark' | 'light';
}

export function AppLayout({
  header,
  sidebar,
  bottomNav,
  children,
  bgImageEnabled,
  bgImageOpacity,
  bgImagePosX,
  bgImagePosY,
  bgImageZoom,
  bgImageBlur,
  bgEffectPattern,
  bgEffectColor,
  bgEffectIntensity,
  bgEffectSize,
  bgGlowIntensity,
  bgGlowColor,
  bgParticleGlow,
  bgEffectTrail,
  theme,
}: AppLayoutProps) {
  const { t } = useTranslation('common');
  const resolvedTheme = theme ?? 'dark';
  const hasBgEffect = (bgEffectPattern ?? 'none') !== 'none';

  useEffect(() => {
    document.documentElement.classList.toggle('has-bg-effect', hasBgEffect);
    return () => {
      document.documentElement.classList.remove('has-bg-effect');
    };
  }, [hasBgEffect]);

  return (
    <div className="app-window-shell flex flex-col overflow-hidden relative">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        {t('skipToMainContent')}
      </a>
      {/*
       * BgImageLayer renders the wallpaper then stacks a colour scrim on top:
       *   rgba(0,0,0, opacity/100)  — dark theme
       *   rgba(255,255,255, opacity/100) — light theme
       *
       * Default is 0 (no scrim) so a first-time user sees their image immediately.
       * The old default of 85 painted an 85%-black rectangle over the image and
       * made it appear as if the feature was broken.
       *
       * Frost-on / frost-off asymmetry (expected behaviour, not a bug):
       * When Settings is open, the SettingsPanel fills app-window-main.  All
       * surface panels inside it use the bg-gray-900 Tailwind class, which the
       * token bridge maps to var(--color-bg-surface) -- fully opaque by default.
       * When frostedPanels is enabled, .has-panel-glass .bg-gray-900 overrides
       * that to var(--tc-panel-glass-surface) (70% opacity via color-mix), making
       * every panel translucent and revealing the background image beneath them.
       * With frost off the same panels are solid slabs that cover the image --
       * that is the intended behaviour, not a bug requiring a fix.
       */}
      <BgImageLayer
        enabled={bgImageEnabled ?? false}
        opacity={bgImageOpacity ?? 0}
        posX={bgImagePosX ?? 50}
        posY={bgImagePosY ?? 50}
        zoom={bgImageZoom ?? 100}
        blur={bgImageBlur ?? 0}
        theme={resolvedTheme}
      />
      <BgEffectLayer
        pattern={bgEffectPattern ?? 'none'}
        color={bgEffectColor}
        intensity={bgEffectIntensity ?? 60}
        size={bgEffectSize ?? 100}
        glowIntensity={bgGlowIntensity ?? 50}
        glowColor={bgGlowColor}
        particleGlow={bgParticleGlow ?? 45}
        trail={bgEffectTrail ?? 0}
        theme={resolvedTheme}
      />
      <div className="app-window-ambient pointer-events-none absolute inset-0 z-0" />
      {header}
      <div className="app-window-frame relative z-20 flex flex-1 overflow-hidden min-h-0">
        <div className="app-window-sidebar hidden md:block shrink-0">
          {sidebar}
        </div>
        <main id="main-content" className="app-window-main flex flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      {bottomNav}
    </div>
  );
}
