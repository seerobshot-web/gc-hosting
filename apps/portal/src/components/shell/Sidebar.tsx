"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const icons = {
  home: (
    <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  box: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  ),
  card: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  ),
  link: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  ),
  users: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  gear: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  pulse: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  bell: (
    <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

const MAIN: NavItem[] = [
  { href: "/dashboard/products", label: "Products", icon: icons.box },
  { href: "/dashboard/billing", label: "Billing", icon: icons.card },
  { href: "/dashboard/glinks", label: "GloryLink", icon: icons.link, badge: "Soon" },
];

const ACCOUNT: NavItem[] = [
  { href: "/dashboard/team", label: "Team", icon: icons.users },
  { href: "/dashboard/settings", label: "Settings", icon: icons.gear },
];

const OPS: NavItem = { href: "/dashboard/ops", label: "Infrastructure", icon: icons.pulse };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 mt-4 px-3 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
      {children}
    </div>
  );
}

function Item({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
        active ? "bg-gold-100 font-semibold text-ink" : "font-medium text-ink-sub hover:bg-cream-dim"
      }`}
    >
      <span className={active ? "text-gold-text" : "text-ink-muted"}>{item.icon}</span>
      {item.label}
      {item.badge && (
        <span className="ml-auto rounded-full bg-ministry/10 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.06em] text-ministry">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export interface SidebarProps {
  orgName: string | null;
  userName: string;
  userEmail: string;
  showOps: boolean;
  supportEmail: string | null;
}

export function Sidebar({ orgName, userName, userEmail, showOps, supportEmail }: SidebarProps) {
  const pathname = usePathname();
  const overviewActive = pathname === "/dashboard";
  const allItems = [...MAIN, ...ACCOUNT, ...(showOps ? [OPS] : [])];

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-ink/10 bg-white px-3.5 py-5 md:flex">
        <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-2">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-gold font-display text-[11px] font-extrabold text-brand">
            GC
          </span>
          <span className="font-display text-xs font-extrabold tracking-[0.06em] text-ink">
            GLORY CLOUD HOSTS
          </span>
        </Link>

        <Link
          href="/dashboard"
          aria-current={overviewActive ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-semibold transition ${
            overviewActive
              ? "bg-gold text-brand shadow-gold"
              : "bg-cream-dim text-ink-sub hover:bg-gold-100"
          }`}
        >
          {icons.home}
          Overview
        </Link>

        <GroupLabel>Main</GroupLabel>
        <nav className="flex flex-col gap-0.5">
          {MAIN.map((item) => (
            <Item key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <GroupLabel>Account</GroupLabel>
        <nav className="flex flex-col gap-0.5">
          {ACCOUNT.map((item) => (
            <Item key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          {showOps && <Item item={OPS} active={isActive(pathname, OPS.href)} />}
        </nav>

        {supportEmail && (
          <div className="mt-5 rounded-2xl bg-cream-dim p-4 text-center">
            <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-sacred-ember text-brand">
              {icons.bell}
            </div>
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.06em] text-ink">
              Need help?
            </div>
            <p className="mt-0.5 text-[11px] text-ink-sub">Real people, ready when you need us.</p>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-3 block rounded-full bg-gold py-2 text-xs font-semibold text-brand"
            >
              Contact support
            </a>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2 border-t border-ink/10 pt-3">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ministry font-display text-xs font-bold text-white">
            {initials(userName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-ink">{userName}</div>
            <div className="truncate text-[11px] text-ink-muted">{orgName ?? userEmail}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[11px] text-ink-muted underline hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </aside>

      <nav className="flex gap-2 overflow-x-auto border-b border-ink/10 bg-white px-4 py-3 md:hidden">
        <Link
          href="/dashboard"
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
            overviewActive ? "bg-gold text-brand" : "bg-cream-dim text-ink-sub"
          }`}
        >
          Overview
        </Link>
        {allItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              isActive(pathname, item.href) ? "bg-gold-100 text-ink" : "text-ink-sub"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
