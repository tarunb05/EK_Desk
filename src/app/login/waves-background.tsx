"use client";

import { useCallback, useEffect, useRef } from "react";

// Scoped CLAUDE.md exception (see page.tsx and CLAUDE.md's Design system
// section): an ambient, mouse-reactive animated background is exactly the
// kind of "hero flourish" the rest of the app bans -- the login page is the
// one screen this session's own restrained-motion rule doesn't extend to,
// same carve-out class as the wordmark font. Ported from a plain-JS Perlin-
// noise wave sketch into real types; the two CSS custom properties the
// original set (--x/--y for a cursor-glow effect) and its --cursor-color
// aren't consumed by anything in this integration, so they're dropped
// rather than kept as unused instrumentation.

interface Point {
  x: number;
  y: number;
  wave: { x: number; y: number };
  cursor: { x: number; y: number; vx: number; vy: number };
}

interface MouseState {
  x: number;
  y: number;
  lx: number;
  ly: number;
  sx: number;
  sy: number;
  v: number;
  vs: number;
  a: number;
  set: boolean;
}

const CONFIG = {
  // Grid settings
  GRID_X_GAP: 10,
  GRID_Y_GAP: 32,
  GRID_WIDTH_OFFSET: 200,
  GRID_HEIGHT_OFFSET: 30,

  // Perlin noise wave settings
  WAVE_TIME_X_FACTOR: 0.0125,
  WAVE_NOISE_X_FACTOR: 0.002,
  WAVE_TIME_Y_FACTOR: 0.005,
  WAVE_NOISE_Y_FACTOR: 0.0015,
  WAVE_NOISE_MAGNITUDE: 12,
  WAVE_AMPLITUDE_X: 32,
  WAVE_AMPLITUDE_Y: 16,

  // Mouse interaction settings
  MOUSE_INFLUENCE_RADIUS: 175,
  MOUSE_FALLOFF_FACTOR: 0.001,
  MOUSE_FORCE_FACTOR: 0.00065,
  MOUSE_SMOOTHING_FACTOR: 0.1,
  MAX_MOUSE_VELOCITY: 100,

  // Point physics settings
  TENSION_STRENGTH: 0.005,
  FRICTION: 0.925,
  CURSOR_DISPLACEMENT_STRENGTH: 2,
  MAX_CURSOR_DISPLACEMENT: 100,
} as const;

// Standard Perlin noise (Ken Perlin's reference implementation shape) --
// drives the ambient wave motion independent of the mouse.
class Noise {
  private p = new Uint8Array(512);
  private static readonly GRAD3 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [1, 0], [-1, 0],
    [0, 1], [0, -1], [0, 1], [0, -1],
  ] as const;

  constructor(seed: number) {
    const s = seed > 0 && seed < 1 ? seed : Math.random();
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 0; i < 256; i++) {
      const j = Math.floor(s * (i + 1)) % 256;
      const k = p[i]!;
      p[i] = p[j]!;
      p[j] = k;
    }
    for (let i = 0; i < 512; i++) this.p[i] = p[i & 255]!;
  }

  private dot(g: readonly number[], x: number, y: number): number {
    return g[0]! * x + g[1]! * y;
  }

  perlin2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const u = fade(xf);
    const v = fade(yf);
    const { p } = this;
    const grad3 = Noise.GRAD3;
    const n00 = this.dot(grad3[p[X + p[Y]!]! % 12]!, xf, yf);
    const n01 = this.dot(grad3[p[X + p[Y + 1]!]! % 12]!, xf, yf - 1);
    const n10 = this.dot(grad3[p[X + 1 + p[Y]!]! % 12]!, xf - 1, yf);
    const n11 = this.dot(grad3[p[X + 1 + p[Y + 1]!]! % 12]!, xf - 1, yf - 1);
    const lerp = (a: number, b: number, t: number) => a + t * (b - a);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }
}

export function WavesBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const moved = useCallback((point: Point, withCursorForce: boolean) => {
    const x = point.x + point.wave.x + (withCursorForce ? point.cursor.x : 0);
    const y = point.y + point.wave.y + (withCursorForce ? point.cursor.y : 0);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reads the same --accent token the Sign in button renders with,
    // rather than duplicating its hex value here -- canvas fillStyle/
    // strokeStyle don't resolve var() themselves, so this is resolved once
    // up front instead.
    const lineColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();

    // Functional motion, but a full-viewport continuous animation reacting
    // to the pointer is still exactly the vestibular-trigger territory
    // prefers-reduced-motion exists for -- draw one static frame and stop.
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const mouse: MouseState = {
      x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false,
    };
    const noise = new Noise(Math.random());
    let lines: Point[][] = [];
    let bounding: DOMRect | null = null;
    let animationFrameId = 0;

    const setSize = () => {
      bounding = container.getBoundingClientRect();
      canvas.width = bounding.width;
      canvas.height = bounding.height;
    };

    const setLines = () => {
      if (!bounding) return;
      const { width, height } = bounding;
      const { GRID_X_GAP, GRID_Y_GAP, GRID_WIDTH_OFFSET, GRID_HEIGHT_OFFSET } =
        CONFIG;

      const oWidth = width + GRID_WIDTH_OFFSET;
      const oHeight = height + GRID_HEIGHT_OFFSET;
      const totalLines = Math.ceil(oWidth / GRID_X_GAP);
      const totalPoints = Math.ceil(oHeight / GRID_Y_GAP);
      const xStart = (width - GRID_X_GAP * totalLines) / 2;
      const yStart = (height - GRID_Y_GAP * totalPoints) / 2;

      lines = [];
      for (let i = 0; i <= totalLines; i++) {
        const points: Point[] = [];
        for (let j = 0; j <= totalPoints; j++) {
          points.push({
            x: xStart + GRID_X_GAP * i,
            y: yStart + GRID_Y_GAP * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }
        lines.push(points);
      }
    };

    const movePoints = (time: number) => {
      const {
        WAVE_TIME_X_FACTOR, WAVE_NOISE_X_FACTOR, WAVE_TIME_Y_FACTOR,
        WAVE_NOISE_Y_FACTOR, WAVE_NOISE_MAGNITUDE, WAVE_AMPLITUDE_X,
        WAVE_AMPLITUDE_Y, MOUSE_INFLUENCE_RADIUS, MOUSE_FALLOFF_FACTOR,
        MOUSE_FORCE_FACTOR, TENSION_STRENGTH, FRICTION,
        CURSOR_DISPLACEMENT_STRENGTH, MAX_CURSOR_DISPLACEMENT,
      } = CONFIG;

      for (const points of lines) {
        for (const p of points) {
          const noiseInputX = (p.x + time * WAVE_TIME_X_FACTOR) * WAVE_NOISE_X_FACTOR;
          const noiseInputY = (p.y + time * WAVE_TIME_Y_FACTOR) * WAVE_NOISE_Y_FACTOR;
          const move = noise.perlin2(noiseInputX, noiseInputY) * WAVE_NOISE_MAGNITUDE;
          p.wave.x = Math.cos(move) * WAVE_AMPLITUDE_X;
          p.wave.y = Math.sin(move) * WAVE_AMPLITUDE_Y;

          const dx = p.x - mouse.sx;
          const dy = p.y - mouse.sy;
          const d = Math.hypot(dx, dy);
          const influenceRadius = Math.max(MOUSE_INFLUENCE_RADIUS, mouse.vs);

          if (d < influenceRadius) {
            const falloff = 1 - d / influenceRadius;
            const force = Math.cos(d * MOUSE_FALLOFF_FACTOR) * falloff;
            const forceFactor = force * influenceRadius * mouse.vs * MOUSE_FORCE_FACTOR;
            p.cursor.vx += Math.cos(mouse.a) * forceFactor;
            p.cursor.vy += Math.sin(mouse.a) * forceFactor;
          }

          p.cursor.vx += (0 - p.cursor.x) * TENSION_STRENGTH;
          p.cursor.vy += (0 - p.cursor.y) * TENSION_STRENGTH;
          p.cursor.vx *= FRICTION;
          p.cursor.vy *= FRICTION;
          p.cursor.x += p.cursor.vx * CURSOR_DISPLACEMENT_STRENGTH;
          p.cursor.y += p.cursor.vy * CURSOR_DISPLACEMENT_STRENGTH;
          p.cursor.x = Math.min(MAX_CURSOR_DISPLACEMENT, Math.max(-MAX_CURSOR_DISPLACEMENT, p.cursor.x));
          p.cursor.y = Math.min(MAX_CURSOR_DISPLACEMENT, Math.max(-MAX_CURSOR_DISPLACEMENT, p.cursor.y));
        }
      }
    };

    const drawLines = () => {
      if (!bounding) return;
      ctx.clearRect(0, 0, bounding.width, bounding.height);
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 0.5;

      for (const points of lines) {
        const first = points[0];
        if (!first) continue;
        const p1 = moved(first, false);
        ctx.moveTo(p1.x, p1.y);
        for (let i = 0; i < points.length - 1; i++) {
          const current = moved(points[i]!, true);
          const next = moved(points[i + 1]!, true);
          const xc = (current.x + next.x) / 2;
          const yc = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(current.x, current.y, xc, yc);
        }
      }
      ctx.stroke();
    };

    const tick = (time: number) => {
      const { MOUSE_SMOOTHING_FACTOR, MAX_MOUSE_VELOCITY } = CONFIG;

      mouse.sx += (mouse.x - mouse.sx) * MOUSE_SMOOTHING_FACTOR;
      mouse.sy += (mouse.y - mouse.sy) * MOUSE_SMOOTHING_FACTOR;

      const dx = mouse.sx - mouse.lx;
      const dy = mouse.sy - mouse.ly;
      const d = Math.hypot(dx, dy);

      mouse.v = d;
      mouse.vs += (d - mouse.vs) * MOUSE_SMOOTHING_FACTOR;
      mouse.vs = Math.min(MAX_MOUSE_VELOCITY, mouse.vs);
      mouse.a = Math.atan2(dy, dx);

      mouse.lx = mouse.sx;
      mouse.ly = mouse.sy;

      movePoints(time);
      drawLines();

      animationFrameId = requestAnimationFrame(tick);
    };

    const updateMousePosition = (x: number, y: number) => {
      if (!bounding) return;
      mouse.x = x - bounding.left;
      mouse.y = y - bounding.top;
      if (!mouse.set) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.set = true;
      }
    };

    const onResize = () => {
      setSize();
      setLines();
    };
    const onMouseMove = (e: MouseEvent) => updateMousePosition(e.pageX, e.pageY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      updateMousePosition(touch.clientX, touch.clientY);
    };

    setSize();
    setLines();

    if (prefersReducedMotion) {
      movePoints(0);
      drawLines();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("touchmove", onTouchMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [moved]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
