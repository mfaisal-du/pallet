import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { NotificationsPageClient } from "@/components/admin/NotificationsPageClient";

export default async function NotificationsPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <NotificationsPageClient />
    </AdminShell>
  );
}
