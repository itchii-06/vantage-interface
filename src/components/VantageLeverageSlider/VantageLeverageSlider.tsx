/**
 * VantageLeverageSlider.tsx
 *
 * Leverage slider for Vantage trade UI.
 *
 * Features:
 *   - Centered large value display (e.g. "4×")
 *   - − / + step buttons (±1 per click)
 *   - Accent-colored fill track + gray background track
 *   - Auto-generated tick marks (4 evenly-spaced values)
 */

import { t } from "@lingui/macro";
import { useMemo } from "react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function VantageLeverageSlider({ value, onChange, min = 1, max = 50 }: Props) {
  const range = max - min;
  const ratio = range > 0 ? (value - min) / range : 0;

  // Track is inset by thumbRadius(10px) each side; fill = simple ratio within that range.
  const fillStyle = useMemo(() => ({ width: `${ratio * 100}%` }), [ratio]);

  // 4 evenly-spaced tick marks between min and max
  const ticks = useMemo(
    () => [0, 1, 2, 3].map((i) => Math.round(min + (i * range) / 3)),
    [min, range] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div>
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-12 text-slate-400">{t`Leverage`}</span>
      </div>

      {/* Large value display */}
      <div className="mt-12 flex items-center justify-center">
        <span className="leading-none text-[20px] font-bold text-white">{value}×</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-10">
        {/* Minus button */}
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-4 bg-vantage-input text-[22px] font-semibold text-slate-400 transition-colors hover:text-white"
        >
          −
        </button>

        {/* Slider */}
        <div className="mt-10 flex-1">
          <div className="relative top-11 h-[20px]">
            {/* Gray background track — inset by thumbRadius(10px) each side */}
            <div className="pointer-events-none absolute left-10 right-10 top-1/2 h-[4px] -translate-y-1/2 overflow-hidden rounded-full bg-[#334155]">
              {/* Accent fill: 0% at min → 100% at max */}
              <div className="h-full bg-vantage-accent" style={fillStyle} />
            </div>

            {/* Range input on top for interaction */}
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="[&::-webkit-slider-runnable-track]:bg-transparent absolute inset-0 top-[-14px] z-10 cursor-pointer appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-thumb]:h-[20px] [&::-webkit-slider-thumb]:w-[20px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-vantage-accent"
            />
          </div>

          {/* Tick marks */}
          <div className="flex justify-between pt-16 text-11 text-slate-500">
            {ticks.map((tick) => (
              <span key={tick}>{tick}×</span>
            ))}
          </div>
        </div>

        {/* Plus button */}
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-4 bg-vantage-input text-[22px] font-semibold text-slate-400 transition-colors hover:text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}
