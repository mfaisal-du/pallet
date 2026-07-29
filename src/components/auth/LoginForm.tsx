"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Warehouse, Truck, UserRound, Shield, Settings, Factory } from "lucide-react";

const demos = [
  {
    step: 1,
    flow: "Factory registration",
    email: "manufacturing@pallettrack.local",
    label: "Manufacturing",
    icon: Factory,
    tone: "teal" as const,
  },
  {
    step: 2,
    flow: "Load to truck",
    email: "loader@pallettrack.local",
    label: "Warehouse Loader",
    icon: Warehouse,
    tone: "field" as const,
  },
  {
    step: 3,
    flow: "Dispatch outbound",
    email: "dispatcher@pallettrack.local",
    label: "Dispatcher",
    icon: Truck,
    tone: "dispatch" as const,
  },
  {
    step: 4,
    flow: "Delivery confirmation",
    email: "receiver@pallettrack.local",
    label: "Delivery Receiver",
    icon: UserRound,
    tone: "ok" as const,
  },
  {
    step: 5,
    flow: "Return pickup",
    email: "collector@pallettrack.local",
    label: "Return Collector",
    icon: Truck,
    tone: "warn" as const,
  },
  {
    step: 6,
    flow: "Factory receive",
    email: "factory@pallettrack.local",
    label: "Factory Receiver",
    icon: Settings,
    tone: "teal" as const,
  },
  {
    step: 7,
    flow: "Manage operations",
    email: "manager@pallettrack.local",
    label: "Manager",
    icon: Shield,
    tone: "neutral" as const,
  },
  {
    step: 8,
    flow: "Full system access",
    email: "admin@pallettrack.local",
    label: "Admin",
    icon: Shield,
    tone: "neutral" as const,
  },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@pallettrack.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password. Check credentials and try again.");
      return;
    }
    const callback = params.get("callbackUrl");
    router.push(callback || "/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px] space-y-3">
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel space-y-4 rounded-[1.35rem] p-4 min-[360px]:p-6 sm:p-7"
      >
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-premium"
            placeholder="you@factory.com"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-premium"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-danger ring-1 ring-red-200"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        <Button type="submit" fullWidth disabled={loading} className="!min-h-[52px] text-[15px]">
          {loading ? "Authenticating…" : "Sign in securely"}
        </Button>

        <p className="text-center text-[11px] font-medium text-muted">
          Role-based access · Encrypted session · Audit-ready
        </p>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="rounded-[1.15rem] border border-line/80 bg-white/70 p-3 shadow-sm backdrop-blur"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Demo workspaces
          </p>
          <Badge tone="neutral">password123</Badge>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          {demos.map((d, i) => {
            const Icon = d.icon;
            return (
              <motion.button
                key={d.email}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => {
                  setEmail(d.email);
                  setPassword("password123");
                }}
                className="group flex flex-col items-start gap-2 rounded-xl border border-line bg-gradient-to-b from-white to-surface px-2.5 py-2.5 text-left shadow-sm transition hover:border-blue-600/40 hover:shadow-md"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-600/10 group-hover:bg-blue-100">
                  <Icon size={14} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                      Flow {d.step}
                    </span>
                  </span>
                  <span className="block text-[11px] font-semibold text-ink">{d.label}</span>
                  <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.08em] text-sky-700">
                    {d.flow}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-medium text-muted">
                    {d.email}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
