import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rolesOfUser } from "@/lib/roles";

const NUMERIC_KEYS = ["return_window_days", "low_inventory_threshold"];
const STRING_KEYS = ["label_company_name", "label_company_tagline", "label_accent_color", "label_footer_text"];
const JSON_KEYS = ["material_types"];
const ALLOWED_KEYS = [...NUMERIC_KEYS, ...STRING_KEYS, ...JSON_KEYS];

export async function GET() {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return NextResponse.json({ settings: map });
}

export async function PATCH(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).includes("administrator")) {
    return NextResponse.json({ error: "Forbidden — Administrator only" }, { status: 403 });
  }

  const body = await req.json();
  const updates: { key: string; value: string }[] = [];

  for (const key of ALLOWED_KEYS) {
    if (key in body && body[key] !== undefined && body[key] !== null) {
      const raw = String(body[key]).trim();
      if (raw === "") continue;
      if (NUMERIC_KEYS.includes(key)) {
        const num = Number(raw);
        if (isNaN(num) || num < 1) {
          return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
        }
        updates.push({ key, value: String(Math.round(num)) });
      } else if (JSON_KEYS.includes(key)) {
        // Expect an array; serialize it
        const arr = body[key];
        if (!Array.isArray(arr)) return NextResponse.json({ error: `${key} must be an array` }, { status: 400 });
        updates.push({ key, value: JSON.stringify(arr) });
      } else {
        if (raw.length > 255) {
          return NextResponse.json({ error: `Value too long for ${key}` }, { status: 400 });
        }
        updates.push({ key, value: raw });
      }
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
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
    detail: updates.map((u) => `${u.key}=${u.value}`).join(", "),
  });

  return NextResponse.json({ ok: true, updated: updates.length });
}
