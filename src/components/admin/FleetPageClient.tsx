"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageReveal } from "@/components/motion/PageReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format-date";
import type { Role } from "@prisma/client";
import {
  Truck, Users, Plus, Edit2, PowerOff, Power,
  Search, Hash, Phone, FileText, Weight, Link2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TruckRecord = {
  id: string; plateNumber: string; model: string;
  capacity: number; active: boolean; notes: string | null; createdAt: string;
  assignedDriverId?: string | null;
};

type DriverRecord = {
  id: string; name: string; phone: string | null; licenseNo: string | null;
  active: boolean; notes: string | null; createdAt: string;
};

const emptyTruck = { plateNumber: "", model: "", capacity: "", notes: "" };
const emptyDriver = { name: "", phone: "", licenseNo: "", notes: "" };

// ─── Fleet Page Client ────────────────────────────────────────────────────────

export function FleetPageClient({ userRole, userRoles }: { userRole: Role; userRoles?: Role[] }) {
  const [tab, setTab] = useState<"trucks" | "drivers">("trucks");
  const [trucks, setTrucks] = useState<TruckRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [search, setSearch] = useState("");
  const toast = useToast();

  const roles = userRoles && userRoles.length > 0 ? userRoles : [userRole];
  const canEdit = roles.includes("administrator") || roles.includes("manager");

  // ── Truck modals ──
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [truckForm, setTruckForm] = useState(emptyTruck);
  const [editTruck, setEditTruck] = useState<TruckRecord | null>(null);
  const [editTruckForm, setEditTruckForm] = useState(emptyTruck);
  const [submittingTruck, setSubmittingTruck] = useState(false);

  // ── Assignment modal ──
  const [assignTruck, setAssignTruck] = useState<TruckRecord | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // ── Driver modals ──
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverForm, setDriverForm] = useState(emptyDriver);
  const [editDriver, setEditDriver] = useState<DriverRecord | null>(null);
  const [editDriverForm, setEditDriverForm] = useState({ ...emptyDriver, licenseNo: "" });
  const [submittingDriver, setSubmittingDriver] = useState(false);

  useEffect(() => {
    fetch("/api/fleet/trucks").then(r => r.json()).then(d => { setTrucks(d.trucks || []); setLoadingTrucks(false); });
    fetch("/api/fleet/drivers").then(r => r.json()).then(d => { setDrivers(d.drivers || []); setLoadingDrivers(false); });
  }, []);

  // ── Truck actions ──
  async function handleAddTruck() {
    setSubmittingTruck(true);
    try {
      const res = await fetch("/api/fleet/trucks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(truckForm),
      });
      const data = await res.json();
      if (res.ok) {
        setTrucks(prev => [{ ...data.truck, createdAt: new Date().toISOString() }, ...prev]);
        setShowAddTruck(false); setTruckForm(emptyTruck);
        toast.success(`Truck ${data.truck.plateNumber} added`);
      } else toast.error(data.error || "Failed to add truck");
    } catch { toast.error("Network error"); } finally { setSubmittingTruck(false); }
  }

  async function handleSaveTruck() {
    if (!editTruck) return;
    setSubmittingTruck(true);
    try {
      const res = await fetch("/api/fleet/trucks", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTruck.id, ...editTruckForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setTrucks(prev => prev.map(t => t.id === editTruck.id ? { ...t, ...data.truck } : t));
        setEditTruck(null); toast.success("Truck updated");
      } else toast.error(data.error || "Update failed");
    } catch { toast.error("Network error"); } finally { setSubmittingTruck(false); }
  }

  async function handleToggleTruck(truck: TruckRecord) {
    const res = await fetch("/api/fleet/trucks", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: truck.id, active: !truck.active }),
    });
    if (res.ok) {
      setTrucks(prev => prev.map(t => t.id === truck.id ? { ...t, active: !truck.active } : t));
      toast.success(!truck.active ? "Truck activated" : "Truck deactivated");
    }
  }

  async function handleAssignDriver() {
    if (!assignTruck) return;
    setSubmittingAssign(true);
    try {
      const res = await fetch("/api/fleet/trucks", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assignTruck.id, assignedDriverId: assignDriverId || null }),
      });
      if (res.ok) {
        setTrucks(prev => prev.map(t => t.id === assignTruck.id ? { ...t, assignedDriverId: assignDriverId || null } : t));
        setAssignTruck(null);
        toast.success(assignDriverId ? "Driver assigned to truck" : "Driver unassigned from truck");
      }
    } catch { toast.error("Network error"); } finally { setSubmittingAssign(false); }
  }

  // ── Driver actions ──
  async function handleAddDriver() {
    setSubmittingDriver(true);
    try {
      const res = await fetch("/api/fleet/drivers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driverForm),
      });
      const data = await res.json();
      if (res.ok) {
        setDrivers(prev => [...prev, { ...data.driver, createdAt: new Date().toISOString() }].sort((a, b) => a.name.localeCompare(b.name)));
        setShowAddDriver(false); setDriverForm(emptyDriver);
        toast.success(`Driver ${data.driver.name} added`);
      } else toast.error(data.error || "Failed to add driver");
    } catch { toast.error("Network error"); } finally { setSubmittingDriver(false); }
  }

  async function handleSaveDriver() {
    if (!editDriver) return;
    setSubmittingDriver(true);
    try {
      const res = await fetch("/api/fleet/drivers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editDriver.id, ...editDriverForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrivers(prev => prev.map(d => d.id === editDriver.id ? { ...d, ...data.driver } : d));
        setEditDriver(null); toast.success("Driver updated");
      } else toast.error(data.error || "Update failed");
    } catch { toast.error("Network error"); } finally { setSubmittingDriver(false); }
  }

  async function handleToggleDriver(driver: DriverRecord) {
    const res = await fetch("/api/fleet/drivers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: driver.id, active: !driver.active }),
    });
    if (res.ok) {
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, active: !driver.active } : d));
      toast.success(!driver.active ? "Driver activated" : "Driver deactivated");
    }
  }

  const filteredTrucks = trucks.filter(t =>
    !search || t.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
    t.model.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDrivers = drivers.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.phone && d.phone.includes(search)) ||
    (d.licenseNo && d.licenseNo.toLowerCase().includes(search.toLowerCase()))
  );

  const activeTrucks = trucks.filter(t => t.active).length;
  const activeDrivers = drivers.filter(d => d.active).length;

  return (
    <PageReveal className="space-y-6">
      {/* Hero */}
      <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#0a1628] via-slate-900 to-indigo-950 p-5 text-white shadow-xl sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Fleet Management</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                {activeTrucks} active truck{activeTrucks !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {activeDrivers} active driver{activeDrivers !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          {canEdit && (
            <Button
              variant="white"
              className="w-full !px-4 !py-2 !text-xs sm:w-auto sm:shrink-0"
              onClick={() => tab === "trucks" ? setShowAddTruck(true) : setShowAddDriver(true)}
            >
              <Plus size={13} /> Add {tab === "trucks" ? "Truck" : "Driver"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-line bg-white p-1 shadow-sm w-fit">
          {(["trucks", "drivers"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch(""); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${tab === t ? "bg-navy-900 text-white shadow-md" : "text-muted hover:text-navy-900"}`}>
              {t === "trucks" ? <Truck size={14} /> : <Users size={14} />}
              {t} <span className="text-[10px] opacity-70">({t === "trucks" ? trucks.length : drivers.length})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input className="input-premium w-full pl-9 text-sm sm:w-56"
            placeholder={tab === "trucks" ? "Search plate or model…" : "Search name, phone…"}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* ── TRUCKS TAB ── */}
      <AnimatePresence mode="wait">
        {tab === "trucks" && (
          <motion.div key="trucks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loadingTrucks ? (
              <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">Loading trucks…</div>
            ) : filteredTrucks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line py-16 text-center">
                <Truck size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-navy-900">No trucks yet</p>
                <p className="text-xs text-muted mt-1">{canEdit ? "Click \"Add Truck\" to register your first vehicle." : "No trucks registered."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm admin-scroll">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b border-line bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-5 py-3.5">Plate Number</th>
                      <th className="px-4 py-3.5">Model</th>
                      <th className="px-4 py-3.5">Assigned Driver</th>
                      <th className="px-4 py-3.5">Capacity</th>
                      <th className="px-4 py-3.5">Status</th>
                      {canEdit && <th className="px-4 py-3.5">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredTrucks.map(truck => {
                      const assignedDriver = truck.assignedDriverId ? drivers.find(d => d.id === truck.assignedDriverId) : null;
                      return (
                        <tr key={truck.id} className={`transition hover:bg-slate-50/70 ${!truck.active ? "opacity-50" : ""}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Truck size={14} /></div>
                              <span className="font-mono font-bold text-navy-900">{truck.plateNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-muted text-xs">{truck.model || "—"}</td>
                          <td className="px-4 py-3.5">
                            {assignedDriver ? (
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-bold text-emerald-800">
                                  {assignedDriver.name.slice(0, 1)}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-navy-900">{assignedDriver.name}</p>
                                  {assignedDriver.phone && <p className="text-[10px] text-muted">{assignedDriver.phone}</p>}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted">{truck.capacity > 0 ? `${truck.capacity} pallets` : "—"}</td>
                          <td className="px-4 py-3.5">
                            <Badge tone={truck.active ? "ok" : "neutral"}>{truck.active ? "Active" : "Inactive"}</Badge>
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3.5">
                              <div className="flex gap-1">
                                <button onClick={() => { setAssignTruck(truck); setAssignDriverId(truck.assignedDriverId || ""); }}
                                  title="Assign / change driver"
                                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition">
                                  <Link2 size={13} />
                                </button>
                                <button onClick={() => { setEditTruck(truck); setEditTruckForm({ plateNumber: truck.plateNumber, model: truck.model, capacity: String(truck.capacity), notes: truck.notes || "" }); }}
                                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleToggleTruck(truck)}
                                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${truck.active ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                                  {truck.active ? <PowerOff size={13} /> : <Power size={13} />}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ── DRIVERS TAB ── */}
        {tab === "drivers" && (
          <motion.div key="drivers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loadingDrivers ? (
              <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">Loading drivers…</div>
            ) : filteredDrivers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line py-16 text-center">
                <Users size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-navy-900">No drivers yet</p>
                <p className="text-xs text-muted mt-1">{canEdit ? "Click \"Add Driver\" to register your first driver." : "No drivers registered."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDrivers.map(driver => (
                  <div key={driver.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-nowrap ${!driver.active ? "opacity-50" : ""}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow">
                      {driver.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-bold text-navy-900 text-sm">{driver.name}</p>
                        <Badge tone={driver.active ? "ok" : "neutral"}>{driver.active ? "Active" : "Inactive"}</Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted">
                        {driver.phone && <span className="flex items-center gap-1"><Phone size={10} /> {driver.phone}</span>}
                        {driver.licenseNo && <span className="flex items-center gap-1"><Hash size={10} /> {driver.licenseNo}</span>}
                        <span>{formatDate(driver.createdAt)}</span>
                      </div>
                      {driver.notes && <p className="mt-1 text-xs text-muted"><FileText size={10} className="inline mr-1" />{driver.notes}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => { setEditDriver(driver); setEditDriverForm({ name: driver.name, phone: driver.phone || "", licenseNo: driver.licenseNo || "", notes: driver.notes || "" }); }}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleToggleDriver(driver)}
                          className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${driver.active ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                          {driver.active ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ADD TRUCK MODAL ── */}
      <Modal open={showAddTruck} onClose={() => setShowAddTruck(false)} title="Add Truck" subtitle="Register a new vehicle to the fleet">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted">Plate Number *</label>
            <input className="input-premium mt-1 text-sm font-mono" placeholder="e.g. ABC-1234" value={truckForm.plateNumber} onChange={e => setTruckForm({ ...truckForm, plateNumber: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Vehicle Model</label>
            <input className="input-premium mt-1 text-sm" placeholder="e.g. Mercedes Actros" value={truckForm.model} onChange={e => setTruckForm({ ...truckForm, model: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted flex items-center gap-1.5"><Weight size={11} /> Pallet Capacity</label>
            <input type="number" min="0" className="input-premium mt-1 text-sm" placeholder="20" value={truckForm.capacity} onChange={e => setTruckForm({ ...truckForm, capacity: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Notes</label>
            <input className="input-premium mt-1 text-sm" placeholder="Optional notes" value={truckForm.notes} onChange={e => setTruckForm({ ...truckForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" fullWidth onClick={() => setShowAddTruck(false)}>Cancel</Button>
            <Button fullWidth disabled={submittingTruck || !truckForm.plateNumber.trim()} onClick={handleAddTruck}>
              {submittingTruck ? "Adding…" : "Add Truck"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── EDIT TRUCK MODAL ── */}
      <Modal open={!!editTruck} onClose={() => setEditTruck(null)} title="Edit Truck" subtitle={editTruck?.plateNumber || ""}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted">Plate Number *</label>
            <input className="input-premium mt-1 text-sm font-mono" value={editTruckForm.plateNumber} onChange={e => setEditTruckForm({ ...editTruckForm, plateNumber: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Vehicle Model</label>
            <input className="input-premium mt-1 text-sm" value={editTruckForm.model} onChange={e => setEditTruckForm({ ...editTruckForm, model: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Pallet Capacity</label>
            <input type="number" min="0" className="input-premium mt-1 text-sm" value={editTruckForm.capacity} onChange={e => setEditTruckForm({ ...editTruckForm, capacity: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Notes</label>
            <input className="input-premium mt-1 text-sm" value={editTruckForm.notes} onChange={e => setEditTruckForm({ ...editTruckForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" fullWidth onClick={() => setEditTruck(null)}>Cancel</Button>
            <Button fullWidth disabled={submittingTruck} onClick={handleSaveTruck}>
              {submittingTruck ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── ADD DRIVER MODAL ── */}
      <Modal open={showAddDriver} onClose={() => setShowAddDriver(false)} title="Add Driver" subtitle="Register a new driver to the fleet">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted">Full Name *</label>
            <input className="input-premium mt-1 text-sm" placeholder="e.g. Mohammed Al-Zahrani" value={driverForm.name} onChange={e => setDriverForm({ ...driverForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Phone Number</label>
            <input type="tel" className="input-premium mt-1 text-sm" placeholder="+966 5XX XXX XXXX" value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">License Number</label>
            <input className="input-premium mt-1 text-sm font-mono" placeholder="DL-XXXXXXXX" value={driverForm.licenseNo} onChange={e => setDriverForm({ ...driverForm, licenseNo: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Notes</label>
            <input className="input-premium mt-1 text-sm" placeholder="Optional notes" value={driverForm.notes} onChange={e => setDriverForm({ ...driverForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" fullWidth onClick={() => setShowAddDriver(false)}>Cancel</Button>
            <Button fullWidth disabled={submittingDriver || !driverForm.name.trim()} onClick={handleAddDriver}>
              {submittingDriver ? "Adding…" : "Add Driver"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── EDIT DRIVER MODAL ── */}
      <Modal open={!!editDriver} onClose={() => setEditDriver(null)} title="Edit Driver" subtitle={editDriver?.name || ""}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted">Full Name *</label>
            <input className="input-premium mt-1 text-sm" value={editDriverForm.name} onChange={e => setEditDriverForm({ ...editDriverForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Phone Number</label>
            <input type="tel" className="input-premium mt-1 text-sm" value={editDriverForm.phone} onChange={e => setEditDriverForm({ ...editDriverForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">License Number</label>
            <input className="input-premium mt-1 text-sm font-mono" value={editDriverForm.licenseNo} onChange={e => setEditDriverForm({ ...editDriverForm, licenseNo: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted">Notes</label>
            <input className="input-premium mt-1 text-sm" value={editDriverForm.notes} onChange={e => setEditDriverForm({ ...editDriverForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" fullWidth onClick={() => setEditDriver(null)}>Cancel</Button>
            <Button fullWidth disabled={submittingDriver} onClick={handleSaveDriver}>
              {submittingDriver ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── ASSIGN DRIVER MODAL ── */}
      <Modal open={!!assignTruck} onClose={() => setAssignTruck(null)} title="Assign Driver to Truck" subtitle={assignTruck ? `Truck: ${assignTruck.plateNumber}` : ""}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted">Select Driver</label>
            <select className="input-premium mt-1 text-sm" value={assignDriverId} onChange={e => setAssignDriverId(e.target.value)}>
              <option value="">— Unassign (no driver) —</option>
              {drivers.filter(d => d.active).map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.phone ? ` · ${d.phone}` : ""}</option>
              ))}
            </select>
          </div>
          {assignDriverId && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
              <strong>{drivers.find(d => d.id === assignDriverId)?.name}</strong> will be assigned as the default driver for <strong>{assignTruck?.plateNumber}</strong>. This is for planning only — dispatch details are always confirmed at scan time.
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" fullWidth onClick={() => setAssignTruck(null)}>Cancel</Button>
            <Button fullWidth disabled={submittingAssign} onClick={handleAssignDriver}>
              {submittingAssign ? "Saving…" : assignDriverId ? "Assign Driver" : "Unassign Driver"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageReveal>
  );
}
