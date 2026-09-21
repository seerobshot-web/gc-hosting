import type { ReactNode } from "react";

/** Mono-caps micro label — eyebrows, table headers, section titles. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`font-display text-[10px] font-bold uppercase tracking-[0.1em] text-gold-text ${className}`}
    >
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xs font-bold uppercase tracking-[0.08em] text-ink">{children}</h2>
  );
}

export type Tone = "success" | "warning" | "danger" | "muted" | "ministry";

const DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-ink-muted",
  ministry: "bg-ministry",
};

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
      <span className={`inline-block h-[7px] w-[7px] rounded-full ${DOT[tone]}`} />
      {label}
    </span>
  );
}

const CHIP: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  muted: "bg-ink/5 text-ink-muted",
  ministry: "bg-ministry/10 text-ministry",
};

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.06em] ${CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-1.5 font-display text-xl font-extrabold uppercase tracking-wide text-ink">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export const buttonPrimary =
  "inline-flex h-9 items-center justify-center rounded-full bg-gold px-4 text-sm font-semibold text-brand shadow-gold transition hover:bg-gold-dark disabled:opacity-50";
export const buttonGhost =
  "inline-flex h-9 items-center justify-center rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-cream-dim";
export const linkGold =
  "font-display text-[11px] font-bold uppercase tracking-[0.06em] text-gold-text hover:underline";
