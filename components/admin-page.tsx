"use client";

import { useEffect, useMemo, useState } from "react";
import { FileUp, Plus, Save, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
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
const lessonSlots = [
  ["07:40", "08:05"],
  ["08:05", "09:00"],
  ["09:00", "09:55"],
  ["09:55", "10:50"],
  ["11:15", "12:10"],
  ["12:10", "13:05"],
  ["13:50", "14:45"],
  ["14:45", "15:40"],
] as const;

const emptyEntry = (): SchoolTimetableEntry => ({
  id: crypto.randomUUID(),
  day: "Monday",
  subject: "",
  startTime: "08:00",
  endTime: "08:50",
  room: "",
  teacher: "",
  type: "Lesson",
  notes: "",
});

type WeekView = "all" | "week1" | "week2";
type PdfTextItem = { str?: string; transform?: number[]; width?: number };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (data: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (page: number) => Promise<{
        getTextContent: () => Promise<{ items: PdfTextItem[] }>;
      }>;
    }>;
  };
};

const PDFJS_VERSION = "3.11.174";

function pdfWindow() {
  return window as unknown as { pdfjsLib?: PdfJs };
}

async function loadPdfJs(): Promise<PdfJs> {
  const browser = pdfWindow();
  if (browser.pdfjsLib) return browser.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-mstudy-pdfjs]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("PDF reader failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    script.async = true;
    script.dataset.mstudyPdfjs = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PDF reader failed to load."));
    document.head.appendChild(script);
  });

  const loaded = pdfWindow().pdfjsLib;
  if (!loaded) throw new Error("PDF reader did not initialise.");
  loaded.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  return loaded;
}

function splitCells(line: string) {
  return line.split("|").map(part => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function cleanSubject(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isTime(value: string) {
  return /^\d{1,2}:\d{2}$/.test(value.trim());
}

function looksLikeRoom(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return /^(?:[A-Z]{1,4}\s*\d{1,4}(?:\s*\d+)?[A-Z]?|SH\s*\d{1,3})$/i.test(clean);
}

function splitTeachers(line: string) {
  const piped = splitCells(line);
  if (piped.length >= 8) return piped.slice(0, 8);
  const byTitle = line
    .split(/(?=\b(?:Mr|Mrs|Ms|Miss|Dr)\s+)/)
    .map(part => part.replace(/^\s*\|?\s*/, "").trim())
    .filter(Boolean);
  return byTitle.length >= 8 ? byTitle.slice(0, 8) : piped;
}

function makeEntry(day: string, index: number, subject: string, room = "", teacher = "") {
  const [startTime, endTime] = lessonSlots[index];
  const clean = cleanSubject(subject);
  return {
    id: crypto.randomUUID(),
    day,
    subject: clean,
    startTime,
    endTime,
    room: room.trim(),
    teacher: teacher.trim(),
    type: /break|lunch|registration|assembly/i.test(clean) ? "Activity" : "Lesson",
    notes: "Imported from SES PDF",
  } satisfies SchoolTimetableEntry;
}

function parseSesRowLayout(lines: string[]) {
  const result: SchoolTimetableEntry[] = [];

  for (const day of days) {
    const dayIndex = lines.findIndex(line => line.trim().toLowerCase() === day.toLowerCase());
    if (dayIndex < 0) continue;

    const nextDayIndexes = days
      .map(other => lines.findIndex((line, index) => index > dayIndex && line.trim().toLowerCase() === other.toLowerCase()))
      .filter(index => index > dayIndex);
    const endIndex = nextDayIndexes.length ? Math.min(...nextDayIndexes) : lines.length;
    const block = lines.slice(dayIndex + 1, endIndex);

    const lessonLineIndex = block.findIndex(line => /Lesson\s*1/i.test(line) && /Lesson\s*8/i.test(line));
    if (lessonLineIndex < 0) continue;

    const subjectLine = block[lessonLineIndex + 2] || "";
    const roomLine = block[lessonLineIndex + 3] || "";
    const teacherLine = block[lessonLineIndex + 4] || "";

    const subjects = splitCells(subjectLine);
    const rooms = splitCells(roomLine);
    const teachers = splitTeachers(teacherLine);

    if (subjects.length < 4) continue;

    subjects.slice(0, 8).forEach((subject, index) => {
      if (!subject || index >= lessonSlots.length) return;
      result.push(makeEntry(day, index, subject, rooms[index] || "", teachers[index] || ""));
    });
  }

  return result;
}

function parseSesColumnLayout(lines: string[]) {
  const headerIndex = lines.findIndex(line => /Monday/i.test(line) && /Tuesday/i.test(line) && /Wednesday/i.test(line) && /Thursday/i.test(line));
  if (headerIndex < 0) return [];

  const headerDays = splitCells(lines[headerIndex]).filter(value => days.includes(value));
  const supportedDays = headerDays.slice(0, 4);
  if (supportedDays.length < 4) return [];

  const columns = supportedDays.map(() => [] as string[]);

  for (const line of lines.slice(headerIndex + 1)) {
    if (/Week\s*(?:Two|2)/i.test(line)) break;
    const cells = splitCells(line);
    if (cells.length < supportedDays.length) continue;
    supportedDays.forEach((_, index) => {
      if (cells[index]) columns[index].push(cells[index]);
    });
  }

  const result: SchoolTimetableEntry[] = [];

  columns.forEach((tokens, dayIndex) => {
    let cursor = 0;
    lessonSlots.forEach(([startTime, endTime], lessonIndex) => {
      let startIndex = -1;
      for (let index = cursor; index < tokens.length; index++) {
        if (tokens[index] !== startTime) continue;
        const previous = tokens[index - 1] || "";
        if (looksLikeRoom(previous)) {
          startIndex = index;
          break;
        }
      }
      if (startIndex < 0) return;

      let endIndex = -1;
      for (let index = startIndex + 1; index <= Math.min(tokens.length - 1, startIndex + 4); index++) {
        if (tokens[index] === endTime) {
          endIndex = index;
          break;
        }
      }
      if (endIndex < 0) return;

      let subject = "";
      for (let index = endIndex + 1; index <= Math.min(tokens.length - 1, endIndex + 3); index++) {
        const candidate = tokens[index];
        if (!candidate || isTime(candidate) || /^\d+$/.test(candidate)) continue;
        subject = candidate;
        break;
      }
      if (!subject) return;

      result.push(makeEntry(supportedDays[dayIndex], lessonIndex, subject, tokens[startIndex - 1] || "", ""));
      cursor = endIndex + 1;
    });
  });

  return result;
}

function parseSesTimetablePage(lines: string[]) {
  const rowLayout = parseSesRowLayout(lines);
  if (rowLayout.length >= 8) return rowLayout;
  return parseSesColumnLayout(lines);
}

async function extractPdfPages(file: File) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[][] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const positioned = content.items
      .filter((item: PdfTextItem) => item.str?.trim() && Array.isArray(item.transform))
      .map((item: PdfTextItem) => ({
        text: item.str!.trim(),
        x: item.transform![4] || 0,
        y: item.transform![5] || 0,
        width: item.width || 0,
      }))
      .sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);

    const rows: Array<{ y: number; items: typeof positioned }> = [];
    for (const item of positioned) {
      const row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 3);
      if (row) row.items.push(item);
      else rows.push({ y: item.y, items: [item] });
    }

    rows.sort((a, b) => b.y - a.y);
    const lines: string[] = [];
    for (const row of rows) {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      let text = "";
      let previousEnd = 0;
      sorted.forEach((item, index) => {
        const gap = index === 0 ? 0 : item.x - previousEnd;
        text += `${index === 0 ? "" : gap > 22 ? " | " : " "}${item.text}`;
        previousEnd = item.x + item.width;
      });
      if (text.trim()) lines.push(text.trim());
    }
    pages.push(lines);
  }

  return pages;
}

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
  const [pdfImporting, setPdfImporting] = useState(false);

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
  const sortedEntries = useMemo(() => [...entries].sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day) || a.startTime.localeCompare(b.startTime)), [entries]);

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

  async function importPdf(file?: File) {
    if (!file || !house) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Please choose a PDF timetable.");
      return;
    }

    const hasExisting = allEntries.length > 0 || week1Entries.length > 0 || week2Entries.length > 0;
    if (hasExisting && !window.confirm(`Importing ${file.name} may replace the timetable data currently loaded for this class and house. Continue?`)) return;

    setPdfImporting(true);
    setStatus(`Reading ${file.name}…`);
    try {
      const pages = await extractPdfPages(file);
      const parsed = pages.map(lines => ({
        lines,
        entries: parseSesTimetablePage(lines),
        text: lines.join(" "),
      }));

      const weekOne = parsed.find(page => /Week\s*(?:One|1)\b/i.test(page.text));
      const weekTwo = parsed.find(page => /Week\s*(?:Two|2)\b/i.test(page.text));

      if (weekOne?.entries.length && weekTwo?.entries.length) {
        setMode("separate");
        setWeek1Entries(weekOne.entries);
        setWeek2Entries(weekTwo.entries);
        setWeekView("week1");
        setStatus(`Imported both SES timetable weeks from ${file.name}: ${weekOne.entries.length} Week 1 items and ${weekTwo.entries.length} Week 2 items. Review them, then Save draft or Publish timetable.`);
        return;
      }

      if (weekOne?.entries.length) {
        setMode("separate");
        setWeek1Entries(weekOne.entries);
        setWeekView("week1");
        setStatus(`Imported ${weekOne.entries.length} Week 1 timetable items from ${file.name}. Review them before publishing.`);
        return;
      }

      if (weekTwo?.entries.length) {
        setMode("separate");
        setWeek2Entries(weekTwo.entries);
        setWeekView("week2");
        setStatus(`Imported ${weekTwo.entries.length} Week 2 timetable items from ${file.name}. Review them before publishing.`);
        return;
      }

      const fallback = parsed.flatMap(page => page.entries);
      if (!fallback.length) {
        setStatus("MStudy could read the PDF, but it did not match the SES timetable layouts this importer is based on. Nothing was changed.");
        return;
      }

      setEntries(fallback);
      setStatus(`Imported ${fallback.length} timetable items from ${file.name}. Please review them before publishing.`);
    } catch (error) {
      setStatus(error instanceof Error ? `PDF import failed: ${error.message}` : "PDF import failed. Nothing was changed.");
    } finally {
      setPdfImporting(false);
    }
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
      <div className="section-row"><div><h2 className="section-title">Master timetable</h2><p className="section-help">Editing {year?.label || "—"} → {schoolClass?.label || "—"} → {house?.label || "—"}. Save drafts safely, then publish when ready.</p></div><div className="form-actions"><label className="secondary-button" aria-disabled={!house || pdfImporting} style={{ opacity: !house || pdfImporting ? .55 : 1, cursor: !house || pdfImporting ? "not-allowed" : "pointer" }}><FileUp size={17}/>{pdfImporting ? "Importing PDF…" : "Import PDF"}<input type="file" accept="application/pdf,.pdf" hidden disabled={!house || pdfImporting} onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ""; void importPdf(file); }}/></label><button className="primary-button" onClick={() => setEntries(current => [...current, emptyEntry()])} disabled={!house}><Plus size={17}/> Add item</button></div></div>

      {!house ? <div className="school-empty">Choose or create a valid class and house before editing a timetable.</div> : <>
      <div className="notice" style={{ marginTop: 14 }}><strong>SES PDF importer:</strong> this is tuned to the two SES timetable layouts you supplied, including the horizontal day-row layout and the older day-column layout. If a PDF contains both Week One and Week Two, MStudy imports both automatically into Separate Weeks mode. Nothing is published until you review it.</div>
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
      {entries.length === 0 ? <div className="empty-state"><strong>No timetable items yet</strong><span>Add the first lesson, break or activity for {mode === "separate" ? (weekView === "week1" ? "Week 1" : "Week 2") : "All Weeks"}, or import an SES PDF.</span></div> : null}
      <div className="form-actions"><button className="text-button" onClick={saveDraft}><Save size={15}/> Save draft</button><button className="primary-button" onClick={publish}><Upload size={16}/> Publish timetable</button></div>
      </>}
    </section>
  </section>;
}
