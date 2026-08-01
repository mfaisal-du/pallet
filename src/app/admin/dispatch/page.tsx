import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { DispatchPageClient } from "@/components/admin/DispatchPageClient";

export default async function DispatchPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const [availablePallets, loadedPallets, inTransitPallets, recentDispatches, trucks, drivers] = await Promise.all([
    // Pallets registered but not yet loaded — need scan to "load" before dispatch
    prisma.pallet.findMany({
      where: { status: "available" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, palletNumber: true, materialType: true, currentLocation: true, createdAt: true },
    }),
    // Pallets ready to dispatch
    prisma.pallet.findMany({
      where: { status: "loaded" },
      orderBy: { updatedAt: "asc" },
      select: { id: true, palletNumber: true, materialType: true, currentLocation: true, updatedAt: true },
    }),
    // Pallets currently in transit
    prisma.pallet.findMany({
      where: { status: "in_transit" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, palletNumber: true, materialType: true, currentLocation: true, returnDueDate: true, updatedAt: true },
    }),
    // Recent dispatch movements for in-transit pallets (to show truck/driver info)
    prisma.movement.findMany({
      where: { action: "dispatch" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { palletId: true, payload: true, createdAt: true, user: { select: { name: true } } },
    }),
    // Active fleet
    prisma.truck.findMany({ where: { active: true }, orderBy: { plateNumber: "asc" } }),
    prisma.driver.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // Build dispatch info map: palletId → { truckNumber, driverName, destination, dispatchedAt }
  type DispatchInfo = { truckNumber: string; driverName: string; destination: string; dispatchedAt: string };
  const dispatchMap: Record<string, DispatchInfo> = {};
  for (const m of recentDispatches) {
    if (!dispatchMap[m.palletId] && m.payload && typeof m.payload === "object") {
      const p = m.payload as Record<string, string>;
      dispatchMap[m.palletId] = {
        truckNumber: p.truckNumber || "",
        driverName: p.driverName || "",
        destination: p.destination || "",
        dispatchedAt: m.createdAt.toISOString(),
      };
    }
  }

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <DispatchPageClient
        availablePallets={availablePallets.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))}
        loadedPallets={loadedPallets.map(p => ({ ...p, updatedAt: p.updatedAt.toISOString() }))}
        inTransitPallets={inTransitPallets.map(p => ({
          ...p,
          updatedAt: p.updatedAt.toISOString(),
          returnDueDate: p.returnDueDate?.toISOString() || null,
          dispatchInfo: dispatchMap[p.id] || null,
        }))}
        activeTrucks={trucks.map(t => ({ id: t.id, plateNumber: t.plateNumber, model: t.model, assignedDriverId: t.assignedDriverId || null }))}
        activeDrivers={drivers.map(d => ({ id: d.id, name: d.name, phone: d.phone || null }))}
      />
    </AdminShell>
  );
}
