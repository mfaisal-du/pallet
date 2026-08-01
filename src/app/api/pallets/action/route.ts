import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildPalletTransitionNotification } from "@/lib/notifications";
import { getTransitionsFrom } from "@/lib/pallet-machine";
import { rolesOfUser } from "@/lib/roles";
import type { TripType } from "@prisma/client";

/**
 * Which pallet action(s) a given batch-trip type accepts.
 * A trip header is saved once, then each scanned pallet runs the SAME
 * transition for the trip's type (Phase 2 — batch scanning).
 */
const TRIP_ACTIONS: Record<TripType, string[]> = {
  dispatch: ["dispatch"],
  return_collection: ["return_pickup"],
  factory_receive: ["receive_factory", "mark_damaged"],
};

export async function POST(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { palletId, action, payload, note, tripId } = body;

  if (!palletId || !action) {
    return NextResponse.json({ error: "Missing palletId or action" }, { status: 400 });
  }

  const pallet = await prisma.pallet.findUnique({ where: { id: palletId } });
  if (!pallet) return NextResponse.json({ error: "Pallet not found" }, { status: 404 });

  // ── Batch trip validation — when a tripId is supplied the action must match
  //    the trip's type and the trip must still be open.
  let trip = null;
  if (tripId) {
    trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    if (trip.status !== "open") {
      return NextResponse.json({ error: "This trip is no longer open — start a new batch" }, { status: 400 });
    }
    if (!TRIP_ACTIONS[trip.type].includes(action)) {
      return NextResponse.json({ error: "Action does not match this trip type" }, { status: 400 });
    }
  }

  // Allow any valid transition matching the submitted action AND any of the
  // caller's roles (multi-role users, Phase 4).
  const userRoles = rolesOfUser(session.user);
  const allTransitions = getTransitionsFrom(pallet.status);
  const transition = allTransitions.find(
    (t) => t.action === action && t.roles.some((r) => userRoles.includes(r))
  );
  if (!transition) {
    return NextResponse.json({ error: "Invalid transition for your role and pallet status" }, { status: 400 });
  }

  const payloadObj = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

  // ── Merge the trip header into this pallet's payload (saved once, applied to
  //    every scan). Per-pallet fields (condition, damage description, notes)
  //    submitted by the client always win.
  const mergedPayload: Record<string, unknown> = { ...payloadObj };
  if (trip) {
    if (trip.type === "dispatch") {
      if (trip.truckNumber && !mergedPayload.truckNumber) mergedPayload.truckNumber = trip.truckNumber;
      if (trip.truckId && !mergedPayload.truckId) mergedPayload.truckId = trip.truckId;
      if (trip.driverName && !mergedPayload.driverName) mergedPayload.driverName = trip.driverName;
      if (trip.driverId && !mergedPayload.driverId) mergedPayload.driverId = trip.driverId;
      if (trip.destination && !mergedPayload.destination) mergedPayload.destination = trip.destination;
      if (trip.expectedDelivery && !mergedPayload.expectedDelivery) {
        mergedPayload.expectedDelivery = trip.expectedDelivery.toISOString().slice(0, 10);
      }
      if (trip.notes && !mergedPayload.notes) mergedPayload.notes = trip.notes;
    }
    if (trip.type === "return_collection" && trip.collector && !mergedPayload.pickupDriver) {
      mergedPayload.pickupDriver = trip.collector;
    }
    if (trip.type === "factory_receive" && trip.inspector && !mergedPayload.inspector) {
      mergedPayload.inspector = trip.inspector;
    }
  }

  const data: {
    status: typeof transition.to;
    tripCount?: number;
    currentUserId?: string;
    returnDueDate?: Date | null;
    currentLocation?: string | null;
  } = {
    status: transition.to,
    currentUserId: session.user.id,
  };

  // ── Trip count — a completed delivery cycle is only counted when the pallet
  //    is received back at the factory. Completing a repair must NOT count as
  //    a delivery cycle (the pallet never left circulation).
  if (action === "receive_factory") {
    data.tripCount = pallet.tripCount + 1;
  }

  // Calculate return due date on delivery
  if (transition.to === "delivered") {
    const returnDays = await prisma.setting.findUnique({ where: { key: "return_window_days" } });
    const days = Number(returnDays?.value || 14);
    const due = new Date();
    due.setDate(due.getDate() + days);
    data.returnDueDate = due;
  }

  // ── Location tracking per transition
  if (typeof mergedPayload.destination === "string" && mergedPayload.destination.trim()) {
    data.currentLocation = mergedPayload.destination.trim();
  }
  if (typeof mergedPayload.truckNumber === "string" && mergedPayload.truckNumber.trim()) {
    data.currentLocation = `Truck: ${mergedPayload.truckNumber.trim()}`;
  }
  if (action === "mark_lost" && typeof mergedPayload.lastKnownLocation === "string" && mergedPayload.lastKnownLocation.trim()) {
    data.currentLocation = mergedPayload.lastKnownLocation.trim();
  }

  // ── Clear stale return-due dates and locations at the correct transitions.
  //    Once a pallet is back at the factory (or damaged at the factory, or out
  //    of circulation), an old customer due-date no longer applies.
  if (["receive_factory", "complete_repair", "mark_damaged"].includes(action)) {
    data.returnDueDate = null;
    data.currentLocation = null;
  }
  if (action === "mark_lost" || action === "retire") {
    data.returnDueDate = null;
  }

  // ── Damage reporting — build the description from the submitted form, and
  //    decide whether a DamageRecord row is created by this transition.
  const rawDesc = typeof mergedPayload.damageDesc === "string" ? mergedPayload.damageDesc.trim() : "";
  const condition = typeof mergedPayload.condition === "string" ? mergedPayload.condition : "";
  const notesText = typeof note === "string" ? note.trim() : "";
  const payloadNotes = typeof mergedPayload.notes === "string" ? mergedPayload.notes.trim() : "";
  const damageDesc =
    rawDesc ||
    notesText ||
    payloadNotes ||
    (condition && condition !== "Good" ? `Condition: ${condition}` : "") ||
    "Pallet flagged as damaged";
  const photoUrls = Array.isArray(mergedPayload.photoUrls) ? mergedPayload.photoUrls : undefined;
  // Damage records are created when the factory flags the pallet (mark_damaged)
  // OR when a return collector finds it damaged at pickup.
  const createDamageRecord =
    action === "mark_damaged" || (action === "return_pickup" && condition === "Damaged");

  try {
    const updatedPallet = await prisma.$transaction(async (tx) => {
      // ── Concurrency guard — only transition the pallet if it is still in the
      //    status the caller saw. Prevents duplicate / out-of-order transitions
      //    when two users scan the same pallet at the same time.
      const guard = await tx.pallet.updateMany({
        where: { id: palletId, status: pallet.status },
        data,
      });
      if (guard.count === 0) {
        throw new Error("PALLET_STALE");
      }
      const fresh = await tx.pallet.findUnique({ where: { id: palletId } });

      await tx.movement.create({
        data: {
          palletId,
          userId: session.user.id,
          action,
          fromStatus: pallet.status,
          toStatus: transition.to,
          payload: (mergedPayload && Object.keys(mergedPayload).length ? mergedPayload : undefined) as object | undefined,
          note: note || null,
          tripId: trip?.id ?? null,
        },
      });

      if (createDamageRecord) {
        await tx.damageRecord.create({
          data: {
            palletId,
            reportedById: session.user.id,
            description: damageDesc,
            photoUrls: photoUrls ?? undefined,
          },
        });
      }

      // Completing a repair resolves every open damage record for the pallet
      if (action === "complete_repair") {
        await tx.damageRecord.updateMany({
          where: { palletId, resolved: false },
          data: { resolved: true, resolvedAt: new Date() },
        });
      }

      // ── Auto-notifications (atomic with the transition)
      const notifData = buildPalletTransitionNotification({
        palletNumber: pallet.palletNumber,
        actorName: session.user.name || session.user.email,
        transitionTo: transition.to,
        palletId,
      });
      const adminUsers = await tx.user.findMany({
        where: { active: true },
        select: { id: true, role: true, roles: true },
      });
      // Notify users whose role SET includes admin/manager (multi-role aware)
      const recipients = adminUsers.filter((u) =>
        rolesOfUser(u as { role: typeof u.role; roles?: unknown }).some((r) =>
          ["administrator", "manager"].includes(r)
        )
      );
      if (recipients.length > 0) {
        await tx.notification.createMany({
          data: recipients.map((r) => ({
            userId: r.id,
            type: notifData.type,
            title: notifData.title,
            message: notifData.message,
            link: notifData.link,
          })),
          skipDuplicates: true,
        });
      }

      // ── Audit entry (atomic with the transition)
      await logAudit(
        {
          userId: session.user.id,
          userEmail: session.user.email,
          action,
          entity: "Pallet",
          entityId: palletId,
          detail: `${pallet.palletNumber}: ${pallet.status} → ${transition.to}${createDamageRecord ? " (damage reported)" : ""}${trip ? ` (trip ${trip.id})` : ""}`,
        },
        tx
      );

      // Batch-scan success counter (only after a successful transition)
      if (trip) {
        await tx.trip.update({
          where: { id: trip.id },
          data: { scannedCount: { increment: 1 } },
        });
      }

      return fresh;
    });

    if (!updatedPallet) {
      return NextResponse.json({ error: "Pallet not found" }, { status: 404 });
    }

    return NextResponse.json({ pallet: updatedPallet, tripId: trip?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "PALLET_STALE") {
      // A failed batch scan — bump the trip's failure counter so the manifest
      // summary can report it, then tell the user to re-scan.
      if (trip) {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { failedCount: { increment: 1 } },
        });
      }
      return NextResponse.json(
        { error: "This pallet's status changed while processing. Please re-scan and try again." },
        { status: 409 }
      );
    }
    console.error("[pallet action]", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
