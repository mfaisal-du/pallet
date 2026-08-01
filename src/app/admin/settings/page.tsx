import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsPageClient } from "@/components/admin/SettingsPageClient";
import { getLabelSettings } from "@/lib/label-settings";
import { getStatusLabels } from "@/lib/status-labels";
import { hasAnyRole, rolesOfUser } from "@/lib/roles";

export default async function SettingsPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const roles = rolesOfUser(session.user);
  if (!hasAnyRole(roles, ["administrator"])) redirect("/admin");

  const [[returnWindow, lowInventoryThreshold, materialTypesSetting], labelConfig, statusLabels] = await Promise.all([
    Promise.all([
      prisma.setting.findUnique({ where: { key: "return_window_days" } }),
      prisma.setting.findUnique({ where: { key: "low_inventory_threshold" } }),
      prisma.setting.findUnique({ where: { key: "material_types" } }),
    ]),
    getLabelSettings(prisma),
    getStatusLabels(prisma),
  ]);

  let materialTypes: string[] = ["plastic", "wood", "metal", "composite"];
  if (materialTypesSetting?.value) {
    try { materialTypes = JSON.parse(materialTypesSetting.value); } catch { /* keep default */ }
  }

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <SettingsPageClient
        returnWindow={returnWindow?.value || "14"}
        lowInventoryThreshold={lowInventoryThreshold?.value || "50"}
        labelConfig={labelConfig}
        initialMaterialTypes={materialTypes}
        initialStatusLabels={statusLabels}
      />
    </AdminShell>
  );
}
