import { useEffect, useRef } from 'react';
import type { BackgroundEffectPattern } from '../../types';

interface BgEffectLayerProps {
  pattern: BackgroundEffectPattern;
  color?: string;
  /** Optional distinct color for the ambient glow blooms (enables warm-glow-behind-cool-particles
   * themes). Falls back to `color` when unset. */
  glowColor?: string;
  intensity?: number;
  size?: number;
  glowIntensity?: number;
  trail?: number;
  theme: 'dark' | 'light';
}

type MovingPoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  twinkle: number;
  emberSpark: boolean;
  emberSides: number;
  emberRot: number;
  /** Ring buffer: interleaved [x0, y0, x1, y1, ...] of past positions. */
  history: Float32Array;
  /** Next write slot (mod TRAIL_MAX_POSITIONS). */
  histHead: number;
  /** Valid entry count, capped at TRAIL_MAX_POSITIONS. */
  histLen: number;
};

type SwirlSeed = {
  anchorX: number;
  anchorY: number;
  orbitX: number;
  orbitY: number;
  speed: number;
  phase: number;
  width: number;
};

const MAX_PARTICLES = 100;

/**
 * Maximum trail positions per particle stored in the ring buffer.
 * trail slider 0 → N=0 (no trail), trail=100 → N=TRAIL_MAX_POSITIONS.
 * Tuned so trail=100 gives ~0.5–0.6 s of history at 60 fps.
 */
const TRAIL_MAX_POSITIONS = 35;

// Three glow blooms in golden-ratio proportion (radius and screen position),
// composited additively so overlaps warm naturally instead of flattening into
// a single centered wash.
const GLOW_BLOOMS = [
  { xFrac: 0.30, yFrac: 0.28, radiusMult: 1.0 },
  { xFrac: 0.72, yFrac: 0.52, radiusMult: 0.618 },
  { xFrac: 0.40, yFrac: 0.70, radiusMult: 0.382 },
] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function normalizeHex(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return null;
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function getPaletteFallbackColor(theme: 'dark' | 'light') {
  const styles = getComputedStyle(document.documentElement);
  const tokens = [
    '--color-text-primary',
    '--color-accent',
    '--color-accent-blue',
  ];
  for (const token of tokens) {
    const value = normalizeHex(styles.getPropertyValue(token));
    if (value) return value;
  }
  return theme === 'dark' ? '#8ec5ff' : '#5b8cff';
}

function createSwirls(width: number, height: number, scale: number) {
  const count = Math.max(4, Math.round(Math.min(width, height) / 280));
  return Array.from({ length: count }, (_, index) => ({
    anchorX: width * (0.15 + ((index * 0.19) % 0.72)),
    anchorY: height * (0.18 + ((index * 0.13) % 0.66)),
    orbitX: (150 + Math.random() * 180) * scale,
    orbitY: (90 + Math.random() * 150) * scale,
    speed: 0.55 + Math.random() * 0.75,
    phase: Math.random() * Math.PI * 2,
    width: 0.7 + Math.random() * 0.8,
  } satisfies SwirlSeed));
}

function createPoints(width: number, height: number, scale: number, density: number) {
  const count = Math.min(MAX_PARTICLES, Math.max(18, Math.round(((width * height) / 65000) * density)));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.18 * scale,
    vy: (Math.random() - 0.5) * 0.18 * scale,
    radius: (1.2 + Math.random() * 2.6) * scale,
    twinkle: Math.random() * Math.PI * 2,
    emberSpark: Math.random() < 0.2,
    emberSides: 3 + Math.floor(Math.random() * 3),
    emberRot: Math.random() * Math.PI * 2,
    history: new Float32Array(TRAIL_MAX_POSITIONS * 2),
    histHead: 0,
    histLen: 0,
  } satisfies MovingPoint));
}

export function BgEffectLayer({
  pattern,
  color,
  glowColor,
  intensity = 60,
  size = 100,
  glowIntensity = 50,
  trail = 0,
  theme,
}: BgEffectLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorRef = useRef(color);
  const glowColorRef = useRef(glowColor);
  const intensityRef = useRef(intensity);
  const glowRef = useRef(glowIntensity);
  const trailRef = useRef(trail);
  const themeRef = useRef(theme);
  // Track pattern and size via refs so switching effects doesn't tear down the canvas.
  const patternRef = useRef(pattern);
  const sizeRef = useRef(size);
  const needsParticleResetRef = useRef(false);

  // Cheap prop sync — never triggers canvas/RAF teardown.
  useEffect(() => {
    const prevPattern = patternRef.current;
    const prevSize = sizeRef.current;
    colorRef.current = color;
    glowColorRef.current = glowColor;
    intensityRef.current = intensity;
    glowRef.current = glowIntensity;
    trailRef.current = trail;
    themeRef.current = theme;
    patternRef.current = pattern;
    sizeRef.current = size;
    if (prevPattern !== pattern || prevSize !== size) {
      needsParticleResetRef.current = true;
    }
  }, [color, glowColor, intensity, glowIntensity, trail, theme, pattern, size]);

  // Only re-run canvas setup when toggling between 'none' and an active effect.
  // Switching between two non-none effects is handled via refs — no teardown needed.
  const isNone = pattern === 'none';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isNone) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    // Particles render onto a persistent offscreen layer.
    // Cleared every frame — ring buffers own the trail history.
    const trailCanvas = document.createElement('canvas');
    const pctx = trailCanvas.getContext('2d');
    if (!pctx) {
      return;
    }

    // Offscreen caches for expensive static layers.
    // Rebuilt only when their inputs change, then blitted each frame.
    const bloomCanvas = document.createElement('canvas');
    const vignetteCanvas = document.createElement('canvas');
    // Single glow halo sprite stamped at each particle head per frame.
    const glowSpriteCanvas = document.createElement('canvas');

    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let swirls: SwirlSeed[] = [];
    let points: MovingPoint[] = [];
    let petalCount = 0;
    let lastTime = 0;
    // `scale` is a mutable let updated by initParticles so draw closures always read the current value.
    let scale = 1;

    // Reassigned every frame from the refs above so color/theme/glow updates
    // don't need to tear down and recreate the particle arrays.
    let effectColor = normalizeHex(colorRef.current) || getPaletteFallbackColor(themeRef.current);
    let glowColorValue = normalizeHex(glowColorRef.current) || effectColor;
    let alphaBase = clamp(intensityRef.current / 100, 0.08, 1);
    let glowStrength = clamp(glowRef.current, 0, 100) / 100;
    let glowTopAlpha = (themeRef.current === 'dark' ? 0.08 : 0.34) * glowStrength;

    // Logical-pixel size of the glow sprite square; updated by buildGlowSprite().
    let glowSpriteLogical = 0;

    // Cache key — any change triggers offscreen canvas rebuilds.
    let cacheKey = '';

    // ---------------------------------------------------------------------------
    // Offscreen cache builders — called at most once per unique input combination.
    // ---------------------------------------------------------------------------

    /** Pre-render the three φ-seated bloom gradients onto bloomCanvas. */
    const buildBloomCache = () => {
      // Build at ¼ resolution — the bilinear upscale on blit smooths gradient banding
      // far more cheaply than adding more gradient stops.
      const bloomScale = 4;
      const bloomW = Math.ceil(width * dpr / bloomScale);
      const bloomH = Math.ceil(height * dpr / bloomScale);
      bloomCanvas.width = bloomW;
      bloomCanvas.height = bloomH;
      const bctx = bloomCanvas.getContext('2d');
      if (!bctx) return;
      bctx.setTransform(dpr / bloomScale, 0, 0, dpr / bloomScale, 0, 0);
      bctx.clearRect(0, 0, width, height);

      const WASH_STOPS = 16;
      // Background blooms are driven by GLOW only. alphaBase (the particle Intensity
      // slider) must NOT scale them — Intensity governs particles/lines/dots, glow
      // governs the ambient blooms. Coupling them made Intensity dim the background.
      const washPeak = 0.14 * glowStrength;
      const minDim = Math.min(width, height);
      bctx.globalCompositeOperation = 'lighter';
      for (const bloom of GLOW_BLOOMS) {
        const cx = width * bloom.xFrac;
        const cy = height * bloom.yFrac;
        const radius = minDim * bloom.radiusMult;
        const wash = bctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        // Dense exponentially-shaped falloff — ~16 stops on an eased curve put
        // any residual banding below perceptual threshold.
        for (let s = 0; s <= WASH_STOPS; s++) {
          const r = s / WASH_STOPS;
          const falloff = Math.exp(-4.2 * r * r);
          wash.addColorStop(r, rgba(glowColorValue, washPeak * falloff));
        }
        bctx.fillStyle = wash;
        bctx.fillRect(0, 0, width, height);
      }
      bctx.globalCompositeOperation = 'source-over';

      // Break gradient quantization bands — one-time cost per rebuild.
      // Perturb only the alpha channel so hue is unaffected.
      const noiseData = bctx.getImageData(0, 0, bloomW, bloomH);
      const nd = noiseData.data;
      for (let i = 3; i < nd.length; i += 4) {
        nd[i] = Math.min(255, Math.max(0, nd[i] + (Math.random() * 2 - 1)));
      }
      bctx.putImageData(noiseData, 0, 0);
    };

    /** Pre-render the vignette gradient onto vignetteCanvas. */
    const buildVignetteCache = () => {
      const pw = Math.round(width * dpr);
      const ph = Math.round(height * dpr);
      vignetteCanvas.width = pw;
      vignetteCanvas.height = ph;
      const vctx = vignetteCanvas.getContext('2d');
      if (!vctx) return;
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      vctx.clearRect(0, 0, width, height);

      const isDark = themeRef.current === 'dark';
      const vignette = vctx.createLinearGradient(0, 0, 0, height);
      vignette.addColorStop(0, `rgba(255,255,255,${glowTopAlpha})`);
      vignette.addColorStop(0.18, `rgba(255,255,255,${glowTopAlpha * 0.35})`);
      vignette.addColorStop(0.35, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.68, isDark
        ? `rgba(0,0,0,${0.06 * glowStrength})`
        : `rgba(255,255,255,${0.05 * glowStrength})`);
      vignette.addColorStop(1, isDark
        ? `rgba(0,0,0,${0.14 * glowStrength})`
        : `rgba(255,255,255,${0.12 * glowStrength})`);
      vctx.fillStyle = vignette;
      vctx.fillRect(0, 0, width, height);
    };

    /**
     * Pre-render a soft radial glow halo onto glowSpriteCanvas.
     * Stamped at each particle head via drawImage — replaces per-particle shadowBlur.
     */
    const buildGlowSprite = () => {
      // Size the sprite to contain the full glow extent at current scale/strength.
      const glowBlurExtent = glowStrength * 20 * scale;
      const maxParticleRadius = 3.8 * scale; // (1.2 + 2.6) * scale
      const extent = maxParticleRadius + glowBlurExtent + 4; // +4 px safety margin
      glowSpriteLogical = Math.ceil(extent * 2);
      // Build at half resolution — upscale on blit smooths gradient banding.
      const spriteScale = 2;
      const spritePixels = Math.ceil(glowSpriteLogical * dpr / spriteScale);
      glowSpriteCanvas.width = spritePixels;
      glowSpriteCanvas.height = spritePixels;
      const gctx = glowSpriteCanvas.getContext('2d');
      if (!gctx) return;
      gctx.setTransform(dpr / spriteScale, 0, 0, dpr / spriteScale, 0, 0);
      gctx.clearRect(0, 0, glowSpriteLogical, glowSpriteLogical);

      if (glowStrength <= 0) return;

      const cx = glowSpriteLogical / 2;
      const cy = glowSpriteLogical / 2;
      // Pure soft halo — the circle itself is drawn to pctx per pattern.
      // 12-stop exponential falloff on exp(-k*r²) reduces gradient quantization bands.
      const grad = gctx.createRadialGradient(cx, cy, 0, cx, cy, extent);
      const SPRITE_STOPS = 12;
      const peakAlpha = alphaBase * 0.45 * glowStrength;
      for (let s = 0; s <= SPRITE_STOPS; s++) {
        const r = s / SPRITE_STOPS;
        const falloff = Math.exp(-3.5 * r * r);
        grad.addColorStop(r, r === 1 ? 'rgba(0,0,0,0)' : rgba(effectColor, peakAlpha * falloff));
      }
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, glowSpriteLogical, glowSpriteLogical);

      // Break gradient quantization bands — one-time cost per sprite rebuild.
      // Perturb only the alpha channel so hue is unaffected.
      const noiseData = gctx.getImageData(0, 0, spritePixels, spritePixels);
      const nd = noiseData.data;
      for (let i = 3; i < nd.length; i += 4) {
        nd[i] = Math.min(255, Math.max(0, nd[i] + (Math.random() * 2 - 1)));
      }
      gctx.putImageData(noiseData, 0, 0);
    };

    // ---------------------------------------------------------------------------
    // Particle / scene helpers
    // ---------------------------------------------------------------------------

    // Reinitialise particles/swirls from current refs — cheap, no canvas resize.
    const initParticles = () => {
      scale = clamp(sizeRef.current / 100, 0.45, 2);
      const starDensity = 0.75 + clamp(intensityRef.current / 100, 0.08, 1) * 0.45;
      swirls = createSwirls(width, height, scale);
      points = createPoints(width, height, scale, starDensity);
      petalCount = Math.max(18, Math.round(points.length * 0.55));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      trailCanvas.width = canvas.width;
      trailCanvas.height = canvas.height;
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
      // Force offscreen cache rebuild on next frame (dimensions changed).
      cacheKey = '';
    };

    /**
     * Record each particle's current position into its ring buffer.
     * Called once per frame BEFORE the pattern draw function moves particles.
     * Detects wrap-around teleports and resets history to avoid cross-screen trail lines.
     */
    const recordPositions = () => {
      for (const point of points) {
        // Teleport detection: large position jump means the particle wrapped the screen.
        // Reset history so the trail doesn't draw a line across the canvas.
        if (point.histLen > 0) {
          const prevIdx = ((point.histHead - 1) % TRAIL_MAX_POSITIONS + TRAIL_MAX_POSITIONS) % TRAIL_MAX_POSITIONS;
          const dx = point.x - point.history[prevIdx * 2];
          const dy = point.y - point.history[prevIdx * 2 + 1];
          if (Math.abs(dx) > 150 || Math.abs(dy) > 150) {
            point.histLen = 0;
            point.histHead = 0;
          }
        }
        const idx = point.histHead;
        point.history[idx * 2] = point.x;
        point.history[idx * 2 + 1] = point.y;
        point.histHead = (idx + 1) % TRAIL_MAX_POSITIONS;
        if (point.histLen < TRAIL_MAX_POSITIONS) point.histLen++;
      }
    };

    /**
     * Draw per-particle trail polylines onto pctx from the ring buffer.
     * Alpha ramps 1 → 0 (head → tail). No shadow — glow applied separately
     * via drawGlowSprites() on the main canvas to avoid O(r²) × particle-count cost.
     */
    const drawTrails = (trailAmount: number) => {
      if (trailAmount <= 0) return;
      const nPositions = Math.min(
        Math.round(TRAIL_MAX_POSITIONS * trailAmount / 100),
        TRAIL_MAX_POSITIONS,
      );
      if (nPositions < 1) return;

      pctx.lineCap = 'round';

      for (const point of points) {
        const count = Math.min(nPositions, point.histLen);
        if (count < 1) continue;

        // Walk from most-recent history entry (just behind head) toward oldest.
        // prevX/Y starts at the current particle position so segment 0 connects
        // the visible head to the most-recently-recorded position.
        let prevX = point.x;
        let prevY = point.y;

        for (let i = 0; i < count; i++) {
          const ringIdx =
            ((point.histHead - 1 - i) % TRAIL_MAX_POSITIONS + TRAIL_MAX_POSITIONS)
            % TRAIL_MAX_POSITIONS;
          const hx = point.history[ringIdx * 2];
          const hy = point.history[ringIdx * 2 + 1];
          // i=0 is full alpha (near head), i=count-1 approaches 0 (tail).
          const alpha = 1 - i / count;
          pctx.strokeStyle = rgba(effectColor, alphaBase * 0.55 * alpha);
          pctx.lineWidth = point.radius * (0.8 + 0.4 * alpha);
          pctx.beginPath();
          pctx.moveTo(prevX, prevY);
          pctx.lineTo(hx, hy);
          pctx.stroke();
          prevX = hx;
          prevY = hy;
        }
      }
    };

    /**
     * Stamp the pre-rendered glow sprite at each particle head on the main canvas.
     * Uses 'lighter' blend so halos add light without clipping.
     * Only called for patterns that use the points[] array as particle heads.
     */
    const drawGlowSprites = () => {
      if (glowStrength <= 0 || glowSpriteLogical <= 0) return;
      const sw = glowSpriteCanvas.width;
      const sh = glowSpriteCanvas.height;
      const half = glowSpriteLogical / 2;
      context.globalCompositeOperation = 'lighter';
      for (const point of points) {
        context.drawImage(
          glowSpriteCanvas, 0, 0, sw, sh,
          point.x - half, point.y - half, glowSpriteLogical, glowSpriteLogical,
        );
      }
      context.globalCompositeOperation = 'source-over';
    };

    // ---------------------------------------------------------------------------
    // Pattern draw functions — write to pctx, also move particles this frame.
    // ---------------------------------------------------------------------------

    const stepPoints = (speedMultiplier: number, dt: number) => {
      const speedScale = speedMultiplier * 0.05 * dt;
      for (const point of points) {
        point.x += point.vx * speedScale;
        point.y += point.vy * speedScale;
        point.twinkle += speedMultiplier * 0.0015 * dt;
        if (point.x < -20) point.x = width + 20;
        if (point.x > width + 20) point.x = -20;
        if (point.y < -20) point.y = height + 20;
        if (point.y > height + 20) point.y = -20;
      }
    };

    const drawSparkles = (time: number, dt: number) => {
      stepPoints(reducedMotion ? 0.8 : 1.6, dt);
      for (const point of points) {
        const twinkle = 0.35 + ((Math.sin(time * 0.0015 + point.twinkle) + 1) / 2) * 0.65;
        pctx.strokeStyle = rgba(effectColor, alphaBase * 0.22 * twinkle);
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.moveTo(point.x - point.radius * 3, point.y);
        pctx.lineTo(point.x + point.radius * 3, point.y);
        pctx.moveTo(point.x, point.y - point.radius * 3);
        pctx.lineTo(point.x, point.y + point.radius * 3);
        pctx.stroke();

        pctx.fillStyle = rgba(effectColor, alphaBase * 0.6 * twinkle);
        pctx.beginPath();
        pctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        pctx.fill();
      }
    };

    const drawDots = () => {
      const spacing = 20 * scale;
      pctx.fillStyle = rgba(effectColor, alphaBase * 0.22);
      for (let y = spacing; y < height; y += spacing) {
        for (let x = spacing; x < width; x += spacing) {
          pctx.beginPath();
          pctx.arc(x, y, 0.8 * scale, 0, Math.PI * 2);
          pctx.fill();
        }
      }
    };

    const drawSynapse = (time: number) => {
      const spacing = 24 * scale;
      pctx.strokeStyle = rgba(effectColor, alphaBase * 0.08);
      pctx.lineWidth = 1;
      for (let x = 0; x < width; x += spacing) {
        pctx.beginPath();
        pctx.moveTo(x, 0);
        pctx.lineTo(x, height);
        pctx.stroke();
      }
      for (let y = 0; y < height; y += spacing) {
        pctx.beginPath();
        pctx.moveTo(0, y);
        pctx.lineTo(width, y);
        pctx.stroke();
      }

      const pulseCount = reducedMotion ? 5 : Math.max(10, Math.round(16 * alphaBase));
      for (let index = 0; index < pulseCount; index += 1) {
        const horizontal = index % 2 === 0;
        const line = (index * 7) % Math.max(1, Math.ceil((horizontal ? height : width) / spacing));
        const position = ((time * (0.09 + index * 0.006)) + index * 97) % ((horizontal ? width : height) + 140) - 70;
        const x = horizontal ? position : line * spacing;
        const y = horizontal ? line * spacing : position;
        const gradient = horizontal
          ? pctx.createLinearGradient(x - 28 * scale, y, x + 8 * scale, y)
          : pctx.createLinearGradient(x, y - 28 * scale, x, y + 8 * scale);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, rgba(effectColor, alphaBase * 0.5));
        pctx.strokeStyle = gradient;
        pctx.lineWidth = 1.2 * scale;
        pctx.beginPath();
        if (horizontal) {
          pctx.moveTo(x - 30 * scale, y);
          pctx.lineTo(x + 8 * scale, y);
        } else {
          pctx.moveTo(x, y - 30 * scale);
          pctx.lineTo(x, y + 8 * scale);
        }
        pctx.stroke();
        pctx.fillStyle = rgba(effectColor, alphaBase * 0.55);
        pctx.beginPath();
        pctx.arc(x, y, 1.6 * scale, 0, Math.PI * 2);
        pctx.fill();
      }
    };

    const drawRain = (dt: number) => {
      for (const point of points) {
        point.y += (reducedMotion ? 0.12 : (1.4 + point.radius) * (0.35 + alphaBase)) * dt;
        if (point.y > height + 80) {
          point.y = -40;
          point.x = Math.random() * width;
        }
        const length = (26 + point.radius * 11) * scale;
        const gradient = pctx.createLinearGradient(point.x, point.y - length, point.x, point.y);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, rgba(effectColor, alphaBase * 0.44));
        pctx.strokeStyle = gradient;
        pctx.lineWidth = 1.2 * scale;
        pctx.beginPath();
        pctx.moveTo(point.x, point.y - length);
        pctx.lineTo(point.x, point.y);
        pctx.stroke();
      }
    };

    const drawPerlinFlow = (time: number, dt: number) => {
      const segLength = Math.max(6, scale * 14);
      for (const point of points) {
        const angle = Math.sin(point.x * 0.006 + time * 0.0007) * Math.PI
          + Math.cos(point.y * 0.005 + time * 0.00045);
        const stepX = Math.cos(angle) * (reducedMotion ? 0.08 : 0.9 * scale) * dt;
        const stepY = Math.sin(angle) * (reducedMotion ? 0.08 : 0.9 * scale) * dt;
        point.x += stepX;
        point.y += stepY;
        point.twinkle -= 0.003 * dt;

        if (point.x < -20 || point.x > width + 20 || point.y < -20 || point.y > height + 20 || point.twinkle < -1) {
          point.x = Math.random() * width;
          point.y = Math.random() * height;
          point.twinkle = Math.random() * Math.PI * 2;
          continue;
        }

        const mag = Math.hypot(stepX, stepY) || 1;
        const dirX = stepX / mag;
        const dirY = stepY / mag;
        pctx.strokeStyle = rgba(effectColor, alphaBase * 0.3);
        pctx.lineWidth = Math.max(0.4, point.radius * 0.6);
        pctx.lineCap = 'round';
        pctx.beginPath();
        pctx.moveTo(point.x - dirX * segLength, point.y - dirY * segLength);
        pctx.lineTo(point.x, point.y);
        pctx.stroke();
      }
    };

    const drawPetals = (time: number, dt: number) => {
      for (let i = 0; i < petalCount && i < points.length; i += 1) {
        const point = points[i];
        point.y += (reducedMotion ? 0.06 : (0.28 + point.radius * 0.12) * scale) * dt;
        point.x += Math.sin(time * 0.001 + point.twinkle) * 0.35 * scale;
        point.twinkle += 0.012 * dt;
        if (point.y > height + 20) {
          point.y = -20;
          point.x = Math.random() * width;
        }
        pctx.save();
        pctx.translate(point.x, point.y);
        pctx.rotate(point.twinkle);
        pctx.fillStyle = rgba(effectColor, alphaBase * 0.24);
        pctx.beginPath();
        pctx.ellipse(0, 0, point.radius * 2.2, point.radius * 0.85, 0.35, 0, Math.PI * 2);
        pctx.fill();
        pctx.restore();
      }
    };

    const drawEmbers = (dt: number) => {
      for (const point of points) {
        point.y -= (reducedMotion ? 0.04 : (0.25 + point.radius * 0.08) * scale) * dt;
        point.x += Math.sin(point.twinkle) * 0.22 * scale * dt;
        point.twinkle += 0.018 * dt;
        if (point.y < -20) {
          point.y = height + 20;
          point.x = Math.random() * width;
        }
        const glow = 0.25 + ((Math.sin(point.twinkle) + 1) / 2) * 0.75;
        pctx.fillStyle = rgba(effectColor, alphaBase * 0.42 * glow);

        if (point.emberSpark) {
          pctx.beginPath();
          pctx.arc(point.x, point.y, point.radius * 0.45, 0, Math.PI * 2);
          pctx.fill();
          continue;
        }

        const flakeSize = point.radius * 1.6;
        const rotation = point.emberRot + point.twinkle * 0.4;
        pctx.save();
        pctx.translate(point.x, point.y);
        pctx.rotate(rotation);
        pctx.beginPath();
        for (let side = 0; side < point.emberSides; side += 1) {
          const angle = (side / point.emberSides) * Math.PI * 2;
          const radius = side % 2 === 0 ? flakeSize : flakeSize * 0.45;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius * 0.55;
          if (side === 0) pctx.moveTo(px, py);
          else pctx.lineTo(px, py);
        }
        pctx.closePath();
        pctx.fill();
        pctx.restore();
      }
    };

    const drawConstellations = (time: number, dt: number) => {
      stepPoints(reducedMotion ? 0.7 : 1.25, dt);

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        pctx.fillStyle = rgba(effectColor, alphaBase * 0.52);
        pctx.beginPath();
        pctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        pctx.fill();

        for (let compareIndex = index + 1; compareIndex < points.length; compareIndex += 1) {
          const compare = points[compareIndex];
          const dx = point.x - compare.x;
          const dy = point.y - compare.y;
          const distance = Math.hypot(dx, dy);
          const limit = 180 * scale;
          if (distance > limit) continue;

          const distanceAlpha = (1 - distance / limit) * alphaBase * 0.16;
          pctx.strokeStyle = rgba(effectColor, distanceAlpha);
          pctx.lineWidth = 1;
          pctx.beginPath();
          pctx.moveTo(point.x, point.y);
          pctx.lineTo(compare.x, compare.y);
          pctx.stroke();
        }
      }

      const haloX = width * (0.5 + Math.sin(time * 0.00018) * 0.12);
      const haloY = height * (0.42 + Math.cos(time * 0.00014) * 0.1);
      const haloRadius = Math.min(width, height) * (0.18 + scale * 0.08);
      const gradient = pctx.createRadialGradient(haloX, haloY, 0, haloX, haloY, haloRadius);
      gradient.addColorStop(0, rgba(effectColor, alphaBase * 0.12));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      pctx.fillStyle = gradient;
      pctx.beginPath();
      pctx.arc(haloX, haloY, haloRadius, 0, Math.PI * 2);
      pctx.fill();
    };

    const drawSwirls = (time: number, dt: number) => {
      const rotation = reducedMotion ? 0.00006 : 0.00018;
      const baseRadius = Math.min(width, height) * 0.06 * scale;

      for (const swirl of swirls) {
        const cx = swirl.anchorX + Math.cos(time * rotation * swirl.speed + swirl.phase) * swirl.orbitX * 0.32;
        const cy = swirl.anchorY + Math.sin(time * rotation * swirl.speed * 0.78 + swirl.phase) * swirl.orbitY * 0.24;
        pctx.beginPath();
        for (let step = 0; step < 48; step += 1) {
          const stepRatio = step / 47;
          const angle = (time * rotation * (1.6 + swirl.speed)) + swirl.phase + stepRatio * Math.PI * 3.4;
          const radius = baseRadius + stepRatio * (110 * scale);
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius * 0.55;
          if (step === 0) pctx.moveTo(px, py);
          else pctx.lineTo(px, py);
        }
        pctx.strokeStyle = rgba(effectColor, alphaBase * 0.18);
        pctx.lineWidth = swirl.width;
        pctx.stroke();

        pctx.fillStyle = rgba(effectColor, alphaBase * 0.24);
        pctx.beginPath();
        pctx.arc(cx, cy, 4 * scale, 0, Math.PI * 2);
        pctx.fill();
      }

      for (const point of points) {
        point.twinkle += (reducedMotion ? 0.005 : 0.015) * dt;
        const orbit = 14 * scale;
        const px = point.x + Math.cos(point.twinkle) * orbit;
        const py = point.y + Math.sin(point.twinkle * 1.2) * orbit * 0.6;
        pctx.fillStyle = rgba(effectColor, alphaBase * 0.22);
        pctx.beginPath();
        pctx.arc(px, py, point.radius, 0, Math.PI * 2);
        pctx.fill();
      }
    };

    // ---------------------------------------------------------------------------
    // Main render loop
    // ---------------------------------------------------------------------------

    const render = (time: number) => {
      // Pattern or size changed — reinitialise particles without touching the canvas.
      if (needsParticleResetRef.current) {
        needsParticleResetRef.current = false;
        initParticles();
        cacheKey = '';
      }

      const currentPattern = patternRef.current;
      const dt = lastTime === 0 ? 1 : clamp((time - lastTime) / (1000 / 60), 0.25, 3);
      lastTime = time;

      effectColor = normalizeHex(colorRef.current) || getPaletteFallbackColor(themeRef.current);
      glowColorValue = normalizeHex(glowColorRef.current) || effectColor;
      alphaBase = clamp(intensityRef.current / 100, 0.08, 1);
      glowStrength = clamp(glowRef.current, 0, 100) / 100;
      glowTopAlpha = (themeRef.current === 'dark' ? 0.08 : 0.34) * glowStrength;

      // Rebuild offscreen caches when any of their inputs change.
      const newCacheKey = `${width}x${height}|${dpr}|${effectColor}|${glowColorValue}|${glowStrength.toFixed(3)}|${alphaBase.toFixed(3)}|${themeRef.current}|${scale.toFixed(3)}`;
      if (newCacheKey !== cacheKey) {
        cacheKey = newCacheKey;
        if (glowStrength > 0) {
          buildBloomCache();
          buildVignetteCache();
        }
        buildGlowSprite();
      }

      // Visible canvas: fully cleared every frame.
      context.clearRect(0, 0, width, height);

      // Trail/particle canvas: cleared every frame — ring buffers hold the history.
      // No destination-out, no sweep pass, no fade floor artifacts.
      pctx.clearRect(0, 0, width, height);

      // Ambient glow wash — single blit of pre-rendered bloom cache.
      if (glowStrength > 0 && bloomCanvas.width > 0) {
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.drawImage(bloomCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height, 0, 0, width, height);
        context.restore();
      }

      // Record positions before movement (ring buffer step), then draw trail segments.
      const trailAmount = clamp(trailRef.current, 0, 100);
      const wantsTrail = currentPattern !== 'dots' && trailAmount > 0;
      if (wantsTrail) {
        recordPositions();
      }
      if (currentPattern !== 'dots') {
        drawTrails(trailAmount);
      }

      // Draw particle heads (also advances particle positions this frame).
      switch (currentPattern) {
        case 'dots':
          drawDots();
          break;
        case 'synapse':
          drawSynapse(time);
          break;
        case 'rain':
          drawRain(dt);
          break;
        case 'constellations':
          drawConstellations(time, dt);
          break;
        case 'perlin-flow':
          drawPerlinFlow(time, dt);
          break;
        case 'petals':
          drawPetals(time, dt);
          break;
        case 'sparkles':
          drawSparkles(time, dt);
          break;
        case 'embers':
          drawEmbers(dt);
          break;
        case 'swirls':
        default:
          drawSwirls(time, dt);
          break;
      }

      // Composite the particle/trail layer over the glow wash.
      context.drawImage(trailCanvas, 0, 0, trailCanvas.width, trailCanvas.height, 0, 0, width, height);

      // Per-particle glow sprites at head positions.
      // Skipped for patterns whose "heads" aren't stored in points[] (synapse, dots).
      if (currentPattern !== 'dots' && currentPattern !== 'synapse') {
        drawGlowSprites();
      }

      // Vignette — single blit of pre-rendered cache.
      if (glowStrength > 0 && vignetteCanvas.width > 0) {
        context.drawImage(
          vignetteCanvas, 0, 0, vignetteCanvas.width, vignetteCanvas.height, 0, 0, width, height,
        );
      }

      const shouldAnimate = !reducedMotion && currentPattern !== 'dots';
      if (shouldAnimate) {
        frame = window.requestAnimationFrame(render);
      }
    };

    const handleResize = () => {
      resize();
      const p = patternRef.current;
      const shouldAnimate = !reducedMotion && p !== 'dots';
      if (!shouldAnimate) render(performance.now());
    };

    resize();
    render(performance.now());
    window.addEventListener('resize', handleResize);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      context.clearRect(0, 0, width, height);
      pctx.clearRect(0, 0, width, height);
    };
  }, [isNone]);

  if (pattern === 'none') {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="app-window-bg-effect absolute inset-0"
        style={{ background: 'transparent', willChange: 'transform' }}
        data-bg-effect-pattern={pattern}
        aria-hidden
      />
    </div>
  );
}
