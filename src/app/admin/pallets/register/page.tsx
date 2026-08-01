import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { RegisterPalletClient } from "@/components/admin/RegisterPalletClient";
import { getLabelSettings } from "@/lib/label-settings";
import { hasAnyRole, rolesOfUser } from "@/lib/roles";

export default async function RegisterPalletPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const roles = rolesOfUser(session.user);
  if (!hasAnyRole(roles, ["administrator", "manufacturing"])) redirect("/admin/scan");

  const [labelConfig, materialTypesSetting] = await Promise.all([
    getLabelSettings(prisma),
    prisma.setting.findUnique({ where: { key: "material_types" } }),
  ]);

  let materialTypes: string[] = ["plastic", "wood", "metal", "composite"];
  if (materialTypesSetting?.value) {
    try { materialTypes = JSON.parse(materialTypesSetting.value); } catch { /* keep default */ }
  }

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <RegisterPalletClient
        userName={session.user.name}
        labelConfig={labelConfig}
        materialTypes={materialTypes}
      />
    </AdminShell>
  );
}
