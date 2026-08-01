import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rolesOfUser } from "@/lib/roles";
import QRCode from "qrcode";

export async function GET() {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pallets = await prisma.pallet.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      palletNumber: true,
      qrCode: true,
      status: true,
      materialType: true,
      dimensions: true,
      weightCapacity: true,
      cost: true,
      tripCount: true,
      currentLocation: true,
      printedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    pallets: pallets.map((p) => ({
      ...p,
      cost: Number(p.cost),
      printedAt: p.printedAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

function generatePalletNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PT-${ts}${rand}`;
}

export async function POST(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).some((r) => ["administrator", "manufacturing"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    palletNumber: customNumber,
    manufactureDate,
    materialType,
    dimensions,
    weightCapacity,
    cost,
    notes,
  } = body;

  const palletNumber = customNumber || generatePalletNumber();
  const qrCode = crypto.randomUUID();

  // Check for duplicate
  const existing = await prisma.pallet.findFirst({
    where: { OR: [{ palletNumber }, { qrCode }] },
  });
  if (existing) {
    return NextResponse.json({ error: "Pallet number already exists" }, { status: 409 });
  }

  const pallet = await prisma.pallet.create({
    data: {
      palletNumber,
      qrCode,
      manufactureDate: new Date(manufactureDate),
      materialType,
      dimensions,
      weightCapacity: Number(weightCapacity),
      cost: Number(cost),
      notes: notes || null,
      currentUserId: session.user.id,
    },
  });

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(qrCode, {
    width: 400,
    margin: 2,
    color: { dark: "#0b1524", light: "#ffffff" },
  });

  // Create the initial movement record so the timeline is populated from day one
  await prisma.movement.create({
    data: {
      palletId: pallet.id,
      userId: session.user.id,
      action: "register",
      fromStatus: null,
      toStatus: "available",
      note: `Pallet ${palletNumber} manufactured and registered at factory`,
    },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "register",
    entity: "Pallet",
    entityId: pallet.id,
    detail: `Registered pallet ${palletNumber} (${materialType})`,
  });

  return NextResponse.json({ pallet: { ...pallet, qrDataUrl } });
}
