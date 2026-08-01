import type { Role } from "@prisma/client";

export type AppRole = Role;

export const ALL_ROLES: Role[] = [
  "administrator",
  "manager",
  "manufacturing",
  "warehouse_loader",
  "dispatcher",
  "delivery_receiver",
  "return_collector",
  "factory_receiver",
];

export const ADMIN_ROLES: Role[] = ["administrator", "manager"];

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY MATRIX — Phase 4 (Q4 role flexibility)
//
// A user may hold MULTIPLE roles (User.roles, JSON array). Authorization is
// computed as the UNION of every role's capabilities. `role` on the user row
// remains the PRIMARY role for display / home-path / legacy references.
// ═══════════════════════════════════════════════════════════════════════════

export type Capability =
  | "view_dashboard"
  | "view_command"
  | "view_reports"
  | "view_audit"
  | "view_notifications"
  | "manage_users"
  | "manage_settings"
  | "manage_database"
  | "view_dispatch"
  | "view_fleet"
  | "manage_fleet"
  | "manage_fleet_delete"
  | "view_trips"
  | "create_trip_dispatch"
  | "create_trip_return_collection"
  | "create_trip_factory_receive"
  | "register_pallets"
  | "print_labels"
  | "void_pallets"
  | "repair_pallets"
  | "retire_pallets"
  | "mark_lost";

const ALL_CAPABILITIES: Capability[] = [
  "view_dashboard",
  "view_command",
  "view_reports",
  "view_audit",
  "view_notifications",
  "manage_users",
  "manage_settings",
  "manage_database",
  "view_dispatch",
  "view_fleet",
  "manage_fleet",
  "manage_fleet_delete",
  "view_trips",
  "create_trip_dispatch",
  "create_trip_return_collection",
  "create_trip_factory_receive",
  "register_pallets",
  "print_labels",
  "void_pallets",
  "repair_pallets",
  "retire_pallets",
  "mark_lost",
];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  administrator: ALL_CAPABILITIES,
  manager: [
    "view_dashboard",
    "view_command",
    "view_reports",
    "view_audit",
    "view_notifications",
    "view_dispatch",
    "view_fleet",
    "manage_fleet",
    "view_trips",
  ],
  manufacturing: ["register_pallets", "print_labels"],
  warehouse_loader: [],
  dispatcher: ["view_dispatch", "view_fleet", "view_trips", "create_trip_dispatch"],
  delivery_receiver: [],
  return_collector: ["view_trips", "create_trip_return_collection"],
  factory_receiver: ["view_trips", "create_trip_factory_receive"],
};

/** Every capability granted by the union of the user's roles. */
export function userCapabilities(roles: Role[]): Capability[] {
  const set = new Set<Capability>();
  for (const r of roles) {
    (ROLE_CAPABILITIES[r] || []).forEach((c) => set.add(c));
  }
  return Array.from(set);
}

/** Does ANY of the user's roles grant this capability? */
export function hasCapability(roles: Role[], capability: Capability): boolean {
  return roles.some((r) => (ROLE_CAPABILITIES[r] || []).includes(capability));
}

/** Does the user hold ANY of the given roles? */
export function hasAnyRole(roles: Role[], allowed: Role[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

/**
 * Normalize a session/user into a full role list.
 * `roles` (JSON array) is authoritative; falls back to the single `role`
 * for legacy rows / stale sessions (pre-Phase-4 or before re-login).
 */
export function rolesOfUser(user: { role: string; roles?: unknown }): Role[] {
  if (Array.isArray(user.roles)) {
    const valid = (user.roles as unknown[]).filter((r): r is Role =>
      ALL_ROLES.includes(r as Role)
    );
    if (valid.length > 0) return valid;
  }
  // Fallback to the primary role when it is a known role value
  return ALL_ROLES.includes(user.role as Role) ? [user.role as Role] : [];
}

// ═══════════════════════════════════════════════════════════════════════════
// HOME PATH + ROUTE ACCESS (multi-role aware)
// ═══════════════════════════════════════════════════════════════════════════

/** Where to send a user after login — highest-priority role wins. */
export function homePathForRoles(roles: Role[]): string {
  if (hasAnyRole(roles, ["administrator", "manager"])) return "/admin";
  if (roles.includes("manufacturing")) return "/admin/pallets/register";
  // All field roles go to the scan page
  return "/admin/scan";
}

/** Route access control — the user may access the path if ANY role can. */
export function canAccessPath(roles: Role[], pathname: string): boolean {
  // Administrator-only sections (APIs for these are administrator-only; the
  // capability matrix gives manager no manage_users/manage_settings — allowing
  // managers here would render pages that 403 on every fetch).
  if (pathname.startsWith("/admin/users")) return hasAnyRole(roles, ["administrator"]);
  if (pathname.startsWith("/admin/settings")) return hasAnyRole(roles, ["administrator"]);
  // Manager read-only view sections
  if (pathname.startsWith("/admin/audit")) return hasAnyRole(roles, ADMIN_ROLES);
  if (pathname.startsWith("/admin/notifications")) return hasAnyRole(roles, ADMIN_ROLES);

  // Manager read-only sections
  if (pathname.startsWith("/admin/reports")) return hasAnyRole(roles, ADMIN_ROLES);
  if (pathname.startsWith("/admin/command")) return hasAnyRole(roles, ADMIN_ROLES);

  if (pathname.startsWith("/admin/dispatch")) {
    return hasAnyRole(roles, ["administrator", "dispatcher", "manager"]);
  }
  if (pathname.startsWith("/admin/fleet")) {
    return hasAnyRole(roles, ["administrator", "dispatcher", "manager"]);
  }
  // Batch scanning (trips) — dispatchers, collectors, factory receivers + admins/managers
  if (pathname.startsWith("/admin/trips")) {
    return hasAnyRole(roles, ["administrator", "dispatcher", "return_collector", "factory_receiver", "manager"]);
  }

  // Register pallet + label printing — manufacturing + admin only
  if (pathname.startsWith("/admin/pallets/register")) {
    return hasAnyRole(roles, ["administrator", "manufacturing"]);
  }
  if (pathname.startsWith("/admin/pallets/labels")) {
    return hasAnyRole(roles, ["administrator", "manufacturing"]);
  }

  // Scan + pallets accessible to all authenticated users
  if (pathname.startsWith("/admin/scan")) return true;
  if (pathname.startsWith("/admin/pallets")) return true;
  if (pathname === "/admin") return true;

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS (primary role)
// ═══════════════════════════════════════════════════════════════════════════

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    administrator: "Administrator",
    manufacturing: "Manufacturing Staff",
    warehouse_loader: "Warehouse Loader",
    dispatcher: "Dispatcher",
    delivery_receiver: "Delivery Receiver",
    return_collector: "Return Collector",
    factory_receiver: "Factory Receiver",
    manager: "Manager",
  };
  return labels[role] || role;
}

export function roleBadgeColor(role: Role): string {
  const colors: Record<Role, string> = {
    administrator: "neutral",
    manufacturing: "blue",
    warehouse_loader: "field",
    dispatcher: "dispatch",
    delivery_receiver: "ok",
    return_collector: "warn",
    factory_receiver: "teal",
    manager: "neutral",
  };
  return colors[role] || "neutral";
}

/** Compact label for a role SET, e.g. "Dispatcher +2" or "Dispatcher · Receiver". */
export function roleSetLabel(roles: Role[]): string {
  if (roles.length === 0) return "No role";
  if (roles.length === 1) return roleLabel(roles[0]);
  return `${roleLabel(roles[0])} +${roles.length - 1}`;
}
