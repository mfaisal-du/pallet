import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { ScanPageClient } from "@/components/admin/ScanPageClient";

export default async function ScanPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <ScanPageClient userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles} />
    </AdminShell>
  );
}
