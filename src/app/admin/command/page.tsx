import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { CommandCenterClient } from "@/components/admin/CommandCenterClient";
import { hasAnyRole, rolesOfUser } from "@/lib/roles";

export default async function CommandCenterPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const roles = rolesOfUser(session.user);
  if (!hasAnyRole(roles, ["administrator", "manager"])) redirect("/admin");

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <CommandCenterClient />
    </AdminShell>
  );
}
