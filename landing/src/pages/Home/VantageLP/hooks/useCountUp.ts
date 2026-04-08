import { useEffect, useRef, useState, useCallback } from "react";

export type CountUpFormat = "dollar-M" | "percent" | "integer";

interface UseCountUpOptions {
  target: number;
  format: CountUpFormat;
  duration?: number;
  decimals?: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function formatCountUp(value: number, format: CountUpFormat, decimals?: number): string {
  switch (format) {
    case "dollar-M": {
      const d = decimals ?? 1;
      return `$${value.toFixed(d)}M`;
    }
    case "percent": {
      const d = decimals ?? 1;
      return `+${value.toFixed(d)}%`;
    }
    case "integer":
      return Math.round(value).toString();
    default:
      return value.toString();
  }
}

export function useCountUp({ target, format, duration = 1800, decimals }: UseCountUpOptions) {
  const [value, setValue] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValue(eased * target);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [hasStarted, target, duration]);

  useEffect(() => {
    const node = elementRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [start]);

  const display = formatCountUp(value, format, decimals);

  return { display, elementRef };
}
