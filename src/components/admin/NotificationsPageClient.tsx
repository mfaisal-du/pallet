"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format-date";
import { Bell, BellOff, CheckCheck } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

const TYPE_TONE: Record<string, "danger" | "warn" | "blue" | "ok" | "neutral"> = {
  overdue_return: "danger",
  damaged_pallet: "danger",
  delivery_delayed: "warn",
  dwell_time_exceeded: "warn",
  new_batch_manufactured: "ok",
  inventory_below_threshold: "warn",
  system: "blue",
};

export function NotificationsPageClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications.map((n: Notification & { createdAt: string }) => ({
        ...n,
        createdAt: new Date(n.createdAt).toISOString(),
      })));
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = window.setTimeout(loadNotifications, 0);

    const interval = window.setInterval(() => {
      loadNotifications();
    }, 5000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <PageReveal className="space-y-6">
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-blue-900 to-blue-700 p-5 text-white shadow-xl sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Notifications
            </h1>
            <p className="mt-1.5 text-sm text-blue-50/90">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="white" className="w-full !px-3 !py-1.5 !text-xs sm:w-auto" onClick={markAllRead}>
              <CheckCheck size={14} /> Mark all read
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-line px-3 py-12 text-center text-sm text-muted">
            Loading notifications…
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-3 py-12 text-center text-sm text-muted">
            <Bell size={32} className="mx-auto mb-2 text-muted/50" />
            No notifications yet. Alerts for overdue pallets, damage, and delivery delays will appear here.
          </div>
        ) : (
          notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
              className={`rounded-2xl border p-4 shadow-sm transition ${
                n.read
                  ? "border-line bg-white"
                  : "border-blue-200 bg-blue-50/50 ring-1 ring-blue-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={TYPE_TONE[n.type] || "neutral"}>
                      {n.type.replace(/_/g, " ")}
                    </Badge>
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <h3 className="mt-1.5 break-words text-sm font-bold text-navy-900">{n.title}</h3>
                  <p className="mt-0.5 break-words text-xs text-muted">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-white hover:text-ink"
                    title="Mark as read"
                  >
                    <BellOff size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </PageReveal>
  );
}
