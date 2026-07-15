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
       * Panel opacity: bg-gray-900/800/700 (and the bg-bg-* semantic classes)
       * always render as rgba(--tc-panel-bg-rgb, --tc-panel-glass-opacity) --
       * controlled by the Panel opacity slider, independent of frost. Frost
       * (.has-panel-glass) only adds backdrop blur, grain texture, and the
       * tinted border on top of that opacity.
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
      {/* feTurbulence + feDisplacementMap for the "bumpy" glass style, referenced from
          backdrop-filter (see [data-glass-style="bumpy"] rules in index.css). SVG filters
          are DOM elements, not something CSS alone can define, so they live here once and
          get referenced by every panel via url(#tc-glass-noise). Zero-size + absolute so
          it never affects layout. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="tc-glass-noise" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.0024" numOctaves={2} seed={7} stitchTiles="stitch" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={28} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="app-window-chrome-ring" aria-hidden="true" />
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
