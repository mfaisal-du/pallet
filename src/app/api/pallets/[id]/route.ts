import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rolesOfUser } from "@/lib/roles";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pallet = await prisma.pallet.findUnique({
    where: { id },
    include: {
      currentUser: { select: { name: true, email: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, role: true } } },
      },
      damageRecords: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ pallet });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).includes("administrator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, notes, printedAt } = body;

  const pallet = await prisma.pallet.findUnique({ where: { id } });
  if (!pallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status;
    if (notes) updateData.notes = notes;

    // Create movement record for status change
    await prisma.movement.create({
      data: {
        palletId: id,
        userId: session.user.id,
        action: "mark_lost" as never,
        fromStatus: pallet.status,
        toStatus: status,
        note: notes || null,
      },
    });
  }

  if (printedAt !== undefined) {
    updateData.printedAt = printedAt ? new Date(printedAt) : null;
  }

  const updated = await prisma.pallet.update({
    where: { id },
    data: updateData,
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: status ? `admin_${status}` : "update",
    entity: "Pallet",
    entityId: id,
    detail: `${pallet.palletNumber}: ${status ? `${pallet.status} → ${status}` : "updated"}`,
  });

  return NextResponse.json({ pallet: updated });
}
