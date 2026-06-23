import { useState, useEffect } from 'react';
import { BG_IMAGE_CHANGED_EVENT, loadBgImage } from '../../lib/theme-bg';

interface BgImageLayerProps {
  enabled: boolean;
  opacity: number;
  theme: 'dark' | 'light';
  posX: number;
  posY: number;
  zoom: number;
  blur: number;
}

export function BgImageLayer({ enabled, opacity, theme, posX, posY, zoom, blur }: BgImageLayerProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;

    const replaceUrl = (nextUrl: string | null) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = nextUrl;
      setUrl(nextUrl);
    };

    const refresh = () => {
      if (!enabled) {
        replaceUrl(null);
        return;
      }
      loadBgImage().then((nextUrl) => {
        if (!active) {
          if (nextUrl) URL.revokeObjectURL(nextUrl);
          return;
        }
        replaceUrl(nextUrl);
      });
    };

    refresh();
    window.addEventListener(BG_IMAGE_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(BG_IMAGE_CHANGED_EVENT, refresh);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [enabled]);

  useEffect(() => {
    document.documentElement.classList.toggle('has-bg-image', enabled && !!url);
    return () => {
      document.documentElement.classList.remove('has-bg-image');
    };
  }, [enabled, url]);

  if (!enabled || !url) return null;

  return (
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden>
      <div
        role="img"
        aria-hidden
        className="absolute inset-0"
        style={{
          inset: blur > 0 ? `-${Math.ceil(blur * 2)}px` : 0,
          backgroundImage: `url(${url})`,
          backgroundSize: 'cover',
          backgroundPosition: `${posX}% ${posY}%`,
          backgroundRepeat: 'no-repeat',
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: theme === 'dark'
            ? `rgba(0, 0, 0, ${opacity / 100})`
            : `rgba(255, 255, 255, ${opacity / 100})`,
        }}
      />
    </div>
  );
}
