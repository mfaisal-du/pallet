import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminPalletsClient } from "@/components/admin/AdminPalletsClient";

export default async function PalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const { status } = await searchParams;

  const [pallets, materialTypesSetting] = await Promise.all([
    prisma.pallet.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, palletNumber: true, qrCode: true, status: true,
        materialType: true, dimensions: true, weightCapacity: true,
        cost: true, tripCount: true, currentLocation: true, printedAt: true, createdAt: true,
      },
    }),
    prisma.setting.findUnique({ where: { key: "material_types" } }),
  ]);

  let materialTypes: string[] = ["plastic", "wood", "metal", "composite"];
  if (materialTypesSetting?.value) {
    try { materialTypes = JSON.parse(materialTypesSetting.value); } catch { /* keep default */ }
  }

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <AdminPalletsClient
        userRole={session.user.role}
        userRoles={session.user.roles}
        materialTypes={materialTypes}
        initialFilter={status}
        initialPallets={pallets.map((p) => ({
          ...p,
          cost: Number(p.cost),
          weightCapacity: Number(p.weightCapacity),
          printedAt: p.printedAt?.toISOString() || null,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </AdminShell>
  );
}
