import { safeAuth } from "@/lib/safe-auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import QRCode from "qrcode";
import { AdminShell } from "@/components/layout/AdminShell";
import { PalletProfileClient } from "@/components/admin/PalletProfileClient";
import { getLabelSettings } from "@/lib/label-settings";

export default async function PalletProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const [pallet, labelConfig] = await Promise.all([
    prisma.pallet.findUnique({
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
    }),
    getLabelSettings(prisma),
  ]);

  if (!pallet) notFound();

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(pallet.qrCode, {
      width: 400,
      margin: 2,
      color: { dark: "#0b1524", light: "#ffffff" },
    });
  } catch {
    // fallback empty
  }

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <PalletProfileClient
        pallet={{
          ...pallet,
          manufactureDate: pallet.manufactureDate.toISOString(),
          cost: pallet.cost.toString(),
          weightCapacity: pallet.weightCapacity.toString(),
          returnDueDate: pallet.returnDueDate?.toISOString() || null,
          printedAt: pallet.printedAt?.toISOString() || null,
          createdAt: pallet.createdAt.toISOString(),
          movements: pallet.movements.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
          })),
          damageRecords: pallet.damageRecords.map((d) => ({
            ...d,
            createdAt: d.createdAt.toISOString(),
          })),
          qrDataUrl,
        }}
        labelConfig={labelConfig}
        userName={session.user.name}
      />
    </AdminShell>
  );
}
