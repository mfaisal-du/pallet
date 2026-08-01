/**
 * One-off backfill — stamp driverId / truckId onto legacy dispatch movements
 * whose payload only carries free-text driverName / truckNumber.
 *
 * Matches against the fleet tables (drivers.name, trucks.plateNumber) so the
 * Driver Performance Report groups legacy and new dispatches into single rows.
 *
 * Usage:
 *   npx tsx prisma/backfill-dispatch-drivers.ts            # apply
 *   npx tsx prisma/backfill-dispatch-drivers.ts --dry-run  # preview only
 *
 * Safe to re-run: movements that already carry both IDs are skipped, and
 * names/plates that match more than one fleet record are left untouched.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type Payload = Record<string, unknown>;

function asPayload(value: unknown): Payload | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as unknown as Payload;
  }
  return null;
}

const norm = (v: string) => v.trim().toLowerCase();

async function main() {
  const dispatches = await prisma.movement.findMany({
    where: { action: "dispatch" },
    select: { id: true, payload: true },
  });

  const drivers = await prisma.driver.findMany({ select: { id: true, name: true } });
  const trucks = await prisma.truck.findMany({ select: { id: true, plateNumber: true } });

  // Driver name -> id, with ambiguity tracking (multiple drivers sharing a name)
  const driverIdByName = new Map<string, string>();
  const ambiguousDrivers = new Set<string>();
  for (const d of drivers) {
    const k = norm(d.name);
    if (driverIdByName.has(k)) ambiguousDrivers.add(k);
    else driverIdByName.set(k, d.id);
  }

  // Plate number -> id, with ambiguity tracking
  const truckIdByPlate = new Map<string, string>();
  const ambiguousTrucks = new Set<string>();
  for (const t of trucks) {
    const k = norm(t.plateNumber);
    if (truckIdByPlate.has(k)) ambiguousTrucks.add(k);
    else truckIdByPlate.set(k, t.id);
  }

  const updates: { id: string; payload: Payload }[] = [];
  let alreadyLinked = 0;
  let noFleetMatch = 0;
  let ambiguous = 0;

  for (const m of dispatches) {
    const payload = asPayload(m.payload);
    if (!payload) continue;

    // Already fully linked — idempotency guard
    if (payload.driverId && payload.truckId) {
      alreadyLinked += 1;
      continue;
    }

    let driverId: string | undefined;
    if (typeof payload.driverName === "string" && payload.driverName.trim()) {
      const k = norm(payload.driverName);
      if (ambiguousDrivers.has(k)) {
        ambiguous += 1;
        continue;
      }
      driverId = driverIdByName.get(k);
    }

    let truckId: string | undefined;
    if (typeof payload.truckNumber === "string" && payload.truckNumber.trim()) {
      const k = norm(payload.truckNumber);
      if (ambiguousTrucks.has(k)) {
        ambiguous += 1;
        continue;
      }
      truckId = truckIdByPlate.get(k);
    }

    if (!driverId && !truckId) {
      noFleetMatch += 1;
      continue;
    }

    updates.push({
      id: m.id,
      payload: {
        ...payload,
        ...(driverId ? { driverId } : {}),
        ...(truckId ? { truckId } : {}),
      },
    });
  }

  console.log(
    `Dispatch movements: ${dispatches.length} total | ${updates.length} to link | ` +
      `${alreadyLinked} already linked | ${noFleetMatch} no fleet match | ${ambiguous} ambiguous name/plate`
  );

  if (DRY_RUN) {
    console.log("Dry run — no changes written.");
    for (const u of updates) {
      console.log(`  would update ${u.id}: driverId=${u.payload.driverId} truckId=${u.payload.truckId}`);
    }
    return;
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.movement.update({
          where: { id: u.id },
          data: { payload: u.payload as unknown as Prisma.InputJsonValue },
        })
      )
    );
  }

  console.log(`Linked ${updates.length} legacy dispatch movement(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
