"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AdminMasterCalendar } from "@/components/admin-master-calendar";
import { House, isAdmin, saveSchoolConfig, SchoolClass, SchoolConfig, seedSesConfig, subscribeSchoolConfig } from "@/lib/school-data";

export function AdminPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState("");
  const [config, setConfig] = useState<SchoolConfig | null>(null);
  const [yearId, setYearId] = useState("year8");
  const [classId, setClassId] = useState("8g");
  const [houseId, setHouseId] = useState("geckos");
  const [status, setStatus] = useState("");

  async function checkAdminAccess() { if (!user) return; setAllowed(null); setAccessError(""); try { setAllowed(await isAdmin(user.uid)); } catch (error) { const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : ""; setAccessError(code || "Unable to read the admin record from Firestore."); setAllowed(false); } }
  useEffect(() => { if (user) void checkAdminAccess(); }, [user]);
  useEffect(() => subscribeSchoolConfig("ses", setConfig), []);
  useEffect(() => { if (!config) return; const validYear = config.years.find(item => item.id === yearId) || config.years[0]; if (!validYear) { setYearId(""); setClassId(""); setHouseId(""); return; } const validClass = validYear.classes.find(item => item.id === classId) || validYear.classes[0]; const validHouse = validClass?.houses.find(item => item.id === houseId) || validClass?.houses[0]; if (yearId !== validYear.id) setYearId(validYear.id); if (classId !== (validClass?.id || "")) setClassId(validClass?.id || ""); if (houseId !== (validHouse?.id || "")) setHouseId(validHouse?.id || ""); }, [config, yearId, classId, houseId]);
  const year = config?.years.find(item => item.id === yearId); const schoolClass = year?.classes.find(item => item.id === classId);
  if (allowed === null) return <section className="page"><p>Checking admin access…</p></section>;
  if (!allowed) return <section className="page"><div className="admin-lock"><ShieldCheck size={30}/><h1>Admin access required</h1><p>MPlace Study is checking for a Firestore document at <code>admins/{user?.uid}</code>.</p>{user?.uid ? <p><strong>Your current Firebase UID:</strong><br/><code>{user.uid}</code></p> : null}{accessError ? <p><strong>Firestore error:</strong> <code>{accessError}</code></p> : <p>No admin document was found for this signed-in account.</p>}<button className="primary-button" onClick={() => void checkAdminAccess()}>Check again</button></div></section>;

  async function initialise() { await seedSesConfig(); setStatus("SES structure created."); }
  async function persistConfig(next: SchoolConfig) { setConfig(next); await saveSchoolConfig(next); setStatus("School structure saved."); }
  async function addYear() { const label = window.prompt("Year label, e.g. Year 9"); if (!label || !config) return; const id = label.toLowerCase().replace(/\s+/g, ""); await persistConfig({ ...config, years: [...config.years, { id, label, classes: [] }] }); setYearId(id); setClassId(""); setHouseId(""); }
  async function addClass() { const label = window.prompt("Class label, e.g. 8H"); if (!label || !config || !year) return; const nextClass: SchoolClass = { id: label.toLowerCase().replace(/\s+/g, ""), label, houses: [] }; const years = config.years.map(y => y.id === year.id ? { ...y, classes: [...y.classes.filter(c => c.id !== nextClass.id), nextClass] } : y); await persistConfig({ ...config, years }); setClassId(nextClass.id); setHouseId(""); }
  async function deleteClass() { if (!config || !year || !schoolClass) return; if (!window.confirm(`Delete ${schoolClass.label}?`)) return; const remaining = year.classes.filter(c => c.id !== schoolClass.id); const years = config.years.map(y => y.id === year.id ? { ...y, classes: remaining } : y); await persistConfig({ ...config, years }); setClassId(remaining[0]?.id || ""); setHouseId(remaining[0]?.houses[0]?.id || ""); }
  async function addHouse() { const label = window.prompt("House name"); if (!label || !config || !year || !schoolClass) return; const nextHouse: House = { id: label.toLowerCase().replace(/\s+/g, "-"), label }; const years = config.years.map(y => y.id === year.id ? { ...y, classes: y.classes.map(c => c.id === schoolClass.id ? { ...c, houses: [...c.houses.filter(h => h.id !== nextHouse.id), nextHouse] } : c) } : y); await persistConfig({ ...config, years }); setHouseId(nextHouse.id); }
  async function addPrefix() { const prefix = window.prompt("Room prefix, e.g. G")?.trim().toUpperCase(); if (!prefix || !config) return; const building = window.prompt("Building name")?.trim(); if (!building) return; await persistConfig({ ...config, roomPrefixes: [...config.roomPrefixes.filter(item => item.prefix !== prefix), { prefix, building }] }); }
  if (!config) return <section className="page"><div className="admin-lock"><h1>Set up MPlace Study school data</h1><p>No SES school configuration exists yet.</p><button className="primary-button" onClick={initialise}><Plus size={17}/> Initialise SES</button></div></section>;

  return <section className="page">
    <div className="page-head"><div><p className="eyebrow">Control centre</p><h1>MPlace Study Admin</h1><p>Manage school structure, Class Locator and the Master Calendar.</p></div></div>
    {status ? <div className="notice">{status}</div> : null}
    <AdminMasterCalendar />
    <section className="admin-section"><div className="section-row"><div><h2 className="section-title">School structure</h2><p className="section-help">Manage years, classes and houses used elsewhere in MPlace Study.</p></div></div>{config.years.length === 0 ? <div className="school-empty">No valid years remain. Use Add year to rebuild the structure.</div> : null}<div className="admin-select-grid"><label>Year<select value={yearId} onChange={e => { const next = e.target.value; setYearId(next); const y = config.years.find(item => item.id === next); setClassId(y?.classes[0]?.id || ""); setHouseId(y?.classes[0]?.houses[0]?.id || ""); }}>{config.years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}</select></label><label>Class<select value={classId} onChange={e => { const next = e.target.value; setClassId(next); const c = year?.classes.find(item => item.id === next); setHouseId(c?.houses[0]?.id || ""); }} disabled={!year}>{year?.classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>House<select value={houseId} onChange={e => setHouseId(e.target.value)} disabled={!schoolClass}>{schoolClass?.houses.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}</select></label></div><div className="form-actions"><button className="text-button" onClick={addYear}><Plus size={15}/> Add year</button><button className="text-button" onClick={addClass} disabled={!year}><Plus size={15}/> Add class</button><button className="text-button danger" onClick={deleteClass} disabled={!schoolClass}><Trash2 size={15}/> Delete class</button><button className="text-button" onClick={addHouse} disabled={!schoolClass}><Plus size={15}/> Add house</button></div></section>
    <section className="admin-section"><div className="section-row"><div><h2 className="section-title">Class Locator</h2><p className="section-help">Room prefixes are used by personal timetable entries and Class Locator.</p></div><button className="text-button" onClick={addPrefix}><Plus size={15}/> Add prefix</button></div><div className="locator-prefix-grid">{config.roomPrefixes.map(item => <article key={item.prefix}><strong>{item.prefix}</strong><span>{item.building}</span><button className="icon-button danger" onClick={() => void persistConfig({ ...config, roomPrefixes: config.roomPrefixes.filter(p => p.prefix !== item.prefix) })}><Trash2 size={14}/></button></article>)}</div></section>
  </section>;
}
