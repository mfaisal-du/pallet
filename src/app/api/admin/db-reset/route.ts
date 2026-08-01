import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rolesOfUser } from "@/lib/roles";

// Admin-only: clear pallet data or seed demo pallets
export async function POST(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).includes("administrator")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { action } = await req.json() as { action: string };

  // ── CLEAR PALLET DATA ──────────────────────────────────────────────────────
  if (action === "clear_pallets") {
    // Delete in dependency order
    await prisma.movement.deleteMany({});
    await prisma.damageRecord.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.pallet.deleteMany({});

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "admin_override",
      entity: "System",
      detail: "Cleared all pallet data, movements, damage records, and pallet notifications",
    });

    return NextResponse.json({ ok: true, message: "All pallet data cleared successfully." });
  }

  // ── CLEAR AUDIT LOG ────────────────────────────────────────────────────────
  if (action === "clear_audit") {
    await prisma.auditLog.deleteMany({});
    return NextResponse.json({ ok: true, message: "Audit log cleared." });
  }

  // ── SEED DEMO PALLETS ──────────────────────────────────────────────────────
  if (action === "seed_pallets") {
    // Find the admin user to attach seed pallets to
    const adminUser = await prisma.user.findFirst({
      where: { role: "administrator", active: true },
      select: { id: true },
    });
    if (!adminUser) return NextResponse.json({ error: "No active admin user found" }, { status: 400 });

    const today = new Date();
    const demoSpecs = [
      { material: "plastic", dims: "1200×800×150mm", weight: 500, cost: 25 },
      { material: "wood",    dims: "1200×800×140mm", weight: 600, cost: 18 },
      { material: "metal",   dims: "1200×1000×200mm", weight: 800, cost: 55 },
      { material: "plastic", dims: "1000×800×150mm", weight: 450, cost: 22 },
      { material: "wood",    dims: "1200×800×140mm", weight: 580, cost: 19 },
    ];

    // Create pallets across different statuses for a realistic demo
    const statuses: Array<{ status: string; tripCount: number; location: string | null }> = [
      { status: "available",  tripCount: 0,  location: "Factory Warehouse A" },
      { status: "available",  tripCount: 3,  location: "Factory Warehouse B" },
      { status: "available",  tripCount: 1,  location: null },
      { status: "loaded",     tripCount: 4,  location: "Loading Bay 1" },
      { status: "loaded",     tripCount: 2,  location: "Loading Bay 2" },
      { status: "in_transit", tripCount: 7,  location: "Delivery Route 12" },
      { status: "in_transit", tripCount: 5,  location: "Highway A1" },
      { status: "delivered",  tripCount: 9,  location: "Customer Site - Gulf Water" },
      { status: "returning",  tripCount: 6,  location: "Return Truck 04" },
      { status: "damaged",    tripCount: 2,  location: "Repair Bay" },
    ];

    let created = 0;
    for (let i = 0; i < statuses.length; i++) {
      const spec = demoSpecs[i % demoSpecs.length];
      const st = statuses[i];
      const ts = (Date.now() + i).toString(36).toUpperCase();
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const palletNumber = `DEMO-${ts}${rand}`;
      const qrCode = crypto.randomUUID();

      const pallet = await prisma.pallet.create({
        data: {
          palletNumber,
          qrCode,
          manufactureDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 3),
          materialType: spec.material,
          dimensions: spec.dims,
          weightCapacity: spec.weight,
          cost: spec.cost,
          status: st.status as never,
          tripCount: st.tripCount,
          currentLocation: st.location,
          currentUserId: adminUser.id,
        },
      });

      // Add a "register" movement for each seeded pallet
      await prisma.movement.create({
        data: {
          palletId: pallet.id,
          userId: adminUser.id,
          action: "register",
          fromStatus: null,
          toStatus: "available",
          note: `Demo pallet seeded for testing`,
        },
      });

      created++;
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "admin_override",
      entity: "System",
      detail: `Seeded ${created} demo pallets for testing`,
    });

    return NextResponse.json({ ok: true, message: `${created} demo pallets created successfully.` });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
