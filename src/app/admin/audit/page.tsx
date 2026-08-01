import { safeAuth } from "@/lib/safe-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/layout/AdminShell";
import { AuditPageClient } from "@/components/admin/AuditPageClient";

export default async function AuditPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role} userRoles={session.user.roles}>
      <AuditPageClient
        entries={entries.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </AdminShell>
  );
}
