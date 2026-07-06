import { useEffect, useRef } from 'react';
import type { BackgroundEffectPattern } from '../../types';

interface BgEffectLayerProps {
  pattern: BackgroundEffectPattern;
  color?: string;
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
// Trail slider (0-100) maps to a destination-out erase alpha applied per frame.
// Lower alpha = slower erase = longer-persisting trail, so the mapping is inverted
// and eased exponentially so the perceived trail length grows smoothly across the range.
const TRAIL_FADE_ALPHA_MAX = 0.35;
const TRAIL_FADE_ALPHA_MIN = 0.015;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function trailAmountToFadeAlpha(trailAmount: number) {
  const t = clamp(trailAmount, 0, 100) / 100;
  return TRAIL_FADE_ALPHA_MAX * Math.pow(TRAIL_FADE_ALPHA_MIN / TRAIL_FADE_ALPHA_MAX, t);
}

// Precomputed tileable luminance noise, used to dither large soft gradients so their
// falloff doesn't quantize into visible 8-bit bands/rings on the canvas.
function createDitherPattern(context: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 128;
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = size;
  noiseCanvas.height = size;
  const noiseCtx = noiseCanvas.getContext('2d');
  if (!noiseCtx) return null;
  const imageData = noiseCtx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const value = 128 + (Math.random() - 0.5) * 24;
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
    imageData.data[i + 3] = 255;
  }
  noiseCtx.putImageData(imageData, 0, 0);
  return context.createPattern(noiseCanvas, 'repeat');
}

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
  } satisfies MovingPoint));
}

export function BgEffectLayer({
  pattern,
  color,
  intensity = 60,
  size = 100,
  glowIntensity = 50,
  trail = 0,
  theme,
}: BgEffectLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorRef = useRef(color);
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
    intensityRef.current = intensity;
    glowRef.current = glowIntensity;
    trailRef.current = trail;
    themeRef.current = theme;
    patternRef.current = pattern;
    sizeRef.current = size;
    if (prevPattern !== pattern || prevSize !== size) {
      needsParticleResetRef.current = true;
    }
  }, [color, intensity, glowIntensity, trail, theme, pattern, size]);

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
    let alphaBase = clamp(intensityRef.current / 100, 0.08, 1);
    let glowStrength = clamp(glowRef.current, 0, 100) / 100;
    let glowBlur = glowStrength * 20;
    let glowTopAlpha = (themeRef.current === 'dark' ? 0.08 : 0.34) * glowStrength;

    // Static dither pattern to break up 8-bit banding on the large soft gradients below.
    const ditherPattern = createDitherPattern(context);

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
      initParticles();
    };

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
        context.strokeStyle = rgba(effectColor, alphaBase * 0.22 * twinkle);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(point.x - point.radius * 3, point.y);
        context.lineTo(point.x + point.radius * 3, point.y);
        context.moveTo(point.x, point.y - point.radius * 3);
        context.lineTo(point.x, point.y + point.radius * 3);
        context.stroke();

        context.fillStyle = rgba(effectColor, alphaBase * 0.6 * twinkle);
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    const drawDots = () => {
      const spacing = 20 * scale;
      context.fillStyle = rgba(effectColor, alphaBase * 0.22);
      for (let y = spacing; y < height; y += spacing) {
        for (let x = spacing; x < width; x += spacing) {
          context.beginPath();
          context.arc(x, y, 0.8 * scale, 0, Math.PI * 2);
          context.fill();
        }
      }
    };

    const drawSynapse = (time: number) => {
      const spacing = 24 * scale;
      context.strokeStyle = rgba(effectColor, alphaBase * 0.08);
      context.lineWidth = 1;
      for (let x = 0; x < width; x += spacing) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += spacing) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const pulseCount = reducedMotion ? 5 : Math.max(10, Math.round(16 * alphaBase));
      for (let index = 0; index < pulseCount; index += 1) {
        const horizontal = index % 2 === 0;
        const line = (index * 7) % Math.max(1, Math.ceil((horizontal ? height : width) / spacing));
        const position = ((time * (0.09 + index * 0.006)) + index * 97) % ((horizontal ? width : height) + 140) - 70;
        const x = horizontal ? position : line * spacing;
        const y = horizontal ? line * spacing : position;
        const gradient = horizontal
          ? context.createLinearGradient(x - 28 * scale, y, x + 8 * scale, y)
          : context.createLinearGradient(x, y - 28 * scale, x, y + 8 * scale);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, rgba(effectColor, alphaBase * 0.5));
        context.strokeStyle = gradient;
        context.lineWidth = 1.2 * scale;
        context.beginPath();
        if (horizontal) {
          context.moveTo(x - 30 * scale, y);
          context.lineTo(x + 8 * scale, y);
        } else {
          context.moveTo(x, y - 30 * scale);
          context.lineTo(x, y + 8 * scale);
        }
        context.stroke();
        context.fillStyle = rgba(effectColor, alphaBase * 0.55);
        context.beginPath();
        context.arc(x, y, 1.6 * scale, 0, Math.PI * 2);
        context.fill();
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
        const gradient = context.createLinearGradient(point.x, point.y - length, point.x, point.y);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, rgba(effectColor, alphaBase * 0.44));
        context.strokeStyle = gradient;
        context.lineWidth = 1.2 * scale;
        context.beginPath();
        context.moveTo(point.x, point.y - length);
        context.lineTo(point.x, point.y);
        context.stroke();
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
        context.strokeStyle = rgba(effectColor, alphaBase * 0.3);
        context.lineWidth = Math.max(0.4, point.radius * 0.6);
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(point.x - dirX * segLength, point.y - dirY * segLength);
        context.lineTo(point.x, point.y);
        context.stroke();
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
        context.save();
        context.translate(point.x, point.y);
        context.rotate(point.twinkle);
        context.fillStyle = rgba(effectColor, alphaBase * 0.24);
        context.beginPath();
        context.ellipse(0, 0, point.radius * 2.2, point.radius * 0.85, 0.35, 0, Math.PI * 2);
        context.fill();
        context.restore();
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
        context.fillStyle = rgba(effectColor, alphaBase * 0.42 * glow);

        if (point.emberSpark) {
          context.beginPath();
          context.arc(point.x, point.y, point.radius * 0.45, 0, Math.PI * 2);
          context.fill();
          continue;
        }

        const flakeSize = point.radius * 1.6;
        const rotation = point.emberRot + point.twinkle * 0.4;
        context.save();
        context.translate(point.x, point.y);
        context.rotate(rotation);
        context.beginPath();
        for (let side = 0; side < point.emberSides; side += 1) {
          const angle = (side / point.emberSides) * Math.PI * 2;
          const radius = side % 2 === 0 ? flakeSize : flakeSize * 0.45;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius * 0.55;
          if (side === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
        context.restore();
      }
    };

    const drawConstellations = (time: number, dt: number) => {
      stepPoints(reducedMotion ? 0.7 : 1.25, dt);

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        context.fillStyle = rgba(effectColor, alphaBase * 0.52);
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fill();

        for (let compareIndex = index + 1; compareIndex < points.length; compareIndex += 1) {
          const compare = points[compareIndex];
          const dx = point.x - compare.x;
          const dy = point.y - compare.y;
          const distance = Math.hypot(dx, dy);
          const limit = 180 * scale;
          if (distance > limit) continue;

          const distanceAlpha = (1 - distance / limit) * alphaBase * 0.16;
          context.strokeStyle = rgba(effectColor, distanceAlpha);
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(compare.x, compare.y);
          context.stroke();
        }
      }

      const haloX = width * (0.5 + Math.sin(time * 0.00018) * 0.12);
      const haloY = height * (0.42 + Math.cos(time * 0.00014) * 0.1);
      const haloRadius = Math.min(width, height) * (0.18 + scale * 0.08);
      const gradient = context.createRadialGradient(haloX, haloY, 0, haloX, haloY, haloRadius);
      gradient.addColorStop(0, rgba(effectColor, alphaBase * 0.12));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(haloX, haloY, haloRadius, 0, Math.PI * 2);
      context.fill();
    };

    const drawSwirls = (time: number, dt: number) => {
      const rotation = reducedMotion ? 0.00006 : 0.00018;
      const baseRadius = Math.min(width, height) * 0.06 * scale;

      for (const swirl of swirls) {
        const cx = swirl.anchorX + Math.cos(time * rotation * swirl.speed + swirl.phase) * swirl.orbitX * 0.32;
        const cy = swirl.anchorY + Math.sin(time * rotation * swirl.speed * 0.78 + swirl.phase) * swirl.orbitY * 0.24;
        context.beginPath();
        for (let step = 0; step < 48; step += 1) {
          const stepRatio = step / 47;
          const angle = (time * rotation * (1.6 + swirl.speed)) + swirl.phase + stepRatio * Math.PI * 3.4;
          const radius = baseRadius + stepRatio * (110 * scale);
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius * 0.55;
          if (step === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.strokeStyle = rgba(effectColor, alphaBase * 0.18);
        context.lineWidth = swirl.width;
        context.stroke();

        context.fillStyle = rgba(effectColor, alphaBase * 0.24);
        context.beginPath();
        context.arc(cx, cy, 4 * scale, 0, Math.PI * 2);
        context.fill();
      }

      for (const point of points) {
        point.twinkle += (reducedMotion ? 0.005 : 0.015) * dt;
        const orbit = 14 * scale;
        const px = point.x + Math.cos(point.twinkle) * orbit;
        const py = point.y + Math.sin(point.twinkle * 1.2) * orbit * 0.6;
        context.fillStyle = rgba(effectColor, alphaBase * 0.22);
        context.beginPath();
        context.arc(px, py, point.radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    const render = (time: number) => {
      // Pattern or size changed — reinitialise particles without touching the canvas.
      if (needsParticleResetRef.current) {
        needsParticleResetRef.current = false;
        initParticles();
      }

      const currentPattern = patternRef.current;
      const dt = lastTime === 0 ? 1 : clamp((time - lastTime) / (1000 / 60), 0.25, 3);
      lastTime = time;

      effectColor = normalizeHex(colorRef.current) || getPaletteFallbackColor(themeRef.current);
      alphaBase = clamp(intensityRef.current / 100, 0.08, 1);
      glowStrength = clamp(glowRef.current, 0, 100) / 100;
      glowBlur = glowStrength * 20;
      glowTopAlpha = (themeRef.current === 'dark' ? 0.08 : 0.34) * glowStrength;

      // Dots and a 0 trail setting are redrawn fresh each frame (no trail); otherwise a
      // destination-out fade leaves a decaying trail whose length is set by the slider.
      const trailAmount = clamp(trailRef.current, 0, 100);
      if (currentPattern === 'dots' || trailAmount <= 0) {
        context.clearRect(0, 0, width, height);
      } else {
        context.globalCompositeOperation = 'destination-out';
        context.fillStyle = `rgba(0,0,0,${trailAmountToFadeAlpha(trailAmount)})`;
        context.fillRect(0, 0, width, height);
        context.globalCompositeOperation = 'source-over';
      }

      // Glow layer (ambient wash halo + shape shadow blur) is skipped entirely at 0,
      // not just dimmed, so "Off" truly renders no glow.
      if (glowStrength > 0) {
        const wash = context.createRadialGradient(width * 0.5, height * 0.35, 0, width * 0.5, height * 0.35, Math.max(width, height) * 0.78);
        wash.addColorStop(0, rgba(effectColor, alphaBase * 0.08 * glowStrength));
        wash.addColorStop(0.25, rgba(effectColor, alphaBase * 0.05 * glowStrength));
        wash.addColorStop(0.5, rgba(effectColor, alphaBase * 0.026 * glowStrength));
        wash.addColorStop(0.75, rgba(effectColor, alphaBase * 0.01 * glowStrength));
        wash.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = wash;
        context.fillRect(0, 0, width, height);

        context.shadowBlur = glowBlur * scale;
        context.shadowColor = rgba(effectColor, alphaBase * 0.22 * glowStrength);
      }
      // Use patternRef so switching effects never requires tearing down the RAF loop.
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
      context.shadowBlur = 0;

      const vignette = context.createLinearGradient(0, 0, 0, height);
      if (glowStrength > 0) {
        vignette.addColorStop(0, `rgba(255,255,255,${glowTopAlpha})`);
        vignette.addColorStop(0.18, `rgba(255,255,255,${glowTopAlpha * 0.35})`);
      }
      vignette.addColorStop(0.35, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.68, themeRef.current === 'dark' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)');
      vignette.addColorStop(1, themeRef.current === 'dark' ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.12)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      // Dither the large soft gradients above to break up 8-bit banding (rings/bands).
      if (ditherPattern) {
        context.save();
        context.globalAlpha = 0.05;
        context.globalCompositeOperation = 'overlay';
        context.fillStyle = ditherPattern;
        context.fillRect(0, 0, width, height);
        context.restore();
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
    };
  }, [isNone]);

  if (pattern === 'none') {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 bg-bg-deep">
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
