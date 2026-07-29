"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  QrCode,
  Truck,
  Users,
  BarChart3,
  Settings,
  ScrollText,
  Bell,
  PackagePlus,
  Search,
  Activity,
  Boxes,
  Menu,
  X,
  Home,
  ChevronRight,
} from "lucide-react";
import { LogoWordmark } from "@/components/brand/Logo";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { roleLabel } from "@/lib/roles";
import type { Role } from "@prisma/client";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] };
type NavGroup = { title: string; items: NavItem[]; roles?: Role[] };

const ALL_NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/command", label: "Command Center", icon: Activity },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
    roles: ["administrator", "manager"],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/pallets", label: "Pallets", icon: Package },
      { href: "/admin/scan", label: "Scan", icon: QrCode },
      { href: "/admin/pallets/register", label: "Register Pallet", icon: PackagePlus, roles: ["administrator", "manufacturing"] },
    ],
  },
  {
    title: "Logistics",
    items: [
      { href: "/admin/dispatch", label: "Dispatch", icon: Truck },
      { href: "/admin/fleet", label: "Fleet", icon: Boxes },
    ],
    roles: ["administrator", "dispatcher", "manager"],
  },
  {
    title: "Organization",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
    ],
    roles: ["administrator"],
  },
  {
    title: "System",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
    roles: ["administrator", "manager"],
  },
];

function filterNav(role: Role): NavGroup[] {
  return ALL_NAV
    .filter((g) => !g.roles || g.roles.includes(role))
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0);
}

function buildBreadcrumbs(pathname: string) {
  const items = [{ label: "Dashboard", href: "/admin" }];
  if (pathname === "/admin") return items;

  const labels: Record<string, string> = {
    command: "Command Center",
    reports: "Reports",
    audit: "Audit Log",
    pallets: "Pallets",
    scan: "Scan",
    dispatch: "Dispatch",
    fleet: "Fleet",
    users: "Users",
    settings: "Settings",
    notifications: "Notifications",
    register: "Register Pallet",
    labels: "Print Labels",
  };

  const segments = pathname.split("/").filter(Boolean).slice(1);
  let currentPath = "/admin";

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isPalletId = index > 0 && segments[index - 1] === "pallets" && !labels[segment];
    items.push({
      label: isPalletId ? "Pallet Profile" : labels[segment] || segment.replace(/-/g, " "),
      href: currentPath,
    });
  });

  return items;
}

export function AdminShell({
  children,
  userName,
  userRole,
}: {
  children: ReactNode;
  userName: string;
  userRole: Role;
}) {
  const pathname = usePathname();
  const navGroups = filterNav(userRole);
  const flatNav = navGroups.flatMap((g) => g.items);
  const breadcrumbs = buildBreadcrumbs(pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function isOn(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[linear-gradient(165deg,#e8eef8_0%,#f3f6fb_45%,#f8fafc_100%)]">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm xl:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile slide-out nav */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.aside
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col overflow-hidden bg-gradient-to-b from-navy-950 via-[#0a1a32] to-[#0c2748] text-slate-200 shadow-2xl xl:hidden">
            <div className="safe-pt flex items-center justify-between border-b border-white/10 px-5 pb-5">
              <LogoWordmark light />
              <button onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition">
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto p-3 pb-6">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{group.title}</p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const on = isOn(item.href);
                      return (
                        <Link key={item.href} href={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                            on ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}>
                          <Icon size={16} className={on ? "text-sky-300" : "text-slate-500 group-hover:text-slate-200"} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="safe-pb border-t border-white/10 p-4">
              <p className="text-[11px] text-slate-400 font-semibold">{userName}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-200/70">{roleLabel(userRole)}</p>
              <div className="mt-2"><SignOutButton /></div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <aside className="relative hidden w-[270px] shrink-0 flex-col overflow-hidden bg-gradient-to-b from-navy-950 via-[#0a1a32] to-[#0c2748] text-slate-200 xl:flex">
        <div className="pointer-events-none absolute -left-12 top-20 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-32 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl" />

        <div className="relative border-b border-white/10 px-5 py-6">
          <LogoWordmark light />
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200/70">
            {roleLabel(userRole)}
          </p>
        </div>

        <nav className="relative flex-1 space-y-5 overflow-y-auto p-3 pb-6">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {group.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const on = isOn(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                        on
                          ? "bg-white/10 text-white shadow-inner"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {on && (
                        <motion.span
                          layoutId="admin-nav-pill"
                          className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-sky-300 to-blue-500"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <Icon
                        size={16}
                        className={
                          on
                            ? "text-sky-300"
                            : "text-slate-500 group-hover:text-slate-200"
                        }
                      />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-200/80">
              PalletTrack Pro
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              RBAC · audit · pallet lifecycle
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-white/90 shadow-sm backdrop-blur-xl">
          <div className="safe-pt flex items-center gap-3 px-3 pb-3 sm:px-4 md:px-6">
            <div className="flex items-center gap-2 xl:hidden">
              <button onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-navy-900 shadow-sm hover:bg-slate-50 transition">
                <Menu size={16} />
              </button>
            </div>

            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="hidden w-full max-w-xl md:block">
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-slate-50/90 px-3 py-2.5 shadow-sm ring-1 ring-slate-100">
                  <Search size={14} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search pallets, trucks, users…"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-line/80 bg-white/80 px-2.5 py-2 shadow-sm">
                <div className="max-w-[6.5rem] min-w-0 text-right sm:max-w-[12rem]" title={userName}>
                  <p className="truncate text-xs font-bold text-slate-900">{userName}</p>
                  <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">
                    {roleLabel(userRole)}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-xs font-bold text-white shadow-md shadow-blue-700/25">
                  {userName.slice(0, 1).toUpperCase()}
                </div>
                <SignOutButton variant="ghost" compact />
              </div>
            </div>
          </div>

          {/* Mobile horizontal nav */}
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 xl:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {flatNav.map((item) => {
              const Icon = item.icon;
              const on = isOn(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                    className={`relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                    on
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "bg-surface text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="admin-scroll safe-pb min-h-0 flex-1 overflow-auto p-3 sm:p-5 md:p-7">
          <div className="mb-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap rounded-2xl border border-line/80 bg-white/85 px-3 py-2.5 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/admin" className="flex items-center gap-1.5 text-slate-700 hover:text-blue-700">
              <Home size={13} />
              <span>Dashboard</span>
            </Link>
            {breadcrumbs.slice(1).map((item, index) => (
              <div key={`${item.href}-${index}`} className="flex shrink-0 items-center gap-2">
                <ChevronRight size={12} className="text-slate-400" />
                {index === breadcrumbs.length - 2 ? (
                  <span className="font-bold text-navy-900">{item.label}</span>
                ) : (
                  <Link href={item.href} className="hover:text-blue-700">
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
