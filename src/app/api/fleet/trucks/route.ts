import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { rolesOfUser } from "@/lib/roles";

export async function GET() {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const trucks = await prisma.truck.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ trucks });
}

export async function POST(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).some((r) => ["administrator", "manager"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { plateNumber, model, capacity, notes } = body;
  if (!plateNumber?.trim()) return NextResponse.json({ error: "Plate number is required" }, { status: 400 });
  try {
    const truck = await prisma.truck.create({
      data: {
        plateNumber: plateNumber.trim().toUpperCase(),
        model: model?.trim() || "",
        capacity: parseInt(capacity) || 0,
        notes: notes?.trim() || null,
      },
    });
    return NextResponse.json({ truck }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Plate number already exists" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).some((r) => ["administrator", "manager"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const truck = await prisma.truck.update({
    where: { id },
    data: {
      ...(updates.plateNumber !== undefined && { plateNumber: updates.plateNumber.trim().toUpperCase() }),
      ...(updates.model !== undefined && { model: updates.model.trim() }),
      ...(updates.capacity !== undefined && { capacity: parseInt(updates.capacity) || 0 }),
      ...(updates.active !== undefined && { active: Boolean(updates.active) }),
      ...(updates.notes !== undefined && { notes: updates.notes?.trim() || null }),
      ...(updates.assignedDriverId !== undefined && { assignedDriverId: updates.assignedDriverId || null }),
    },
  });
  return NextResponse.json({ truck });
}

export async function DELETE(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).includes("administrator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await prisma.truck.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
