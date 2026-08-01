import { prisma } from "@/lib/db";

type AuditClient = Pick<typeof prisma, "auditLog">;

export async function logAudit(
  input: {
    userId?: string | null;
    userEmail?: string | null;
    action: string;
    entity?: string;
    entityId?: string;
    detail?: string;
  },
  client: AuditClient = prisma
) {
  try {
    await client.auditLog.create({
      data: {
        userId: input.userId || null,
        userEmail: input.userEmail || null,
        action: input.action.slice(0, 80),
        entity: input.entity?.slice(0, 80),
        entityId: input.entityId?.slice(0, 80),
        detail: input.detail?.slice(0, 2000),
      },
    });
  } catch {
    /* never break main flow */
  }
}
