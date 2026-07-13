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
  particleGlow?: number;
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
  /** Per-particle glow-sprite alpha 0–1. Patterns set this each frame; 1 = full halo. */
  glowA: number;
  /** Per-particle glow-sprite radius multiplier. 1 = the sprite's natural size. */
  glowR: number;
  /** Ember lifecycle: 1 = freshly lit, 0 = burnt out. */
  emberLife: number;
  /** Fuel 0.15–1.0. Skewed dim via cubic distribution — most embers are cooling, occasional bright sparks. */
  emberFuel: number;
  /** Remaining fast burnout fade in ms, 0 = alive or fully dead. Set once emberLife hits 0. */
  emberFadeMs: number;
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
 * Sized to support the 500% slider max: Math.round(12 * (500/100)) = 60 positions.
 * At 60 fps that gives ~1 s of history at full trail; at 100% slider ~0.2 s.
 */
const TRAIL_MAX_POSITIONS = 60;

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
    // Staggered so embers don't all ignite and die in lockstep.
    glowA: 1,
    glowR: 1,
    emberLife: Math.random(),
    // Cubic distribution: most embers are dim (cooling), rare bright sparks near 1.0.
    emberFuel: 0.15 + Math.pow(Math.random(), 3) * 0.85,
    emberFadeMs: 0,
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
  particleGlow = 45,
  trail = 0,
  theme,
}: BgEffectLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorRef = useRef(color);
  const glowColorRef = useRef(glowColor);
  const intensityRef = useRef(intensity);
  const glowRef = useRef(glowIntensity);
  const particleGlowRef = useRef(particleGlow);
  const trailRef = useRef(trail);
  const themeRef = useRef(theme);
  // Track pattern and size via refs so switching effects doesn't tear down the canvas.
  const patternRef = useRef(pattern);
  const sizeRef = useRef(size);
  const needsParticleResetRef = useRef(false);
  // The RAF loop intentionally stops scheduling itself for static patterns (dots) or
  // reduced-motion. Switching to an animated pattern afterward only flips patternRef —
  // it doesn't run any code — so without this, the loop stays dead until something
  // else (resize, mount) happens to kick it. These let the prop-sync effect below
  // restart the loop itself when the pattern changes out of a stopped state.
  const loopAliveRef = useRef(false);
  const restartLoopRef = useRef<(() => void) | null>(null);

  // Cheap prop sync — never triggers canvas/RAF teardown.
  useEffect(() => {
    const prevPattern = patternRef.current;
    const prevSize = sizeRef.current;
    colorRef.current = color;
    glowColorRef.current = glowColor;
    intensityRef.current = intensity;
    glowRef.current = glowIntensity;
    particleGlowRef.current = particleGlow;
    trailRef.current = trail;
    themeRef.current = theme;
    patternRef.current = pattern;
    sizeRef.current = size;
    if (prevPattern !== pattern || prevSize !== size) {
      needsParticleResetRef.current = true;
    }
    // The loop stops scheduling itself for static patterns (dots) or reduced-motion.
    // Any prop change while stopped — not just a pattern change — needs a fresh
    // single frame or the canvas silently keeps showing stale color/intensity/glow
    // values (e.g. tweaking Intensity while on Dots never repaints).
    if (!loopAliveRef.current) {
      restartLoopRef.current?.();
    }
  }, [color, glowColor, intensity, glowIntensity, particleGlow, trail, theme, pattern, size]);

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
    let particleGlowStrength = clamp(particleGlowRef.current, 0, 100) / 100;
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
      const washPeak = 0.24 * glowStrength;
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
      // Uses particleGlowStrength (independent of background bloom glowStrength).
      const glowBlurExtent = particleGlowStrength * 20 * scale;
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

      if (particleGlowStrength <= 0) return;

      const cx = glowSpriteLogical / 2;
      const cy = glowSpriteLogical / 2;
      // Pure soft halo — the circle itself is drawn to pctx per pattern.
      // 12-stop exponential falloff on exp(-k*r²) reduces gradient quantization bands.
      const grad = gctx.createRadialGradient(cx, cy, 0, cx, cy, extent);
      const SPRITE_STOPS = 12;
      const peakAlpha = 0.5 * particleGlowStrength;
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
      const rawIntensity = clamp(intensityRef.current / 100, 0.08, 1);
      // S4a: Embers get 2× density headroom — 50% slider = current 100% density, 100% = 2× max.
      // Other patterns use rawIntensity unchanged.
      const emberEffectiveIntensity = patternRef.current === 'embers'
        ? Math.min(rawIntensity * 2.0, 2.0)
        : rawIntensity;
      const starDensity = 0.75 + emberEffectiveIntensity * 0.45;
      // Embers get ~1.75× more particles than other patterns without touching MAX_PARTICLES.
      const emberDensityMultiplier = patternRef.current === 'embers' ? 1.75 : 1;
      swirls = createSwirls(width, height, scale);
      points = createPoints(width, height, scale, starDensity * emberDensityMultiplier);
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
      // Scale: 12 positions at 100%, 60 positions at 500% (slider max).
      const nPositions = Math.min(
        Math.round(12 * (trailAmount / 100)),
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
      if (particleGlowStrength <= 0 || glowSpriteLogical <= 0) return;
      const sw = glowSpriteCanvas.width;
      const sh = glowSpriteCanvas.height;
      context.globalCompositeOperation = 'lighter';
      const prevAlpha = context.globalAlpha;
      for (const point of points) {
        // Halos must track the particle they belong to. Stamping one fixed-size,
        // fixed-alpha sprite on every particle made every particle an identical
        // blob AND kept embers glowing at full brightness after their core had
        // burnt out — the fade was invisible behind a halo that never faded.
        const a = point.glowA;
        if (a <= 0.004) continue;
        const size = glowSpriteLogical * point.glowR;
        if (size <= 0.5) continue;
        const h = size / 2;
        context.globalAlpha = a;
        context.drawImage(
          glowSpriteCanvas, 0, 0, sw, sh,
          point.x - h, point.y - h, size, size,
        );
      }
      context.globalAlpha = prevAlpha;
      context.globalCompositeOperation = 'source-over';
    };

    // ---------------------------------------------------------------------------
    // Pattern draw functions — write to pctx, also move particles this frame.
    // ---------------------------------------------------------------------------

    const stepPoints = (speedMultiplier: number, dt: number) => {
      const speedScale = speedMultiplier * 0.05 * dt;
      for (const point of points) {
        // Non-ember patterns use an unmodulated halo.
        point.glowA = 1;
        point.glowR = 1;
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

      const { r: nr, g: ng, b: nb } = hexToRgb(effectColor);
      const nodeAlpha = alphaBase * 0.55;

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
        // S5: clean filled circle at the HEAD of the trail (the bright leading tip).
        // The stroke runs from -30*scale (tail) to +8*scale (head), so the dot must
        // be placed at the +8*scale end — not at x,y which is behind the head.
        const dotX = horizontal ? x + 8 * scale : x;
        const dotY = horizontal ? y : y + 8 * scale;
        pctx.save();
        pctx.beginPath();
        pctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        pctx.fillStyle = `rgba(${nr}, ${ng}, ${nb}, ${nodeAlpha})`;
        pctx.fill();
        pctx.restore();
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

    // Rain's trail idea, but radial: streaks fly outward from center instead of
    // falling straight down, accelerating and lengthening as they approach the
    // edge — the classic hyperspace-jump/warp-speed starfield read. Direction is
    // recomputed from each point's current position relative to center every
    // frame (not stored), so a point always continues along the same radial line
    // it's already on regardless of how it got there — no separate spawn-angle
    // field needed on MovingPoint.
    const drawWarp = (dt: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const maxDist = Math.hypot(centerX, centerY) || 1;
      for (const point of points) {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const angle = Math.atan2(dy, dx);
        const radiusFrac = clamp(dist / maxDist, 0, 1);

        if (point.x < -60 || point.x > width + 60 || point.y < -60 || point.y > height + 60) {
          const spawnAngle = Math.random() * Math.PI * 2;
          const spawnRadius = Math.random() * 18 * scale;
          point.x = centerX + Math.cos(spawnAngle) * spawnRadius;
          point.y = centerY + Math.sin(spawnAngle) * spawnRadius;
          continue;
        }

        const speed = (reducedMotion ? 0.15 : 0.5 + radiusFrac * radiusFrac * 3.4) * scale * dt;
        point.x += Math.cos(angle) * speed;
        point.y += Math.sin(angle) * speed;

        const streakLength = (14 + radiusFrac * 52) * scale;
        const tailX = point.x - Math.cos(angle) * streakLength;
        const tailY = point.y - Math.sin(angle) * streakLength;
        const gradient = pctx.createLinearGradient(tailX, tailY, point.x, point.y);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, rgba(effectColor, alphaBase * (0.32 + radiusFrac * 0.4)));
        pctx.strokeStyle = gradient;
        pctx.lineWidth = Math.max(1, (1.1 + radiusFrac * 1.6) * scale);
        pctx.beginPath();
        pctx.moveTo(tailX, tailY);
        pctx.lineTo(point.x, point.y);
        pctx.stroke();

        pctx.beginPath();
        pctx.arc(point.x, point.y, (1 + radiusFrac * 1.5) * scale, 0, Math.PI * 2);
        pctx.fillStyle = rgba(effectColor, alphaBase * (0.55 + radiusFrac * 0.35));
        pctx.fill();
      }
    };

    const drawPerlinFlow = (time: number, dt: number) => {
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

        // S6: filled dot head — tail is drawn by the shared drawTrails() ring-buffer path.
        pctx.beginPath();
        pctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
        pctx.fillStyle = rgba(effectColor, alphaBase * 0.6);
        pctx.fill();
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

    // Fixed real-time burnout window (not a fraction of the variable lifespan) —
    // an ember holds its glow at a near-constant level, then cuts out over this
    // many milliseconds once its fuel is spent. ~1/8s reads as a snap, not a fade.
    const EMBER_FADE_MS = 130;

    const drawEmbers = (dt: number) => {
      const frameMs = dt * (1000 / 60);
      // At lower intensity fewer particles spread out — compensate with slightly larger radius.
      const emberSizeFactor = 1.0 + (1.0 - alphaBase) * 0.5;
      // Size maps 0–1 across the createPoints radius range (1.2–3.8 × scale) — bigger
      // embers both climb higher and burn brighter; smaller ones stay low.
      for (const point of points) {
        const sizeFrac = clamp((point.radius / scale - 1.2) / 2.6, 0, 1);

        // ── Death fade: fixed-duration snap-out, independent of drainRate/fuel ──
        if (point.emberFadeMs > 0) {
          point.emberFadeMs = Math.max(0, point.emberFadeMs - frameMs);
          const fadeT = point.emberFadeMs / EMBER_FADE_MS; // 1 → 0

          // Vortex keeps carrying the ember through its final flicker instead of
          // freezing it mid-air while it cuts out.
          point.twinkle += (0.05 + sizeFrac * 0.03) * dt;
          point.y -= (reducedMotion ? 0.02 : 0.05 + sizeFrac * 0.12) * scale * dt;
          point.x += Math.cos(point.twinkle) * 0.12 * scale * dt;

          point.glowA = fadeT * (0.65 + sizeFrac * 0.35);
          point.glowR = (0.5 + sizeFrac * 0.3) * fadeT;
          const fadeAlpha = alphaBase * 0.55 * fadeT;
          if (fadeAlpha > 0.004) {
            pctx.beginPath();
            pctx.arc(point.x, point.y, Math.max(0.4, point.radius * emberSizeFactor * (0.4 + 0.5 * fadeT)), 0, Math.PI * 2);
            pctx.fillStyle = rgba(effectColor, fadeAlpha);
            pctx.fill();
          }

          if (point.emberFadeMs <= 0) {
            // Respawn burnt-out embers at the bottom with a fresh lifecycle.
            point.x = Math.random() * width;
            point.y = height + 10 + Math.random() * 30;
            point.emberLife = 0.75 + Math.random() * 0.25;
            point.emberFuel = 0.15 + Math.pow(Math.random(), 3) * 0.85;
            point.vx = 0;
            point.twinkle = Math.random() * Math.PI * 2;
          }
          continue;
        }

        // ── Lifecycle drain ──────────────────────────────────────────────────
        // Less fuel → faster burnout. Clamp dt so a tab-hidden burst doesn't
        // incinerate the whole field at once.
        const drainRate = (0.00055 + (1 - point.emberFuel) * 0.0008) * dt;
        point.emberLife = Math.max(0, point.emberLife - drainRate);

        // Stochastic abrupt extinction: dim embers have a small per-frame chance
        // of winking out instantly rather than draining all the way to zero.
        const winkOut = point.emberFuel < 0.3 && Math.random() < 0.006;
        if (point.emberLife <= 0 || winkOut) {
          point.emberFadeMs = EMBER_FADE_MS;
          continue;
        }

        // ── Vortex rise ──────────────────────────────────────────────────────
        // Bigger/hotter embers climb faster and farther; small ones drift lazily
        // and burn out before gaining much altitude. A tightening spiral (vortex
        // radius shrinks with height) rides on top of the straight-up buoyancy,
        // like a heat plume rather than a straight column.
        // ── Ambient draft ────────────────────────────────────────────────────
        // A handful of invisible updrafts (reusing the same anchor points
        // drawSwirls seeds) are spread across the screen. Spin direction is
        // decided by which side of the nearest draft an ember sits on —
        // anticlockwise to its left, clockwise to its right — the way smoke
        // curls around a rising thermal, instead of every ember independently
        // picking its own random spin. Embers near a draft center also get an
        // extra upward push, tapering off with distance.
        let nearestDraft = swirls[0];
        let nearestDraftDist = Infinity;
        for (const draft of swirls) {
          const d = Math.abs(point.x - draft.anchorX);
          if (d < nearestDraftDist) { nearestDraftDist = d; nearestDraft = draft; }
        }
        const draftPull = clamp(1 - nearestDraftDist / (260 * scale), 0, 1);
        const spinDir = point.x >= nearestDraft.anchorX ? 1 : -1;

        const riseSpeed = reducedMotion
          ? 0.03
          : (0.09 + sizeFrac * 0.5 + point.emberFuel * 0.14 + draftPull * 0.12) * scale;
        point.y -= riseSpeed * dt;

        point.twinkle += spinDir * (0.014 + sizeFrac * 0.01 + draftPull * 0.02) * dt;
        const vortexRadius = (2 + sizeFrac * 5) * scale * clamp(point.emberLife * 1.6, 0.15, 1) * (0.5 + draftPull * 0.5);
        point.vx = point.vx * 0.9 + Math.cos(point.twinkle) * 0.05;
        point.x += (point.vx + Math.sin(point.twinkle) * 0.05) * vortexRadius * dt;

        // ── Near-constant glow while alive ──────────────────────────────────
        // The dramatic brightness swing now lives entirely in the death fade
        // above — while alive the ember just flickers gently, it doesn't ramp
        // up and back down on its own.
        const flicker = 0.82 + ((Math.sin(point.twinkle * 4.2) + 1) / 2) * 0.18;

        // Spawn fade-in over the first 6% of life consumed — avoids pop-in.
        const lifeRatio = point.emberLife / point.emberFuel;
        const spawnProgress = 1.0 - lifeRatio;
        const spawnFade = spawnProgress < 0.06 ? Math.max(0, spawnProgress) / 0.06 : 1.0;

        point.glowA = flicker * spawnFade * (0.7 + sizeFrac * 0.3);
        point.glowR = 0.5 + sizeFrac * 0.4;

        const burnAlpha = alphaBase * 0.5 * flicker * spawnFade * (0.75 + sizeFrac * 0.25);
        pctx.beginPath();
        pctx.arc(point.x, point.y, Math.max(0.6, point.radius * emberSizeFactor * (0.55 + sizeFrac * 0.25)), 0, Math.PI * 2);
        pctx.fillStyle = rgba(effectColor, burnAlpha);
        pctx.fill();
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
      particleGlowStrength = clamp(particleGlowRef.current, 0, 100) / 100;
      glowTopAlpha = (themeRef.current === 'dark' ? 0.08 : 0.34) * glowStrength;

      // Rebuild offscreen caches when any of their inputs change.
      const newCacheKey = `${width}x${height}|${dpr}|${effectColor}|${glowColorValue}|${glowStrength.toFixed(3)}|${particleGlowStrength.toFixed(3)}|${themeRef.current}|${scale.toFixed(3)}`;
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
      const trailAmount = clamp(trailRef.current, 0, 500);
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
        case 'warp':
          drawWarp(dt);
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
        loopAliveRef.current = true;
      } else {
        loopAliveRef.current = false;
      }
    };

    const handleResize = () => {
      resize();
      const p = patternRef.current;
      const shouldAnimate = !reducedMotion && p !== 'dots';
      if (!shouldAnimate) render(performance.now());
    };

    // Lets the prop-sync effect force a fresh frame after the loop stopped itself
    // for a static pattern (dots) or reduced-motion, without tearing down the
    // canvas. render() reads current ref values, paints once, and — via its own
    // shouldAnimate check — reschedules itself only if the (possibly just-changed)
    // pattern actually warrants continuous animation. So this correctly handles
    // both "pattern changed to something animated" (loop resumes) and "some other
    // prop changed while stuck on dots/reduced-motion" (one repaint, stays stopped).
    restartLoopRef.current = () => {
      if (loopAliveRef.current) return;
      render(performance.now());
    };

    resize();
    render(performance.now());
    window.addEventListener('resize', handleResize);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      context.clearRect(0, 0, width, height);
      pctx.clearRect(0, 0, width, height);
      loopAliveRef.current = false;
      restartLoopRef.current = null;
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
