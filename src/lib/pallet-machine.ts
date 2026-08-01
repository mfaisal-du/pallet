import type { PalletStatus, MovementAction, Role } from "@prisma/client";
export type { PalletStatus };

/**
 * Pallet state machine — PRD §10
 *
 * Available → Loaded → In Transit → Delivered → Returning → Available (loop)
 *                                                    ↘ Damaged → Under Repair → Available / Retired
 * Any status → Lost (Administrator only, requires justification)
 */

type Transition = {
  from: PalletStatus;
  to: PalletStatus;
  action: MovementAction;
  roles: Role[];
  /** Human-readable label for the form presented on scan */
  formLabel: string;
};

/**
 * Given the current status, what form should be displayed on scan?
 * Returns null if the status is terminal (retired) or requires admin override.
 */
export const TRANSITIONS: Transition[] = [
  { from: "available",     to: "loaded",       action: "load",            roles: ["warehouse_loader", "administrator"], formLabel: "Load Products" },
  { from: "loaded",        to: "in_transit",   action: "dispatch",        roles: ["dispatcher", "administrator"],       formLabel: "Truck Assignment (Dispatch)" },
  { from: "in_transit",    to: "delivered",    action: "deliver",         roles: ["delivery_receiver", "administrator"],formLabel: "Delivery Confirmation" },
  { from: "delivered",     to: "returning",    action: "return_pickup",   roles: ["return_collector", "administrator"], formLabel: "Return Pickup (Collector)" },
  { from: "returning",     to: "available",    action: "receive_factory", roles: ["factory_receiver", "administrator"], formLabel: "Factory Receiving" },
  { from: "returning",     to: "damaged",      action: "mark_damaged",    roles: ["factory_receiver", "administrator"], formLabel: "Damage Report" },
  { from: "damaged",       to: "under_repair", action: "begin_repair",    roles: ["administrator"],                    formLabel: "Begin Repair" },
  { from: "under_repair",  to: "available",    action: "complete_repair", roles: ["administrator"],                    formLabel: "Complete Repair" },
  { from: "damaged",       to: "retired",      action: "retire",          roles: ["administrator"],                    formLabel: "Retire Pallet" },
  { from: "under_repair",  to: "retired",      action: "retire",          roles: ["administrator"],                    formLabel: "Retire Pallet" },
  // Any active status can be marked lost by administrator
  { from: "available",     to: "lost",         action: "mark_lost",       roles: ["administrator"],                    formLabel: "Mark as Lost" },
  { from: "loaded",        to: "lost",         action: "mark_lost",       roles: ["administrator"],                    formLabel: "Mark as Lost" },
  { from: "in_transit",    to: "lost",         action: "mark_lost",       roles: ["administrator"],                    formLabel: "Mark as Lost" },
  { from: "delivered",     to: "lost",         action: "mark_lost",       roles: ["administrator"],                    formLabel: "Mark as Lost" },
  { from: "returning",     to: "lost",         action: "mark_lost",       roles: ["administrator"],                    formLabel: "Mark as Lost" },
];

/**
 * Get the next transition for a pallet's current status and the user's roles.
 * A user may hold multiple roles (Phase 4) — the transition matches when ANY
 * of their roles is allowed.
 */
export function getNextTransition(status: PalletStatus, roles: Role[]): Transition | null {
  const match = TRANSITIONS.find((t) => t.from === status && t.roles.some((r) => roles.includes(r)));
  return match || null;
}

/**
 * Get ALL transitions for a given status (for admin UI that shows all options).
 */
export function getTransitionsFrom(status: PalletStatus): Transition[] {
  return TRANSITIONS.filter((t) => t.from === status);
}

/**
 * Map a status to the role(s) permitted for the next action.
 */
export function getRolesForStatus(status: PalletStatus): Role[] {
  const roles = new Set<Role>();
  TRANSITIONS.filter((t) => t.from === status).forEach((t) => {
    t.roles.forEach((r) => roles.add(r));
  });
  return Array.from(roles);
}

/**
 * Human-readable status labels.
 */
export const STATUS_LABELS: Record<PalletStatus, string> = {
  available: "Available",
  loaded: "Loaded",
  in_transit: "In Transit",
  delivered: "Delivered",
  returning: "Returning",
  damaged: "Damaged",
  under_repair: "Under Repair",
  retired: "Retired",
  lost: "Lost",
};

/**
 * Badge color for each status.
 */
export const STATUS_COLORS: Record<PalletStatus, string> = {
  available: "ok",
  loaded: "teal",
  in_transit: "dispatch",
  delivered: "blue",
  returning: "warn",
  damaged: "danger",
  under_repair: "field",
  retired: "neutral",
  lost: "danger",
};

/**
 * Check if a user (with their full role set) can perform a scan action on a
 * pallet with the given status. Administrator always passes.
 */
export function canScan(status: PalletStatus, roles: Role[]): boolean {
  const t = getNextTransition(status, roles);
  return t !== null || roles.includes("administrator");
}
