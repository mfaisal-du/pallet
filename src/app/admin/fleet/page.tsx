import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { FleetPageClient } from "@/components/admin/FleetPageClient";
import { hasAnyRole, rolesOfUser } from "@/lib/roles";

export default async function FleetPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const roles = rolesOfUser(session.user);
  if (!hasAnyRole(roles, ["administrator", "manager", "dispatcher"])) redirect("/admin");

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <FleetPageClient userRole={session.user.role} userRoles={session.user.roles} />
    </AdminShell>
  );
}
