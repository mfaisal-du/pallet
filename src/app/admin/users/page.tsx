import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { UsersPageClient } from "@/components/admin/UsersPageClient";
import { hasAnyRole, rolesOfUser } from "@/lib/roles";

export default async function UsersPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const roles = rolesOfUser(session.user);
  if (!hasAnyRole(roles, ["administrator"])) redirect("/admin");

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <UsersPageClient />
    </AdminShell>
  );
}
