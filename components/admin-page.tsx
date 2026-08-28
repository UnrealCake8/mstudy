"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  DEFAULT_SES,
  House,
  isAdmin,
  publishTimetable,
  saveDraftTimetable,
  saveSchoolConfig,
  SchoolClass,
  SchoolConfig,
  SchoolSelection,
  SchoolTimetableEntry,
  seedSesConfig,
  subscribeSchoolConfig,
  subscribeTimetable,
  TimetableMode,
} from "@/lib/school-data";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const emptyEntry = (): SchoolTimetableEntry => ({ id: crypto.randomUUID(), day: "Monday", subject: "", startTime: "08:00", endTime: "08:50", room: "", teacher: "", type: "Lesson", notes: "" });

type WeekView = "all" | "week1" | "week2";

export function AdminPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState("");
  const [config, setConfig] = useState<SchoolConfig | null>(null);
  const [yearId, setYearId] = useState("year8");
  const [classId, setClassId] = useState("8g");
  const [houseId, setHouseId] = useState("geckos");
  const [mode, setMode] = useState<TimetableMode>("all");
  const [weekView, setWeekView] = useState<WeekView>("all");
  const [allEntries, setAllEntries] = useState<SchoolTimetableEntry[]>([]);
  const [week1Entries, setWeek1Entries] = useState<SchoolTimetableEntry[]>([]);
  const [week2Entries, setWeek2Entries] = useState<SchoolTimetableEntry[]>([]);
  const [status, setStatus] = useState("");

  async function checkAdminAccess() {
    if (!user) return;
    setAllowed(null);
    setAccessError("");
    try {
      setAllowed(await isAdmin(user.uid));
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
      setAccessError(code || "Unable to read the admin record from Firestore.");
      setAllowed(false);
    }
  }

  useEffect(() => { if (user) void checkAdminAccess(); }, [user]);
  useEffect(() => subscribeSchoolConfig("ses", setConfig), []);

  useEffect(() => {
    if (!config) return;
    const validYear = config.years.find(item => item.id === yearId) || config.years[0];
    if (!validYear) {
      if (yearId || classId || houseId) {
        setYearId("");
        setClassId("");
        setHouseId("");
      }
      return;
    }
    const validClass = validYear.classes.find(item => item.id === classId) || validYear.classes[0];
    const validHouse = validClass?.houses.find(item => item.id === houseId) || validClass?.houses[0];
    if (yearId !== validYear.id) setYearId(validYear.id);
    if (classId !== (validClass?.id || "")) setClassId(validClass?.id || "");
    if (houseId !== (validHouse?.id || "")) setHouseId(validHouse?.id || "");
  }, [config, yearId, classId, houseId]);

  const year = config?.years.find(item => item.id === yearId);
  const schoolClass = year?.classes.find(item => item.id === classId);
  const house = schoolClass?.houses.find(item => item.id === houseId);
  const selection: SchoolSelection = { schoolId: "ses", yearId, classId, houseId };

  useEffect(() => {
    if (!allowed || !config || !year || !schoolClass || !house) {
      setAllEntries([]);
      setWeek1Entries([]);
      setWeek2Entries([]);
      return;
    }
    return subscribeTimetable(selection, value => {
      const nextMode = value?.mode === "separate" ? "separate" : "all";
      setMode(nextMode);
      setWeekView(nextMode === "separate" ? "week1" : "all");
      setAllEntries(value?.draftEntries || value?.publishedEntries || []);
      setWeek1Entries(value?.draftWeek1Entries || value?.publishedWeek1Entries || []);
      setWeek2Entries(value?.draftWeek2Entries || value?.publishedWeek2Entries || []);
    });
  }, [allowed, config, yearId, classId, houseId]);

  const entries = weekView === "week1" ? week1Entries : weekView === "week2" ? week2Entries : allEntries;
  const setEntries = weekView === "week1" ? setWeek1Entries : weekView === "week2" ? setWeek2Entries : setAllEntries;
  const sortedEntries = useMemo(() => [...entries].sort((a,b) => days.indexOf(a.day) - days.indexOf(b.day) || a.startTime.localeCompare(b.startTime)), [entries]);

  if (allowed === null) return <section className="page"><p>Checking admin access…</p></section>;
  if (!allowed) return <section className="page"><div className="admin-lock"><ShieldCheck size={30}/><h1>Admin access required</h1><p>MStudy is checking for a Firestore document at <code>admins/{user?.uid}</code>.</p>{user?.uid ? <p><strong>Your current Firebase UID:</strong><br/><code>{user.uid}</code></p> : null}{accessError ? <p><strong>Firestore error:</strong> <code>{accessError}</code></p> : <p>No admin document was found for this signed-in account.</p>}<p>Make sure the document ID exactly matches this UID and that it is in the same Firebase project used by this MStudy deployment.</p><button className="primary-button" onClick={() => void checkAdminAccess()}>Check again</button></div></section>;

  async function initialise() {
    await seedSesConfig();
    setStatus("SES structure created.");
  }

  async function persistConfig(next: SchoolConfig) {
    setConfig(next);
    await saveSchoolConfig(next);
    setStatus("School structure saved.");
  }

  async function addYear() {
    const label = window.prompt("Year label, e.g. Year 9");
    if (!label || !config) return;
    const id = label.toLowerCase().replace(/\s+/g, "");
    await persistConfig({ ...config, years: [...config.years, { id, label, classes: [] }] });
    setYearId(id);
    setClassId("");
    setHouseId("");
  }

  async function addClass() {
    const label = window.prompt("Class label, e.g. 8H");
    if (!label || !config || !year) return;
    const nextClass: SchoolClass = { id: label.toLowerCase().replace(/\s+/g, ""), label, houses: [] };
    const years = config.years.map(y => y.id === year.id ? { ...y, classes: [...y.classes.filter(c => c.id !== nextClass.id), nextClass] } : y);
    await persistConfig({ ...config, years });
    setClassId(nextClass.id);
    setHouseId("");
  }

  async function deleteClass() {
    if (!config || !year || !schoolClass) return;
    if (!window.confirm(`Delete ${schoolClass.label}? This removes the class from the school selector. Existing timetable documents are left untouched for safety.`)) return;
    const remaining = year.classes.filter(c => c.id !== schoolClass.id);
    const years = config.years.map(y => y.id === year.id ? { ...y, classes: remaining } : y);
    const deletedLabel = schoolClass.label;
    await persistConfig({ ...config, years });
    const fallback = remaining[0];
    setClassId(fallback?.id || "");
    setHouseId(fallback?.houses[0]?.id || "");
    setStatus(`${deletedLabel} deleted. Any stale selections will repair themselves automatically.`);
  }

  async function addHouse() {
    const label = window.prompt("House name");
    if (!label || !config || !year || !schoolClass) return;
    const nextHouse: House = { id: label.toLowerCase().replace(/\s+/g, "-"), label };
    const years = config.years.map(y => y.id === year.id ? { ...y, classes: y.classes.map(c => c.id === schoolClass.id ? { ...c, houses: [...c.houses.filter(h => h.id !== nextHouse.id), nextHouse] } : c) } : y);
    await persistConfig({ ...config, years });
    setHouseId(nextHouse.id);
  }

  async function addPrefix() {
    const prefix = window.prompt("Room prefix, e.g. G")?.trim().toUpperCase();
    if (!prefix || !config) return;
    const building = window.prompt("Building name")?.trim();
    if (!building) return;
    await persistConfig({ ...config, roomPrefixes: [...config.roomPrefixes.filter(item => item.prefix !== prefix), { prefix, building }] });
  }

  function updateEntry(id: string, key: keyof SchoolTimetableEntry, value: string) {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, [key]: value } : entry));
  }

  function switchMode(nextMode: TimetableMode) {
    setMode(nextMode);
    if (nextMode === "all") {
      setWeekView("all");
    } else {
      if (week1Entries.length === 0 && week2Entries.length === 0 && allEntries.length > 0) {
        setWeek1Entries(allEntries.map(entry => ({ ...entry, id: crypto.randomUUID() })));
        setWeek2Entries(allEntries.map(entry => ({ ...entry, id: crypto.randomUUID() })));
      }
      setWeekView("week1");
    }
    setStatus(nextMode === "separate" ? "Separate Weeks enabled. Edit Week 1 and Week 2 independently, then save or publish." : "Separate Weeks disabled. Students will use the All Weeks timetable.");
  }

  async function saveDraft() {
    if (!year || !schoolClass || !house) return;
    await saveDraftTimetable(selection, mode, allEntries, week1Entries, week2Entries);
    setStatus("Draft saved. Students still see the last published version.");
  }

  async function publish() {
    if (!year || !schoolClass || !house) return;
    await publishTimetable(selection, mode, allEntries, week1Entries, week2Entries);
    setStatus(`Published ${mode === "separate" ? "Week 1 and Week 2" : "All Weeks"} to ${year.label} → ${schoolClass.label} → ${house.label}.`);
  }

  if (!config) return <section className="page"><div className="admin-lock"><h1>Set up MStudy school data</h1><p>No SES school configuration exists yet.</p><button className="primary-button" onClick={initialise}><Plus size={17}/> Initialise SES</button></div></section>;

  return <section className="page">
    <div className="page-head"><div><p className="eyebrow">Control centre</p><h1>MStudy Admin</h1><p>Manage school structure, room prefixes and the master timetable students receive.</p></div></div>
    {status ? <div className="notice">{status}</div> : null}

    <section className="admin-section">
      <div className="section-row"><div><h2 className="section-title">School structure</h2><p className="section-help">Add years, classes and houses without changing the code. Invalid Firebase references are repaired automatically.</p></div></div>
      {config.years.length === 0 ? <div className="school-empty">No valid years remain. Use Add year to rebuild the structure.</div> : null}
      <div className="admin-select-grid">
        <label>Year<select value={yearId} onChange={e => { const next = e.target.value; setYearId(next); const y = config.years.find(item => item.id === next); setClassId(y?.classes[0]?.id || ""); setHouseId(y?.classes[0]?.houses[0]?.id || ""); }}>{config.years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}</select></label>
        <label>Class<select value={classId} onChange={e => { const next = e.target.value; setClassId(next); const c = year?.classes.find(item => item.id === next); setHouseId(c?.houses[0]?.id || ""); }} disabled={!year}>{year?.classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>House<select value={houseId} onChange={e => setHouseId(e.target.value)} disabled={!schoolClass}>{schoolClass?.houses.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}</select></label>
      </div>
      <div className="form-actions"><button className="text-button" onClick={addYear}><Plus size={15}/> Add year</button><button className="text-button" onClick={addClass} disabled={!year}><Plus size={15}/> Add class</button><button className="text-button danger" onClick={deleteClass} disabled={!schoolClass}><Trash2 size={15}/> Delete class</button><button className="text-button" onClick={addHouse} disabled={!schoolClass}><Plus size={15}/> Add house</button></div>
    </section>

    <section className="admin-section">
      <div className="section-row"><div><h2 className="section-title">Class Locator</h2><p className="section-help">Room prefixes are used everywhere in the app.</p></div><button className="text-button" onClick={addPrefix}><Plus size={15}/> Add prefix</button></div>
      <div className="locator-prefix-grid">{config.roomPrefixes.map(item => <article key={item.prefix}><strong>{item.prefix}</strong><span>{item.building}</span><button className="icon-button danger" onClick={() => persistConfig({ ...config, roomPrefixes: config.roomPrefixes.filter(p => p.prefix !== item.prefix) })}><Trash2 size={14}/></button></article>)}</div>
    </section>

    <section className="admin-section">
      <div className="section-row"><div><h2 className="section-title">Master timetable</h2><p className="section-help">Editing {year?.label || "—"} → {schoolClass?.label || "—"} → {house?.label || "—"}. Save drafts safely, then publish when ready.</p></div><button className="primary-button" onClick={() => setEntries(current => [...current, emptyEntry()])} disabled={!house}><Plus size={17}/> Add item</button></div>

      {!house ? <div className="school-empty">Choose or create a valid class and house before editing a timetable.</div> : <>
      <div className="timetable-mode-row">
        <label className="mode-switch"><input type="checkbox" checked={mode === "separate"} onChange={e => switchMode(e.target.checked ? "separate" : "all")}/><span><strong>Separate Weeks Timetable</strong><small>{mode === "separate" ? "Week 1 and Week 2 are different." : "Disabled: one All Weeks timetable is used every week."}</small></span></label>
      </div>

      <div className="week-tabs" role="tablist" aria-label="Timetable week">
        {mode === "all" ? <button className="week-tab active" type="button">All Weeks</button> : <><button className={weekView === "week1" ? "week-tab active" : "week-tab"} type="button" onClick={() => setWeekView("week1")}>Week 1</button><button className={weekView === "week2" ? "week-tab active" : "week-tab"} type="button" onClick={() => setWeekView("week2")}>Week 2</button></>}
      </div>

      <div className="admin-timetable-list">{sortedEntries.map(entry => <article className="admin-timetable-row" key={entry.id}>
        <select value={entry.day} onChange={e => updateEntry(entry.id, "day", e.target.value)}>{days.map(day => <option key={day}>{day}</option>)}</select>
        <input value={entry.startTime} type="time" onChange={e => updateEntry(entry.id, "startTime", e.target.value)}/>
        <input value={entry.endTime} type="time" onChange={e => updateEntry(entry.id, "endTime", e.target.value)}/>
        <input value={entry.subject} placeholder="Subject / activity" onChange={e => updateEntry(entry.id, "subject", e.target.value)}/>
        <input value={entry.room} placeholder="Room" onChange={e => updateEntry(entry.id, "room", e.target.value)}/>
        <input value={entry.teacher} placeholder="Teacher" onChange={e => updateEntry(entry.id, "teacher", e.target.value)}/>
        <button className="icon-button danger" aria-label={`Delete ${entry.subject || "timetable item"}`} onClick={() => setEntries(current => current.filter(item => item.id !== entry.id))}><Trash2 size={15}/></button>
      </article>)}</div>
      {entries.length === 0 ? <div className="empty-state"><strong>No timetable items yet</strong><span>Add the first lesson, break or activity for {mode === "separate" ? (weekView === "week1" ? "Week 1" : "Week 2") : "All Weeks"}.</span></div> : null}
      <div className="form-actions"><button className="text-button" onClick={saveDraft}><Save size={15}/> Save draft</button><button className="primary-button" onClick={publish}><Upload size={16}/> Publish timetable</button></div>
      </>}
    </section>
  </section>;
}
