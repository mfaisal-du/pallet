import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  ALL_STATUSES,
  STATUS_LABEL_KEYS,
  STATUS_LABEL_MAX,
  getStatusLabels,
} from "@/lib/status-labels";
import { rolesOfUser } from "@/lib/roles";

/**
 * GET  — resolved status display labels for any authenticated user (scan flow needs them).
 * PUT  — administrator-only: update per-status display labels (client customization, Q1).
 */
export async function GET() {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const labels = await getStatusLabels(prisma);
  return NextResponse.json({ labels });
}

export async function PUT(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).includes("administrator")) {
    return NextResponse.json({ error: "Forbidden — Administrator only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const incoming = body.labels as Record<string, unknown> | undefined;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "labels object is required" }, { status: 400 });
  }

  // Only allow the known status keys — ignore anything else.
  const updates: { key: string; value: string }[] = [];
  const changed: string[] = [];

  for (const status of ALL_STATUSES) {
    const raw = incoming[status];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: `Label for '${status}' must be a string` }, { status: 400 });
    }
    const label = raw.trim();
    if (label.length === 0) {
      return NextResponse.json({ error: `Label for '${status}' cannot be empty` }, { status: 400 });
    }
    if (label.length > STATUS_LABEL_MAX) {
      return NextResponse.json(
        { error: `Label for '${status}' too long (max ${STATUS_LABEL_MAX} characters)` },
        { status: 400 }
      );
    }
    updates.push({ key: STATUS_LABEL_KEYS[status], value: label });
    changed.push(`${status}=${label}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid labels provided" }, { status: 400 });
  }

  await prisma.$transaction(
    updates.map(({ key, value }) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "settings_update",
    entity: "Setting",
    detail: `status_labels: ${changed.join(", ")}`,
  });

  const labels = await getStatusLabels(prisma);
  return NextResponse.json({ ok: true, updated: updates.length, labels });
}
