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
      <BgImageLayer
        enabled={bgImageEnabled ?? false}
        opacity={bgImageOpacity ?? 85}
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
