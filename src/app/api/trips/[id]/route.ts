import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getStatusLabels, labelFor } from "@/lib/status-labels";
import { rolesOfUser } from "@/lib/roles";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      movements: {
        orderBy: { createdAt: "asc" },
        include: {
          pallet: { select: { palletNumber: true } },
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const statusLabels = await getStatusLabels(prisma);

  return NextResponse.json({
    trip: {
      id: trip.id,
      type: trip.type,
      status: trip.status,
      truckId: trip.truckId,
      truckNumber: trip.truckNumber,
      driverId: trip.driverId,
      driverName: trip.driverName,
      destination: trip.destination,
      expectedDelivery: trip.expectedDelivery?.toISOString().slice(0, 10) ?? null,
      notes: trip.notes,
      collector: trip.collector,
      inspector: trip.inspector,
      scannedCount: trip.scannedCount,
      failedCount: trip.failedCount,
      createdById: trip.createdById,
      createdByName: trip.createdBy?.name ?? null,
      createdAt: trip.createdAt.toISOString(),
      closedAt: trip.closedAt?.toISOString() ?? null,
    },
    movements: trip.movements.map((m) => ({
      id: m.id,
      palletId: m.palletId,
      palletNumber: m.pallet.palletNumber,
      action: m.action,
      fromStatus: labelFor(statusLabels, m.fromStatus),
      toStatus: labelFor(statusLabels, m.toStatus),
      user: m.user?.name ?? "System",
      createdAt: m.createdAt.toISOString(),
      note: m.note,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const action = body.action; // "close" | "cancel"
  if (!action || !["close", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Missing or invalid action" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  // Only the trip creator or admins/managers may close or cancel a trip.
  const isAdmin = rolesOfUser(session.user).some((r) => ["administrator", "manager"].includes(r));
  if (!isAdmin && trip.createdById !== session.user.id) {
    return NextResponse.json({ error: "Only the trip creator or an administrator can close this trip" }, { status: 403 });
  }

  if (action === "close") {
    if (trip.status === "closed") {
      return NextResponse.json({ error: "Trip is already closed" }, { status: 400 });
    }
    const updated = await prisma.trip.update({
      where: { id },
      data: { status: "closed", closedAt: new Date() },
    });
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "trip_close",
      entity: "Trip",
      entityId: trip.id,
      detail: `Closed ${trip.type} trip (${trip.scannedCount} scanned, ${trip.failedCount} failed)`,
    });
    return NextResponse.json({ trip: updated });
  }

  // cancel — soft-cancel; leaves movements as-is (they already happened)
  if (trip.status !== "open") {
    return NextResponse.json({ error: "Only open trips can be cancelled" }, { status: 400 });
  }
  const updated = await prisma.trip.update({
    where: { id },
    data: { status: "cancelled", closedAt: new Date() },
  });
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "trip_cancel",
    entity: "Trip",
    entityId: trip.id,
    detail: `Cancelled ${trip.type} trip`,
  });
  return NextResponse.json({ trip: updated });
}
