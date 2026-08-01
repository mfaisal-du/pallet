import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { TripManagerClient } from "@/components/admin/TripManagerClient";

export default async function TripsPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <TripManagerClient userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles} />
    </AdminShell>
  );
}
