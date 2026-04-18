import { useEffect, useRef } from "react";

interface WaveformBackgroundProps {
  /** Base color (hex). Default: '#ecff3e'. */
  color?: string;
  /** Time multiplier. Default: 1. */
  speed?: number;
  /** Turbulence multiplier. Default: 1. */
  amplitude?: number;
  /** Glow intensity multiplier. Default: 1. */
  bloom?: number;
  /** Draw faint oscilloscope grid + centerline. Default: true. */
  showGrid?: boolean;
  /** One full chaotic→converging→flatline→re-emerge loop length, in seconds. Default: 9. */
  cycleSeconds?: number;
}

/**
 * Oscilloscope-style "collapsing waveform" background.
 *
 * Visualizes the Vantage thesis: volatility (chaotic wave) being neutralized
 * (collapsed to a flat centerline) on a loop. Designed to sit behind the Hero
 * content as a full-bleed, absolutely-positioned <canvas>.
 *
 * Loop phases (fraction of `cycleSeconds`):
 *   0.00–0.45  chaotic     — full amplitude
 *   0.45–0.70  converging  — amplitude eases to 0
 *   0.70–0.85  flatline    — only the neutral centerline remains
 *   0.85–1.00  re-emerge   — amplitude eases back up
 */
const CANVAS_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  pointerEvents: "none",
};

export function WaveformBackground({
  color = "#ecff3e",
  speed = 1,
  amplitude = 1,
  bloom = 1,
  showGrid = true,
  cycleSeconds = 9,
}: WaveformBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable ref so the rAF loop reads the latest props without re-subscribing.
  const propsRef = useRef({ color, speed, amplitude, bloom, showGrid, cycleSeconds });
  propsRef.current = { color, speed, amplitude, bloom, showGrid, cycleSeconds };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pseudo-noise: sum of a few sines at fixed irrational-ish frequencies.
    // Deterministic, cheap, and gives natural "messy" oscillation.
    const noise = (x: number, t: number): number => {
      return (
        Math.sin(x * 0.013 + t * 1.7) * 0.55 +
        Math.sin(x * 0.029 - t * 2.3) * 0.35 +
        Math.sin(x * 0.071 + t * 3.1) * 0.22 +
        Math.sin(x * 0.143 - t * 4.7) * 0.13 +
        Math.sin(x * 0.211 + t * 6.1) * 0.08
      );
    };

    // Spike envelope — concentrates extra amplitude in the middle, like the reference image.
    const spikeEnvelope = (xNorm: number): number => {
      const center = Math.exp(-Math.pow((xNorm - 0.5) * 4.0, 2));
      const left = Math.exp(-Math.pow((xNorm - 0.32) * 9.0, 2)) * 0.55;
      const right = Math.exp(-Math.pow((xNorm - 0.68) * 9.0, 2)) * 0.55;
      return Math.min(1, center + left + right);
    };

    // Loop phase (0..1) -> amplitude scalar (0..1).
    const loopAmp = (p: number): number => {
      if (p < 0.45) return 1;
      if (p < 0.7) {
        const k = (p - 0.45) / 0.25;
        return Math.pow(1 - k, 1.6);
      }
      if (p < 0.85) return 0;
      const k = (p - 0.85) / 0.15;
      return Math.pow(k, 2.0);
    };

    const drawWave = (
      w: number,
      h: number,
      midY: number,
      t: number,
      ampScalar: number,
      jitterSeed: number,
      lineWidth: number,
      alpha: number,
      strokeColor: string
    ) => {
      ctx.beginPath();
      const step = 2 * dpr;
      const baseAmp = h * 0.34 * ampScalar;
      for (let x = 0; x <= w; x += step) {
        const xNorm = x / w;
        const env = spikeEnvelope(xNorm);
        // Taper edges so the waveform fades to a thin line at the sides.
        const edgeTaper = Math.pow(Math.sin(Math.PI * xNorm), 0.6);
        const n = noise(x + jitterSeed * 1000, t + jitterSeed * 0.5);
        const y = midY + n * baseAmp * env * edgeTaper;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    };

    const drawGrid = (w: number, _h: number, midY: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(236,255,62,0.6)";
      ctx.lineWidth = 1 * dpr;
      // Horizontal centerline (always faintly visible — the "neutral" line).
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      // Tick marks.
      ctx.strokeStyle = "rgba(236,255,62,0.18)";
      const cell = 80 * dpr;
      for (let x = (w / 2) % cell; x < w; x += cell) {
        ctx.beginPath();
        ctx.moveTo(x, midY - 4 * dpr);
        ctx.lineTo(x, midY + 4 * dpr);
        ctx.stroke();
      }
      ctx.restore();
    };

    const hexToRgb = (hex: string): [number, number, number] => {
      const m = hex.replace("#", "");
      const v = parseInt(m, 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    };

    const start = performance.now();

    const frame = (now: number) => {
      const p = propsRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      const elapsed = (now - start) / 1000;
      const phase = ((elapsed * p.speed) % p.cycleSeconds) / p.cycleSeconds;
      const ampPhase = loopAmp(phase);
      const t = (now / 1000) * (1.2 * p.speed);

      // Clear.
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      // Grid (always present so the centerline reads as "neutral").
      if (p.showGrid) drawGrid(w, h, midY, 0.5 + ampPhase * 0.2);

      // Additive bloom: stack passes from wide-soft to thin-bright.
      ctx.globalCompositeOperation = "lighter";
      const [r, g, b] = hexToRgb(p.color);
      const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

      const ampNow = ampPhase * p.amplitude;
      const bloomK = p.bloom;

      // Wide outer glow.
      drawWave(w, h, midY, t, ampNow, 0.0, 28 * dpr, 0.05 * bloomK, rgba(1));
      drawWave(w, h, midY, t, ampNow, 0.0, 18 * dpr, 0.1 * bloomK, rgba(1));
      drawWave(w, h, midY, t, ampNow, 0.0, 10 * dpr, 0.2 * bloomK, rgba(1));

      // Echo waves — different jitter seeds for the "many overlapping traces" feel.
      drawWave(w, h, midY, t, ampNow * 0.92, 0.21, 4 * dpr, 0.35 * bloomK, rgba(1));
      drawWave(w, h, midY, t, ampNow * 0.85, 0.47, 3 * dpr, 0.3 * bloomK, rgba(1));
      drawWave(w, h, midY, t, ampNow * 0.78, 0.83, 2 * dpr, 0.25 * bloomK, rgba(1));

      // Sharp center trace.
      drawWave(w, h, midY, t, ampNow, 0.0, 2.2 * dpr, 0.95, rgba(1));

      // Hot near-white core.
      ctx.globalAlpha = 0.9;
      drawWave(w, h, midY, t, ampNow, 0.0, 1 * dpr, 1, "rgba(255,255,255,1)");

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} style={CANVAS_STYLE} />;
}
