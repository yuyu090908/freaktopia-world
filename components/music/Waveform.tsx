"use client";

/** Waveform bars (peaks from the uploader's browser) with the played part lit. Click or arrow keys to seek. */
export function Waveform({ peaks, progress, onSeek, label, height = 56 }: { peaks: number[]; progress: number; onSeek?: (fraction: number) => void; label: string; height?: number }) {
  const bars = peaks.length ? peaks : Array.from({ length: 64 }, (_, i) => 0.25 + 0.15 * Math.abs(Math.sin(i * 0.7)));
  const flat = !peaks.length;
  const n = bars.length;
  return (
    <div
      role="slider"
      tabIndex={onSeek ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      data-testid="waveform"
      className="relative w-full cursor-pointer touch-none select-none"
      style={{ height }}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      }}
      onKeyDown={(e) => {
        if (!onSeek) return;
        if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.02));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.02));
      }}
    >
      <svg viewBox={`0 0 ${n * 3} 100`} preserveAspectRatio="none" className="size-full" aria-hidden>
        {bars.map((v, i) => {
          const h = Math.max(4, v * 100);
          return <rect key={i} x={i * 3} y={(100 - h) / 2} width={2} height={h} rx={1} fill={i / n <= progress ? "var(--color-acid)" : flat ? "#3a3a44" : "#5b5b68"} />;
        })}
      </svg>
    </div>
  );
}
