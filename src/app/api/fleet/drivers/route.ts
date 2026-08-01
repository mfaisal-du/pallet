import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { rolesOfUser } from "@/lib/roles";

export async function GET() {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const drivers = await prisma.driver.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ drivers });
}

export async function POST(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).some((r) => ["administrator", "manager"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { name, phone, licenseNo, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Driver name is required" }, { status: 400 });
  const driver = await prisma.driver.create({
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      licenseNo: licenseNo?.trim() || null,
      notes: notes?.trim() || null,
    },
  });
  return NextResponse.json({ driver }, { status: 201 });
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
  const driver = await prisma.driver.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name.trim() }),
      ...(updates.phone !== undefined && { phone: updates.phone?.trim() || null }),
      ...(updates.licenseNo !== undefined && { licenseNo: updates.licenseNo?.trim() || null }),
      ...(updates.active !== undefined && { active: Boolean(updates.active) }),
      ...(updates.notes !== undefined && { notes: updates.notes?.trim() || null }),
    },
  });
  return NextResponse.json({ driver });
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
  await prisma.driver.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
