import Link from "next/link";
import Image from "next/image";
import type { ArtPick } from "@/lib/art";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FlaskConical } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "coral" | "purple" | "blue";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-acid text-ink hover:bg-[#c6f77a] shadow-[0_4px_0_0_#5f8a22]",
  coral: "bg-coral text-ink hover:bg-[#ff7a75] shadow-[0_4px_0_0_#9b2f2b]",
  purple: "bg-purple text-ink hover:bg-[#b28cf0] shadow-[0_4px_0_0_#5b3d8f]",
  blue: "bg-blue text-ink hover:bg-[#71c8f0] shadow-[0_4px_0_0_#2a6f8f]",
  secondary: "bg-cream text-ink hover:bg-white shadow-[0_4px_0_0_#8d897f]",
  ghost: "bg-transparent text-cream border-2 border-cream/30 hover:border-cream/70",
};
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-[15px]",
  lg: "min-h-14 px-7 text-base",
};

export function btnClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-extrabold uppercase tracking-wide",
    "transition-[transform,box-shadow,background-color] duration-100 active:translate-y-[3px] active:shadow-none",
    "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 select-none",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={btnClass(variant, size, className)} {...p} />;
}

export function ButtonLink({ variant, size, className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={btnClass(variant, size, className)} {...p} />;
}

export function IconButton({ className, label, ...p }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-cream hover:bg-surface-2 border border-line", className)}
      {...p}
    />
  );
}

export function Chip({ active, className, ...p }: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 text-sm font-bold transition-colors",
        active ? "border-acid bg-acid text-ink shadow-[0_0_16px_-2px_rgba(182,240,92,0.6)]" : "border-cream/25 bg-ink/70 text-cream hover:border-cream/60",
        className,
      )}
      {...p}
    />
  );
}

export function Tag({ children, color = "#2a2a2a", dark = false, className }: { children: ReactNode; color?: string; dark?: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider leading-none", dark ? "text-ink" : "text-cream", className)}
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

/** Marks sample content and simulated features. */
export function DemoBadge({ className, label = "DEMO" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-orange/60 bg-orange/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-orange", className)}>
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export function DemoNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="note" className={cn("flex gap-3 rounded-2xl border border-orange/40 bg-orange/10 p-3 text-sm text-cream", className)}>
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Progress({ value, color = "#B6F05C", className, label }: { value: number; color?: string; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-[#2a2a2a]", className)}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function SectionHeader({ title, sub, action, id }: { title: string; sub?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 px-4 md:px-0">
      <div className="min-w-0">
        <h2 id={id} className="text-[28px] uppercase sm:text-4xl">
          {title}
        </h2>
        {sub && <p className="ja mt-2 text-sm text-mute">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("neon rounded-3xl border bg-surface/90", className)} {...p} />;
}

export function Stat({ label, value, accent = "#F5F2EA" }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-mute">{label}</div>
      <div className="mt-1 truncate font-display text-xl" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

export function PageTitle({ kicker, title, sub, children, art }: { kicker?: string; title: string; sub?: string; children?: ReactNode; art?: ArtPick }) {
  return (
    <div className={cn("px-4 pb-5 md:px-0", art ? "pt-0 md:pt-6" : "pt-4 md:pt-8")}>
      {art && (
        <div className="relative -mx-4 h-40 overflow-hidden sm:h-52 md:mx-0 md:h-60 md:rounded-[28px] md:border-2 md:border-purple/50 md:shadow-[0_0_36px_-12px_rgba(162,118,233,0.7)]" aria-hidden>
          <Image src={art.src} alt="" fill priority quality={60} sizes="(min-width:1152px) 1100px, 100vw" className="object-cover" style={{ objectPosition: art.pos }} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
        </div>
      )}
      <div className={art ? "relative -mt-12 md:-mt-14 md:px-6" : undefined}>
        {kicker && <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-acid drop-shadow-[0_1px_0_#080808]">{kicker}</div>}
        <h1 className="text-[40px] uppercase drop-shadow-[0_3px_0_#080808] sm:text-6xl">{title}</h1>
      </div>
      {sub && <p className="ja mt-3 max-w-2xl text-[15px] leading-relaxed text-mute">{sub}</p>}
      {children}
    </div>
  );
}

export function Container({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl md:px-6", className)} {...p} />;
}
