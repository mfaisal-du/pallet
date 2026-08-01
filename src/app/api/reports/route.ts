import { NextRequest, NextResponse } from "next/server";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/db";
import { getStatusLabels, labelFor } from "@/lib/status-labels";
import { rolesOfUser } from "@/lib/roles";

// Helper to build date filter
function dateFilter(from?: string | null, to?: string | null) {
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) filter.gte = new Date(from);
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    filter.lte = d;
  }
  return Object.keys(filter).length ? filter : undefined;
}

// Normalize a movement payload (JSON) into a plain object for reads.
function payloadOf(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as unknown as Record<string, unknown>;
  }
  return {};
}

export async function GET(req: NextRequest) {
  const session = await safeAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rolesOfUser(session.user).some((r) => ["administrator", "manager"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = Number(searchParams.get("type") || "1");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const createdFilter = dateFilter(from, to);
  const statusLabels = await getStatusLabels(prisma);

  try {
    switch (type) {
      // 1 — Daily Pallet Movement Report
      case 1: {
        const movements = await prisma.movement.findMany({
          where: createdFilter ? { createdAt: createdFilter } : {},
          orderBy: { createdAt: "desc" },
          take: 500,
          include: {
            pallet: { select: { palletNumber: true } },
            user: { select: { name: true } },
          },
        });
        return NextResponse.json({
          columns: ["Pallet #", "Action", "From Status", "To Status", "User", "Date/Time"],
          rows: movements.map((m) => ({
            "Pallet #": m.pallet.palletNumber,
            Action: m.action,
            "From Status": labelFor(statusLabels, m.fromStatus),
            "To Status": labelFor(statusLabels, m.toStatus),
            User: m.user?.name ?? "System",
            "Date/Time": m.createdAt.toISOString(),
          })),
          total: movements.length,
        });
      }

      // 2 — Weekly Report
      case 2: {
        const movements = await prisma.movement.findMany({
          where: createdFilter ? { createdAt: createdFilter } : {},
          orderBy: { createdAt: "asc" },
          select: { action: true, createdAt: true },
        });
        // Group by week
        const weeks: Record<string, Record<string, number>> = {};
        for (const m of movements) {
          const d = new Date(m.createdAt);
          const mon = new Date(d);
          mon.setDate(d.getDate() - d.getDay() + 1);
          const wk = mon.toISOString().slice(0, 10);
          weeks[wk] = weeks[wk] || {};
          weeks[wk][m.action] = (weeks[wk][m.action] || 0) + 1;
          weeks[wk].total = (weeks[wk].total || 0) + 1;
        }
        const rows = Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([week, counts]) => ({
          "Week of": week,
          ...counts,
        }));
        return NextResponse.json({ columns: ["Week of", "total", "load", "dispatch", "deliver", "return_pickup", "receive_factory"], rows, total: rows.length });
      }

      // 3 — Monthly Report
      case 3: {
        const movements = await prisma.movement.findMany({
          where: createdFilter ? { createdAt: createdFilter } : {},
          select: { action: true, createdAt: true },
        });
        const months: Record<string, Record<string, number>> = {};
        for (const m of movements) {
          const mo = m.createdAt.toISOString().slice(0, 7);
          months[mo] = months[mo] || {};
          months[mo][m.action] = (months[mo][m.action] || 0) + 1;
          months[mo].total = (months[mo].total || 0) + 1;
        }
        const rows = Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, counts]) => ({ Month: month, ...counts }));
        return NextResponse.json({ columns: ["Month", "total", "load", "dispatch", "deliver", "return_pickup", "receive_factory"], rows, total: rows.length });
      }

      // 4 — Customer Pallet Report (pallets currently or historically at a customer)
      case 4: {
        const pallets = await prisma.pallet.findMany({
          where: { currentLocation: { not: null } },
          select: {
            palletNumber: true,
            status: true,
            currentLocation: true,
            returnDueDate: true,
            tripCount: true,
            updatedAt: true,
          },
          orderBy: { currentLocation: "asc" },
        });
        return NextResponse.json({
          columns: ["Pallet #", "Status", "Location", "Return Due", "Trip Count", "Last Updated"],
          rows: pallets.map((p) => ({
            "Pallet #": p.palletNumber,
            Status: labelFor(statusLabels, p.status),
            Location: p.currentLocation ?? "—",
            "Return Due": p.returnDueDate?.toISOString().slice(0, 10) ?? "—",
            "Trip Count": p.tripCount,
            "Last Updated": p.updatedAt.toISOString(),
          })),
          total: pallets.length,
        });
      }

      // 5 — Driver Performance Report
      case 5: {
        // Dispatches and deliveries inside the window
        const windowed = await prisma.movement.findMany({
          where: {
            action: { in: ["dispatch", "deliver"] },
            ...(createdFilter ? { createdAt: createdFilter } : {}),
          },
          select: { id: true, action: true, palletId: true, createdAt: true, payload: true, tripId: true },
        });
        const dispatches = windowed.filter((m) => m.action === "dispatch");
        const deliveries = windowed.filter((m) => m.action === "deliver");

        // Registry of fleet drivers referenced by dispatch payload IDs
        const linkedIds = Array.from(
          new Set(
            dispatches
              .map((d) => {
                const p = payloadOf(d.payload);
                return typeof p.driverId === "string" ? p.driverId : "";
              })
              .filter(Boolean)
          )
        );
        const drivers = linkedIds.length
          ? await prisma.driver.findMany({
              where: { id: { in: linkedIds } },
              select: { id: true, name: true, phone: true, licenseNo: true },
            })
          : [];
        const driverById = new Map(drivers.map((dr) => [dr.id, dr]));

        // Key by driverId when linked, otherwise fall back to the free-text name
        const keyFor = (p: Record<string, unknown>) => {
          const driverId = typeof p.driverId === "string" && p.driverId ? p.driverId : null;
          const driverName = typeof p.driverName === "string" ? p.driverName : "";
          if (driverId) {
            const dr = driverById.get(driverId);
            return { key: `id:${driverId}`, name: dr?.name || driverName || "Unknown", id: driverId };
          }
          return { key: `name:${driverName || "Unknown"}`, name: driverName || "Unknown", id: null };
        };

        const stats = new Map<string, { name: string; id: string | null; phone: string | null; dispatches: number; deliveries: number; trips: Set<string> }>();
        const rowFor = (p: Record<string, unknown>) => {
          const { key, name, id } = keyFor(p);
          if (!stats.has(key)) {
            stats.set(key, {
              name,
              id,
              phone: id ? driverById.get(id)?.phone ?? null : null,
              dispatches: 0,
              deliveries: 0,
              trips: new Set<string>(),
            });
          }
          return stats.get(key)!;
        };

        for (const d of dispatches) {
          const row = rowFor(payloadOf(d.payload));
          row.dispatches += 1;
          if (d.tripId) row.trips.add(d.tripId);
        }

        // Attribute each delivery to the driver of that pallet's most recent
        // dispatch. Also fetch dispatches that happened before the window so
        // early-window deliveries are still credited to the right driver.
        const deliveredIds = Array.from(new Set(deliveries.map((dl) => dl.palletId)));
        const priorDispatches = deliveredIds.length
          ? await prisma.movement.findMany({
              where: {
                action: "dispatch",
                palletId: { in: deliveredIds },
                ...(createdFilter?.lte ? { createdAt: { lte: createdFilter.lte } } : {}),
              },
              select: { palletId: true, createdAt: true, payload: true },
            })
          : [];
        const dispatchLog = new Map<string, { createdAt: Date; payload: unknown }[]>();
        for (const pd of [...dispatches, ...priorDispatches]) {
          const list = dispatchLog.get(pd.palletId) || [];
          list.push({ createdAt: pd.createdAt, payload: pd.payload });
          dispatchLog.set(pd.palletId, list);
        }
        for (const dl of deliveries) {
          // Credit the delivery to the most recent dispatch at-or-before it,
          // so pallets completing multiple cycles in the window each count correctly.
          const candidates = (dispatchLog.get(dl.palletId) || []).filter((pd) => pd.createdAt <= dl.createdAt);
          if (candidates.length === 0) continue;
          const prior = candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          rowFor(payloadOf(prior.payload)).deliveries += 1;
        }

        const rows = Array.from(stats.values())
          .map((r) => ({
            Driver: r.name,
            Phone: r.phone || "—",
            Trips: r.trips.size,
            Dispatches: r.dispatches,
            Deliveries: r.deliveries,
          }))
          .sort((a, b) => b.Dispatches - a.Dispatches);

        return NextResponse.json({
          columns: ["Driver", "Phone", "Trips", "Dispatches", "Deliveries"],
          rows,
          total: rows.length,
        });
      }

      // 6 — Warehouse Activity Report
      case 6: {
        const loads = await prisma.movement.findMany({
          where: { action: { in: ["load", "receive_factory"] }, ...(createdFilter ? { createdAt: createdFilter } : {}) },
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
        return NextResponse.json({
          columns: ["Action", "User", "Role", "Date/Time"],
          rows: loads.map((m) => ({
            Action: m.action,
            User: m.user?.name ?? "Unknown",
            Role: m.user?.role ?? "—",
            "Date/Time": m.createdAt.toISOString(),
          })),
          total: loads.length,
        });
      }

      // 7 — Overdue Pallet Report
      case 7: {
        const now = new Date();
        const overdue = await prisma.pallet.findMany({
          where: {
            returnDueDate: { lt: now },
            status: { notIn: ["available", "retired", "lost"] },
          },
          select: {
            palletNumber: true,
            status: true,
            currentLocation: true,
            returnDueDate: true,
            currentUser: { select: { name: true } },
          },
          orderBy: { returnDueDate: "asc" },
        });
        return NextResponse.json({
          columns: ["Pallet #", "Status", "Location", "Return Due", "Days Overdue", "Held By"],
          rows: overdue.map((p) => {
            const daysOverdue = p.returnDueDate
              ? Math.floor((now.getTime() - new Date(p.returnDueDate).getTime()) / 86400000)
              : 0;
            return {
              "Pallet #": p.palletNumber,
              Status: labelFor(statusLabels, p.status),
              Location: p.currentLocation ?? "—",
              "Return Due": p.returnDueDate?.toISOString().slice(0, 10) ?? "—",
              "Days Overdue": daysOverdue,
              "Held By": p.currentUser?.name ?? "—",
            };
          }),
          total: overdue.length,
        });
      }

      // 8 — Damaged Pallet Report
      case 8: {
        const damaged = await prisma.damageRecord.findMany({
          where: createdFilter ? { createdAt: createdFilter } : {},
          orderBy: { createdAt: "desc" },
          include: {
            pallet: { select: { palletNumber: true, status: true } },
            reportedBy: { select: { name: true } },
          },
        });
        return NextResponse.json({
          columns: ["Pallet #", "Description", "Reported By", "Status", "Resolved", "Date"],
          rows: damaged.map((d) => ({
            "Pallet #": d.pallet.palletNumber,
            Description: d.description.slice(0, 80),
            "Reported By": d.reportedBy?.name ?? "Unknown",
            Status: labelFor(statusLabels, d.pallet.status),
            Resolved: d.resolved ? "Yes" : "No",
            Date: d.createdAt.toISOString(),
          })),
          total: damaged.length,
        });
      }

      // 9 — Lost Pallet Report
      case 9: {
        const lost = await prisma.pallet.findMany({
          where: { status: "lost" },
          include: {
            movements: { orderBy: { createdAt: "desc" }, take: 1, include: { user: { select: { name: true } } } },
          },
          orderBy: { updatedAt: "asc" },
        });
        const now = new Date();
        return NextResponse.json({
          columns: ["Pallet #", "Last Known Location", "Last Seen", "Days Missing", "Last User"],
          rows: lost.map((p) => ({
            "Pallet #": p.palletNumber,
            "Last Known Location": p.currentLocation ?? "—",
            "Last Seen": p.movements[0]?.createdAt.toISOString().slice(0, 10) ?? "—",
            "Days Missing": Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / 86400000),
            "Last User": p.movements[0]?.user?.name ?? "—",
          })),
          total: lost.length,
        });
      }

      // 10 — Inventory Report
      case 10: {
        const pallets = await prisma.pallet.findMany({
          orderBy: { status: "asc" },
          select: {
            palletNumber: true,
            status: true,
            materialType: true,
            dimensions: true,
            currentLocation: true,
            tripCount: true,
            printedAt: true,
            createdAt: true,
          },
        });
        return NextResponse.json({
          columns: ["Pallet #", "Status", "Material", "Location", "Trip Count", "Registered"],
          rows: pallets.map((p) => ({
            "Pallet #": p.palletNumber,
            Status: labelFor(statusLabels, p.status),
            Material: p.materialType,
            Location: p.currentLocation ?? "—",
            "Trip Count": p.tripCount,
            Registered: p.createdAt.toISOString().slice(0, 10),
          })),
          total: pallets.length,
        });
      }

      // 11 — Pallet Utilization Report
      case 11: {
        const pallets = await prisma.pallet.findMany({
          where: createdFilter ? { createdAt: createdFilter } : {},
          select: {
            palletNumber: true,
            tripCount: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { tripCount: "desc" },
        });
        const now = new Date();
        return NextResponse.json({
          columns: ["Pallet #", "Status", "Trips Completed", "Days Active", "Trips/Month"],
          rows: pallets.map((p) => {
            const daysActive = Math.max(1, Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / 86400000));
            const tripsPerMonth = ((p.tripCount / daysActive) * 30).toFixed(1);
            return {
              "Pallet #": p.palletNumber,
              Status: labelFor(statusLabels, p.status),
              "Trips Completed": p.tripCount,
              "Days Active": daysActive,
              "Trips/Month": tripsPerMonth,
            };
          }),
          total: pallets.length,
        });
      }

      // 12 — Return Performance Report
      case 12: {
        const now = new Date();
        const delivered = await prisma.pallet.findMany({
          where: {
            returnDueDate: { not: null },
            ...(createdFilter ? { createdAt: createdFilter } : {}),
          },
          select: {
            palletNumber: true,
            status: true,
            returnDueDate: true,
            currentLocation: true,
          },
        });
        const onTime = delivered.filter((p) => p.returnDueDate && new Date(p.returnDueDate) >= now && ["available", "returning"].includes(p.status));
        const overdue = delivered.filter((p) => p.returnDueDate && new Date(p.returnDueDate) < now && !["available", "retired", "lost"].includes(p.status));
        const total = delivered.length;
        return NextResponse.json({
          columns: ["Pallet #", "Status", "Return Due", "On Time", "Customer Location"],
          rows: delivered.map((p) => ({
            "Pallet #": p.palletNumber,
            Status: labelFor(statusLabels, p.status),
            "Return Due": p.returnDueDate?.toISOString().slice(0, 10) ?? "—",
            "On Time": p.returnDueDate && new Date(p.returnDueDate) >= now ? "Yes" : "No",
            "Customer Location": p.currentLocation ?? "—",
          })),
          total,
          summary: {
            total,
            onTime: onTime.length,
            overdue: overdue.length,
            onTimeRate: total > 0 ? Math.round((onTime.length / total) * 100) : 0,
          },
        });
      }

      default:
        return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }
  } catch (err) {
    console.error("[reports]", err);
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
