import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export default async function AdminDashboardPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [
    userCount,
    grouped,
    available,
    loaded,
    inTransit,
    delivered,
    returning,
    damaged,
    underRepair,
    retired,
    lost,
    recentEvents,
    recentPallets,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.pallet.count({ where: { status: "available" } }),
    prisma.pallet.count({ where: { status: "loaded" } }),
    prisma.pallet.count({ where: { status: "in_transit" } }),
    prisma.pallet.count({ where: { status: "delivered" } }),
    prisma.pallet.count({ where: { status: "returning" } }),
    prisma.pallet.count({ where: { status: "damaged" } }),
    prisma.pallet.count({ where: { status: "under_repair" } }),
    prisma.pallet.count({ where: { status: "retired" } }),
    prisma.pallet.count({ where: { status: "lost" } }),
    prisma.movement.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        pallet: { select: { palletNumber: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.pallet.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        palletNumber: true,
        status: true,
        currentLocation: true,
      },
    }),
  ]);

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <AdminDashboardClient
        userName={session.user.name}
        userCount={userCount}
        byRole={grouped.map((r) => ({ role: r.role, count: r._count }))}
        kpis={{
          available,
          loaded,
          inTransit,
          delivered,
          returning,
          damaged: damaged + underRepair,
          retired,
          total: available + loaded + inTransit + delivered + returning + damaged + underRepair + retired + lost,
        }}
        events={recentEvents.map((e) => ({
          id: e.id,
          action: e.action,
          createdAt: e.createdAt.toISOString(),
          palletNumber: e.pallet.palletNumber,
          userName: e.user?.name ?? null,
        }))}
        recentPallets={recentPallets.map((p) => ({
          id: p.id,
          palletNumber: p.palletNumber,
          status: p.status,
          currentLocation: p.currentLocation,
        }))}
      />
    </AdminShell>
  );
}
