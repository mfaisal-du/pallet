import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { ReportsPageClient } from "@/components/admin/ReportsPageClient";

export default async function ReportsPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const palletCount = await prisma.pallet.count();

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <ReportsPageClient initialPalletCount={palletCount} />
    </AdminShell>
  );
}
