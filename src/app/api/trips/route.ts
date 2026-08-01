import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rolesOfUser } from "@/lib/roles";
import type { TripType, Role } from "@prisma/client";

/**
 * Which roles may create each type of batch trip.
 * Matches the state-machine role sets for the corresponding action.
 */
const TRIP_CREATE_ROLES: Record<TripType, Role[]> = {
  // NOTE: manager is intentionally excluded — the state machine's dispatch
  // transition only allows dispatcher/administrator, so a manager-created
  // dispatch trip would be a dead-end (they could never scan onto it).
  dispatch: ["dispatcher", "administrator"],
  return_collection: ["return_collector", "administrator"],
  factory_receive: ["factory_receiver", "administrator"],
};

export async function GET(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // open | closed | all (default open)
  const type = searchParams.get("type") as TripType | null;
  const mine = searchParams.get("mine") === "1";

  const where: Record<string, unknown> = {};
  if (status === "all") {
    // no status filter
  } else if (status === "closed") {
    where.status = "closed";
  } else {
    where.status = "open";
  }
  if (type && ["dispatch", "return_collection", "factory_receive"].includes(type)) {
    where.type = type;
  }
  if (mine) {
    where.createdById = session.user.id;
  }

  const trips = await prisma.trip.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { movements: true } },
    },
  });

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      truckNumber: t.truckNumber,
      driverName: t.driverName,
      destination: t.destination,
      expectedDelivery: t.expectedDelivery?.toISOString().slice(0, 10) ?? null,
      collector: t.collector,
      inspector: t.inspector,
      scannedCount: t.scannedCount,
      failedCount: t.failedCount,
      createdById: t.createdById,
      createdByName: t.createdBy?.name ?? null,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
      movementCount: t._count.movements,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const type = body.type as TripType;

  if (!type || !["dispatch", "return_collection", "factory_receive"].includes(type)) {
    return NextResponse.json({ error: "Missing or invalid trip type" }, { status: 400 });
  }
  const userRoles = rolesOfUser(session.user);
  if (!TRIP_CREATE_ROLES[type].some((r) => userRoles.includes(r))) {
    return NextResponse.json({ error: "Your role cannot create this type of trip" }, { status: 403 });
  }

  // ── Header validation per type (the whole point of Phase 2: save once)
  if (type === "dispatch") {
    if (!body.truckNumber?.trim()) return NextResponse.json({ error: "Truck is required" }, { status: 400 });
    if (!body.driverName?.trim()) return NextResponse.json({ error: "Driver is required" }, { status: 400 });
    if (!body.destination?.trim()) return NextResponse.json({ error: "Destination is required" }, { status: 400 });
  }
  if (type === "return_collection" && !body.collector?.trim()) {
    return NextResponse.json({ error: "Collector name is required" }, { status: 400 });
  }
  if (type === "factory_receive" && !body.inspector?.trim()) {
    return NextResponse.json({ error: "Inspector name is required" }, { status: 400 });
  }

  // Resolve optional fleet links (keeps reports able to merge by driverId)
  let truckId: string | null = null;
  let driverId: string | null = null;
  if (type === "dispatch") {
    if (body.truckId) {
      const truck = await prisma.truck.findUnique({ where: { id: body.truckId } });
      if (truck) truckId = truck.id;
    }
    if (body.driverId) {
      const driver = await prisma.driver.findUnique({ where: { id: body.driverId } });
      if (driver) driverId = driver.id;
    }
  }

  const trip = await prisma.trip.create({
    data: {
      type,
      status: "open",
      truckId,
      truckNumber: type === "dispatch" ? String(body.truckNumber).trim() : null,
      driverId,
      driverName: type === "dispatch" ? String(body.driverName).trim() : null,
      destination: type === "dispatch" ? String(body.destination).trim() : null,
      expectedDelivery: body.expectedDelivery ? new Date(body.expectedDelivery) : null,
      notes: body.notes?.trim() || null,
      collector: type === "return_collection" ? String(body.collector).trim() : null,
      inspector: type === "factory_receive" ? String(body.inspector).trim() : null,
      createdById: session.user.id,
    },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "trip_create",
    entity: "Trip",
    entityId: trip.id,
    detail: `Created ${type} trip: ${trip.truckNumber || trip.collector || trip.inspector || trip.destination || ""}`,
  });

  return NextResponse.json({ trip }, { status: 201 });
}
