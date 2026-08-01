import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { PalletLabelsPrintClient } from "@/components/admin/PalletLabelsPrintClient";
import { getLabelSettings } from "@/lib/label-settings";

export default async function PalletLabelsPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const [pallets, labelConfig] = await Promise.all([
    prisma.pallet.findMany({
      where: {
        status: { in: ["available", "loaded", "in_transit", "delivered", "returning"] },
      },
      orderBy: [{ materialType: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        palletNumber: true,
        materialType: true,
        dimensions: true,
        printedAt: true,
        createdAt: true,
      },
    }),
    getLabelSettings(prisma),
  ]);

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <PalletLabelsPrintClient
        initialPallets={pallets.map((p) => ({
          ...p,
          printedAt: p.printedAt?.toISOString() || null,
          createdAt: p.createdAt.toISOString(),
        }))}
        labelConfig={labelConfig}
      />
    </AdminShell>
  );
}
