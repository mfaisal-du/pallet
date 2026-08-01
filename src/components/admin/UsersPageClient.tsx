"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format-date";
import { roleLabel } from "@/lib/roles";
import type { Role } from "@prisma/client";
import {
  UserPlus, Search, Edit2, UserX, UserCheck,
  ChevronDown, ChevronUp, Shield, Activity,
} from "lucide-react";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: Role[];
  active: boolean;
  createdAt: string;
  _count: { movements: number };
};

const ROLE_ORDER = [
  "administrator",
  "manager",
  "manufacturing",
  "warehouse_loader",
  "dispatcher",
  "delivery_receiver",
  "return_collector",
  "factory_receiver",
];

const ROLE_COLORS: Record<string, string> = {
  administrator: "from-violet-600 to-purple-600",
  manager: "from-blue-600 to-blue-700",
  manufacturing: "from-emerald-500 to-teal-600",
  warehouse_loader: "from-cyan-500 to-blue-500",
  dispatcher: "from-orange-500 to-amber-500",
  delivery_receiver: "from-green-500 to-emerald-600",
  return_collector: "from-amber-500 to-yellow-500",
  factory_receiver: "from-rose-500 to-pink-500",
};

export function UsersPageClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", roles: ["warehouse_loader"] as Role[], password: "" });
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", roles: [] as Role[], password: "" });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users.map((u: User) => ({ ...u, createdAt: new Date(u.createdAt).toISOString() })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.roles || []).some((r) => r.toLowerCase().includes(q))
    );
  }, [users, search]);

  const grouped = useMemo(() => {
    const map: Record<string, User[]> = {};
    for (const role of ROLE_ORDER) map[role] = [];
    for (const u of filtered) {
      if (!map[u.role]) map[u.role] = [];
      map[u.role].push(u);
    }
    return ROLE_ORDER.map((role) => ({ role, users: map[role] || [] })).filter((g) => g.users.length > 0);
  }, [filtered]);

  function toggleRole(role: string) {
    setCollapsedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }

  function toggleAddRole(r: Role) {
    setAddForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(r) ? prev.roles.filter((x) => x !== r) : [...prev.roles, r],
    }));
  }

  function toggleEditRole(r: Role) {
    setEditForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(r) ? prev.roles.filter((x) => x !== r) : [...prev.roles, r],
    }));
  }

  async function handleAdd() {
    setSubmittingAdd(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => [{ ...data.user, createdAt: new Date().toISOString(), _count: { movements: 0 }, active: true }, ...prev]);
        setShowAdd(false);
        setAddForm({ name: "", email: "", roles: ["warehouse_loader"], password: "" });
        toast.success(`${data.user.name} created`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create user");
      }
    } catch { toast.error("Network error"); }
    finally { setSubmittingAdd(false); }
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({ name: u.name, roles: (u.roles && u.roles.length > 0 ? u.roles : [u.role as Role]), password: "" });
  }

  async function handleEdit() {
    if (!editUser) return;
    setSubmittingEdit(true);
    try {
      const body: Record<string, unknown> = { id: editUser.id, name: editForm.name, roles: editForm.roles };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...data.user } : u)));
        setEditUser(null);
        toast.success("User updated");
      } else {
        const data = await res.json();
        toast.error(data.error || "Update failed");
      }
    } catch { toast.error("Network error"); }
    finally { setSubmittingEdit(false); }
  }

  async function handleToggleActive(u: User) {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, active: !u.active }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !u.active } : x)));
        toast.success(!u.active ? `${u.name} activated` : `${u.name} deactivated`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Network error"); }
  }

  const totalActive = users.filter((u) => u.active).length;

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-navy-950 via-[#0f2744] to-emerald-900 p-5 text-white shadow-xl sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">User Management</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-emerald-50/80">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                {totalActive} active
              </span>
              {users.length - totalActive > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                  {users.length - totalActive} inactive
                </span>
              )}
              <span>{ROLE_ORDER.length} roles &middot; RBAC enforced</span>
            </div>
          </div>
          <Button variant="white" className="w-full !px-4 !py-2 !text-xs sm:w-auto sm:shrink-0" onClick={() => setShowAdd(true)}>
            <UserPlus size={13} /> Add user
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          className="input-premium w-full pl-9 text-sm"
          placeholder="Search by name, email or role&hellip;"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Groups */}
      {loading ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">Loading users&hellip;</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">No users match your search.</div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => {
            const isCollapsed = collapsedRoles.has(group.role);
            const grad = ROLE_COLORS[group.role] || "from-slate-500 to-slate-600";
            return (
              <div key={group.role} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <button
                  onClick={() => toggleRole(group.role)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white shadow`}>
                    <Shield size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-navy-900">{roleLabel(group.role as Parameters<typeof roleLabel>[0])}</p>
                    <p className="text-xs text-muted">
                      {group.users.length} user{group.users.length !== 1 ? "s" : ""}
                      {group.users.filter((u) => !u.active).length > 0 && ` \u00b7 ${group.users.filter((u) => !u.active).length} inactive`}
                    </p>
                  </div>
                  {isCollapsed ? <ChevronDown size={15} className="text-muted shrink-0" /> : <ChevronUp size={15} className="text-muted shrink-0" />}
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key="rows"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-line"
                    >
                      <div className="divide-y divide-line">
                        {group.users.map((u) => (
                          <div key={u.id} className={`flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 ${!u.active ? "opacity-50" : ""}`}>
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-xs font-bold text-white shadow`}>
                              {u.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-bold text-navy-900">{u.name}</p>
                                {!u.active && <Badge tone="neutral">Inactive</Badge>}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {(u.roles && u.roles.length > 0 ? u.roles : [u.role]).map((r) => (
                                  <span key={r} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200/70">
                                    <Shield size={8} /> {roleLabel(r as Parameters<typeof roleLabel>[0])}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-1 text-xs text-muted truncate">
                                {u.email}
                                <span className="mx-1.5 text-slate-300">&middot;</span>
                                <span className="inline-flex items-center gap-0.5"><Activity size={9} className="inline" /> {u._count.movements}</span>
                                <span className="mx-1.5 text-slate-300">&middot;</span>
                                {formatDate(u.createdAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button onClick={() => openEdit(u)} title="Edit user"
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleToggleActive(u)}
                                title={u.active ? "Deactivate" : "Activate"}
                                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${u.active ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                                {u.active ? <UserX size={13} /> : <UserCheck size={13} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add User" subtitle="Create a new account with a role">
        <div className="space-y-3">
          <div><label className="text-xs font-bold uppercase text-muted">Full Name</label>
            <input className="input-premium mt-1 text-sm" placeholder="Ahmed Al-Rashidi" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
          <div><label className="text-xs font-bold uppercase text-muted">Email</label>
            <input type="email" className="input-premium mt-1 text-sm" placeholder="user@company.local" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} /></div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Roles (multi-select)</label>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ROLE_ORDER.map((r) => {
                const on = addForm.roles.includes(r as Role);
                return (
                  <button key={r} type="button" onClick={() => toggleAddRole(r as Role)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                      on ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20" : "border-line bg-white text-slate-600 hover:border-blue-300 hover:bg-slate-50"
                    }`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>
                      {on && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                    {roleLabel(r as Parameters<typeof roleLabel>[0])}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted">Pick one or more — the user can combine roles (e.g. Dispatcher + Delivery Receiver).</p>
          </div>
          <div><label className="text-xs font-bold uppercase text-muted">Password</label>
            <input type="password" className="input-premium mt-1 text-sm" placeholder="Minimum 8 characters" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} /></div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button fullWidth disabled={submittingAdd || !addForm.name || !addForm.email} onClick={handleAdd}>
              {submittingAdd ? "Creating..." : "Create user"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User" subtitle={editUser?.email || ""}>
        <div className="space-y-3">
          <div><label className="text-xs font-bold uppercase text-muted">Full Name</label>
            <input className="input-premium mt-1 text-sm" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Roles (multi-select)</label>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ROLE_ORDER.map((r) => {
                const on = editForm.roles.includes(r as Role);
                return (
                  <button key={r} type="button" onClick={() => toggleEditRole(r as Role)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                      on ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20" : "border-line bg-white text-slate-600 hover:border-blue-300 hover:bg-slate-50"
                    }`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>
                      {on && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                    {roleLabel(r as Parameters<typeof roleLabel>[0])}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted">Pick one or more — the user can combine roles.</p>
          </div>
          <div><label className="text-xs font-bold uppercase text-muted">New Password <span className="font-normal">(leave blank to keep)</span></label>
            <input type="password" className="input-premium mt-1 text-sm" placeholder="Leave blank to keep current" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} /></div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={() => setEditUser(null)}>Cancel</Button>
            <Button fullWidth disabled={submittingEdit || !editForm.name} onClick={handleEdit}>
              {submittingEdit ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageReveal>
  );
}
