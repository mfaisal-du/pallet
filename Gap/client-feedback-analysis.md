# PalletTrack Pro — Client Feedback: Comparison, Analysis & Response

**Date:** July 31, 2026
**Audience:** Project team + client (shareable)
**Status:** Analysis only — no code changed in this document. Code changes require project-team approval.

This document answers six questions raised by the pallet client during a demo, compares each
against what the current system actually does, and gives a professional recommendation with the
reasoning. A phased implementation plan is included at the end.

---

## Summary at a Glance

| # | Client Question | Current System | Verdict | Work Needed |
|---|---|---|---|---|
| 1 | Can admin change status/role labels (Load→Store, Dispatcher→Driver)? | Labels are hard-coded; admin can change a pallet's *status* but not rename labels | ✅ Implement as terminology change | Small |
| 2 | Dispatch: save truck/driver/location once, then scan many pallets to one truck | One scan = one pallet; truck/driver re-entered every time | ❌ Gap — implement trip/batch dispatch | Medium-High |
| 3 | Are truck & driver modules working (full CRUD)? | Yes — verified full CRUD, assignment, deactivation | ✅ Already working | None |
| 4 | Can the same user be dispatcher and delivery receiver? Can another user receive? | One role per user; only Admin can do every step | ⚠️ Gap — implement role combinations | Medium |
| 5 | Return Step A: rename "Pickup Driver"→"Collector", auto-fill logged-in user, save once + batch scan | Free-text per pallet, no auto-fill, no batch | ⚠️ Gap — implement auto-fill + batch | Small (auto-fill) + Medium (batch) |
| 6 | Return Step B: auto-fill Inspector, save once + batch scan | Free-text per pallet, no auto-fill, no batch | ⚠️ Gap — implement auto-fill + batch | Small (auto-fill) + Medium (batch) |

**The common thread:** questions 2, 5, and 6 are all asking for the same capability —
**batch scanning** (save a header once, then process many pallets). This should be built once as a
reusable feature, not three separate one-off flows.

---

## Q1 — Can the admin user change status labels (e.g., Load→Store, Dispatcher→Driver)?

**Client ask:** Rename the terminology the system uses, e.g. call the load action "Store" and the
dispatcher role "Driver".

**Current behavior:**
- All labels are hard-coded in the code, not configurable:
  - Status labels (`Available`, `Loaded`, `In Transit`, `Delivered`, `Returning`, `Damaged`,
    `Under Repair`, `Retired`, `Lost`) — `src/lib/pallet-machine.ts`.
  - Role names (`Dispatcher`, `Delivery Receiver`, `Return Collector`, ...) — `src/lib/roles.ts`.
  - Action names shown on scan ("Load Products", "Truck Assignment (Dispatch)", ...) — the
    transition table in `src/lib/pallet-machine.ts`.
- An admin **can** change a pallet's *status* directly from the pallet profile (logged as an
  admin-override movement), but cannot *rename* what the statuses/roles are called in the UI.

**Professional assessment:**
- Renaming for the client's own terminology is reasonable and low-risk — *if* done correctly.
- We recommend **not** making the 9 core status names fully user-configurable. The state machine,
  reports, CSV exports, filters, and audit log all depend on stable internal identifiers. A client
  renaming "In Transit" to something else in config could produce screens in one language and
  reports/CSV in another, or break transitions.

**Recommendation — two acceptable options:**
1. **Hard-code the rename (recommended for the pilot):** apply the client's exact terms in
   `pallet-machine.ts` + `roles.ts`. ~30 minutes, everything stays consistent everywhere.
2. **Configurable display labels (Settings):** store display names for roles/actions/statuses in
   the settings table while internal enums stay fixed. More flexible, slightly more work, and
   requires keeping reports/exports on the same label source.

---

## Q2 — Dispatch should be two-level: save truck/driver/location once, then scan multiple pallets for one truck

**Client ask:** Create one dispatch header (truck + driver + destination), then scan all pallets
going on that truck in one go.

**Current behavior — this is the biggest gap:**
- Dispatch is strictly **one scan = one pallet** (`POST /api/pallets/action` processes a single
  palletId; the scan page shows one dispatch form per lookup).
- The dispatcher must re-enter truck, driver, contact, destination, and expected delivery for
  **every pallet**, even when many pallets ride the same truck.
- There is no "trip" or "manifest" concept in the data model.

**Professional assessment:**
- ✅ This is the correct logistics model and a genuine workflow improvement. A dispatch is
  naturally one truck carrying many pallets. It removes repetitive data entry, reduces mistakes,
  and gives better reporting (trips per driver/day, manifest view of what's on a truck).
- No downside to the client; only implementation effort.

**Implementation shape (for planning):**
- Introduce a **Dispatch Trip** record: truck, driver, destination, expected delivery, status,
  created-by, timestamps.
- Batch-scan loaded pallets into the trip; each scan runs the existing per-pallet transition with
  the **concurrency guard already in place** (prevents two people scanning the same pallet into two
  trips).
- Store `tripId` on the dispatch movements for reporting and a manifest screen.
- See "Phase 2 — Batch Scanning" below.

---

## Q3 — Is the truck & driver module working perfectly (CRUD)?

**Client ask:** Confirm trucks and drivers can be added, edited, listed, and removed without issues.

**Current behavior — ✅ verified working:**
- **Trucks & Drivers:** full CRUD — list, add, edit, deactivate (soft-delete via an `active` flag;
  safer than hard-delete because historical movements stay intact).
- **Assign driver → truck:** supported, and now enforced as a **real database foreign key**, so a
  truck can only be assigned a driver that exists in the Drivers list.
- **Permissions:** add/edit = Administrator or Manager; deactivate = Administrator.
- **Flow-through:** active fleet records automatically populate the dispatch dropdowns, and the
  Driver Performance Report reads the linked driver records (name, phone, license).

**Recommendation:** No changes required. This module can be demonstrated as complete.

---

## Q4 — Can the same user be dispatcher AND delivery receiver? Can another user receive?

**Client ask:** The same sales-team member / truck driver often visits a customer both to deliver
new pallets and to pick up returns — one person should be able to perform both steps. Also, a
delivery should be confirmable by another authorized user if needed.

**Current behavior:**
- Every user has **exactly one role** (single-role enum in the schema).
- The state machine gates actions by role: `dispatch` = Dispatcher/Admin, `deliver` =
  Delivery Receiver/Admin, `return_pickup` = Return Collector/Admin.
- Today, only the **Administrator** can perform every step for a normal user.
- "Receive by another user" is already possible for anyone holding the `delivery_receiver` role
  (or admin) — so the second half of the question is mostly satisfied.

**Professional assessment:**
- ✅ Reasonable and common in small water-company operations (one rep handles delivery + returns in
  a single customer visit). Should be implemented.
- ⚠️ **One flag to raise with the client:** letting one person act at multiple hand-off points
  reduces *segregation of duties* (the same person could load, dispatch, deliver, and collect a
  pallet). Each action is still time-stamped and user-attributed in the audit trail, so it stays
  auditable — but the client should consciously accept this trade-off.

**Implementation options:**
- **(a) Capability-based roles (lighter):** centralize a role→allowed-actions matrix (already
  partly centralized in `src/lib/roles.ts`) and let a Dispatcher also `deliver` + `return_pickup`,
  or introduce one combined **"Field Sales Agent"** role.
- **(b) Multi-role per user (flexible):** a user holds a set of roles; Admin picks any combination
  in User Management. Touches auth, route guards, state machine checks, and the user UI.

**Decision needed from client:** which role combinations must be possible (e.g., Dispatcher +
Delivery Receiver, Delivery Receiver + Return Collector, or all three)?

---

## Q5 — Return Flow Step A (Collector): rename field, auto-fill user, save once + batch scan

**Client ask:** Rename "Pickup Driver" to "Collector", auto-fill it with the logged-in user's name,
and after one save let the collector scan and save multiple pallets.

**Current behavior:**
- The return-pickup form has a required free-text **"Pickup Driver"** field, typed separately for
  every pallet.
- No auto-fill and no batch mode.

**Professional assessment:**
- **Rename + auto-fill: ✅ implement.** Prefill with the logged-in user's name and **keep it
  editable** (in case a different person physically collects). Note: the system already records the
  acting user automatically on every movement — the Collector field describes the *physical*
  person, so prefill (not hard-lock) is the right design.
- **Batch: ✅ implement via the shared batch-scan capability** (Phase 2).

---

## Q6 — Return Flow Step B (Factory): auto-fill Inspector, save once + batch scan

**Client ask:** Auto-fill the Inspector name with the logged-in user, and process multiple returned
pallets with one save.

**Current behavior:**
- The factory-receiving form has a required free-text **"Inspector Name"** field, typed per pallet.
- No auto-fill and no batch mode.

**Professional assessment:**
- **Auto-fill: ✅ implement** (prefill from session, editable). The per-pallet condition check and
  damage description remain required per pallet — auto-fill does not reduce the inspection itself.
- **Batch: ✅ implement via the shared batch-scan capability** (Phase 2).

---

## Consolidated Implementation Plan

### Phase 1 — Quick Wins (small effort, low risk, high visible value)
1. **Auto-fill Collector (Q5)** and **Inspector (Q6)** with the logged-in user's name (editable)
   in the scan forms.
2. **Rename** "Pickup Driver" → "Collector" (Q5).
3. **Terminology labels (Q1):** apply the client's terms to status/role/action labels — hard-code
   for the pilot (option 1) or configurable display labels (option 2).
4. **Fleet CRUD (Q3):** no change; demonstrate as complete. Add any client-requested polish.

### Phase 2 — Batch Scanning (the core workflow ask; medium–high effort)
Build **one reusable Batch Session** used by all three flows:
- **Types:** dispatch trip / return collection / factory receive.
- **Header saved once:**
  - Dispatch → truck, driver, destination, expected delivery.
  - Collection → Collector (prefilled from session).
  - Receive → Inspector (prefilled from session).
- **Then:** scan N pallets; each scan validates the pallet's status and applies the same transition
  with the header attached; existing concurrency guard protects each pallet; per-pallet failures
  are reported individually; a session summary closes the batch.
- **Data model:** a Trip/Batch table plus `batchId`/`tripId` on movements; reports updated (e.g.,
  Driver Performance gains a trips-per-driver view).
- **UX:** "Batch mode" on the Scan page + a dedicated Dispatch Trip screen with a manifest.

### Phase 3 — Role Flexibility (medium effort)
- Decide capability matrix (option a) vs multi-role (option b) with the client.
- Update `roles.ts`, the state machine role checks, middleware/API route guards, and the User
  Management UI together (keeps page permissions and API permissions in sync — the project's own
  gap analysis lists "API role parity" as a P0 item).
- Document the segregation-of-duties trade-off for the client.

---

## Professional Verdict

| Client Ask | Verdict |
|---|---|
| Q2 Trip-based dispatch, Q5/Q6 auto-fill + batching | ✅ Implement with enthusiasm — matches real field operations, cuts data-entry errors, improves reporting |
| Q1 Terminology labels | ✅ Implement as display-label changes; keep internal status enums stable |
| Q4 Role combinations | ✅ Implement (capability matrix or multi-role); raise the segregation-of-duties trade-off with the client |
| Q3 Fleet CRUD | Already complete — no change |

**Main architectural principle:** build batch scanning **once** as a shared capability (Phase 2)
rather than three separate batch flows. Everything else is a small, well-contained change.

---

## Open Questions for the Client
1. **Terminology (Q1):** confirm the exact final names (e.g., Load → Store, Dispatcher → Driver,
   Pickup Driver → Collector) so labels are applied consistently.
2. **Role combinations (Q4):** which combinations must one user be able to perform (dispatcher +
   delivery? delivery + returns? all three?) and should Admin still be the only user able to
   override statuses?
3. **Batch scope (Q2/Q5/Q6):** should delivery confirmation also be batched per trip (one receiver
   confirm for a whole truck), or remain per-pallet?
4. **Segregation of duties (Q4):** acknowledge that one user may act at multiple hand-offs; the
   audit trail will still record every action.
