import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type House = { id: string; label: string };
export type SchoolClass = { id: string; label: string; houses: House[] };
export type SchoolYear = { id: string; label: string; classes: SchoolClass[] };
export type RoomPrefix = { prefix: string; building: string };
export type SchoolConfig = {
  id: string;
  name: string;
  domains: string[];
  years: SchoolYear[];
  roomPrefixes: RoomPrefix[];
};
export type SchoolSelection = { schoolId: string; yearId: string; classId: string; houseId: string };
export type SchoolTimetableEntry = {
  id: string;
  day: string;
  subject: string;
  startTime: string;
  endTime: string;
  room: string;
  teacher: string;
  type?: string;
  notes?: string;
};
export type TimetableMode = "all" | "separate";
export type SchoolTimetable = {
  id: string;
  schoolId: string;
  yearId: string;
  classId: string;
  houseId: string;
  mode?: TimetableMode;
  draftEntries: SchoolTimetableEntry[];
  publishedEntries: SchoolTimetableEntry[];
  draftWeek1Entries?: SchoolTimetableEntry[];
  draftWeek2Entries?: SchoolTimetableEntry[];
  publishedWeek1Entries?: SchoolTimetableEntry[];
  publishedWeek2Entries?: SchoolTimetableEntry[];
  updatedAt?: unknown;
  publishedAt?: unknown;
};

export const SES_ID = "ses";
export const SES_DOMAIN = "ses-students.org";
export const DEFAULT_SES: SchoolConfig = {
  id: SES_ID,
  name: "Sharjah English School",
  domains: [SES_DOMAIN],
  years: [{
    id: "year8",
    label: "Year 8",
    classes: [{
      id: "8g",
      label: "8G",
      houses: ["Falcons", "Foxes", "Geckos", "Lynxes", "Stingrays"].map(label => ({ id: label.toLowerCase(), label })),
    }],
  }],
  roomPrefixes: [
    { prefix: "A", building: "Arts Building" },
    { prefix: "S", building: "Secondary Building" },
    { prefix: "P", building: "Primary Building" },
  ],
};

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSchoolConfig(id: string, raw: Record<string, unknown>): SchoolConfig {
  const yearsRaw = Array.isArray(raw.years) ? raw.years : [];
  const years: SchoolYear[] = yearsRaw.flatMap((year): SchoolYear[] => {
    if (!year || typeof year !== "object") return [];
    const y = year as Record<string, unknown>;
    const yearId = cleanString(y.id);
    if (!yearId) return [];
    const classesRaw = Array.isArray(y.classes) ? y.classes : [];
    const classes: SchoolClass[] = classesRaw.flatMap((schoolClass): SchoolClass[] => {
      if (!schoolClass || typeof schoolClass !== "object") return [];
      const c = schoolClass as Record<string, unknown>;
      const classId = cleanString(c.id);
      if (!classId) return [];
      const housesRaw = Array.isArray(c.houses) ? c.houses : [];
      const houses: House[] = housesRaw.flatMap((house): House[] => {
        if (!house || typeof house !== "object") return [];
        const h = house as Record<string, unknown>;
        const houseId = cleanString(h.id);
        if (!houseId) return [];
        return [{ id: houseId, label: cleanString(h.label, houseId) }];
      });
      return [{ id: classId, label: cleanString(c.label, classId.toUpperCase()), houses }];
    });
    return [{ id: yearId, label: cleanString(y.label, yearId), classes }];
  });

  const prefixesRaw = Array.isArray(raw.roomPrefixes) ? raw.roomPrefixes : [];
  const roomPrefixes: RoomPrefix[] = prefixesRaw.flatMap((item): RoomPrefix[] => {
    if (!item || typeof item !== "object") return [];
    const p = item as Record<string, unknown>;
    const prefix = cleanString(p.prefix).toUpperCase();
    const building = cleanString(p.building);
    return prefix && building ? [{ prefix, building }] : [];
  });

  return {
    id,
    name: cleanString(raw.name, id === SES_ID ? DEFAULT_SES.name : id),
    domains: Array.isArray(raw.domains) ? raw.domains.filter((v): v is string => typeof v === "string" && Boolean(v.trim())).map(v => v.trim()) : [],
    years,
    roomPrefixes,
  };
}

export function firstValidSelection(config: SchoolConfig): SchoolSelection | null {
  for (const year of config.years) {
    for (const schoolClass of year.classes) {
      const house = schoolClass.houses[0];
      if (house) return { schoolId: config.id, yearId: year.id, classId: schoolClass.id, houseId: house.id };
    }
  }
  return null;
}

export function resolveSelection(config: SchoolConfig, selection?: SchoolSelection | null): SchoolSelection | null {
  if (!selection) return firstValidSelection(config);
  const year = config.years.find(item => item.id === selection.yearId);
  const schoolClass = year?.classes.find(item => item.id === selection.classId);
  const house = schoolClass?.houses.find(item => item.id === selection.houseId);
  if (year && schoolClass && house) return { schoolId: config.id, yearId: year.id, classId: schoolClass.id, houseId: house.id };
  return firstValidSelection(config);
}

export function timetableId(selection: SchoolSelection) {
  return [selection.schoolId, selection.yearId, selection.classId, selection.houseId].join("_");
}

export function isSesStudent(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith(`@${SES_DOMAIN}`));
}

export async function isAdmin(uid: string) {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists();
}

export function subscribeSchoolConfig(schoolId: string, callback: (value: SchoolConfig | null) => void) {
  return onSnapshot(doc(db, "schools", schoolId), snap => callback(snap.exists() ? normalizeSchoolConfig(snap.id, snap.data()) : null));
}

export async function saveSchoolConfig(config: SchoolConfig) {
  const { id, ...payload } = config;
  await setDoc(doc(db, "schools", id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

export async function seedSesConfig() {
  await saveSchoolConfig(DEFAULT_SES);
}

export function subscribeSchoolSelection(uid: string, callback: (value: SchoolSelection | null) => void) {
  return onSnapshot(doc(db, "users", uid, "school", "profile"), snap => callback(snap.exists() ? (snap.data() as SchoolSelection) : null));
}

export async function saveSchoolSelection(uid: string, selection: SchoolSelection) {
  await setDoc(doc(db, "users", uid, "school", "profile"), selection, { merge: true });
}

export function subscribeTimetable(selection: SchoolSelection, callback: (value: SchoolTimetable | null) => void) {
  return onSnapshot(doc(db, "schoolTimetables", timetableId(selection)), snap => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as SchoolTimetable) : null));
}

export async function saveDraftTimetable(
  selection: SchoolSelection,
  mode: TimetableMode,
  allEntries: SchoolTimetableEntry[],
  week1Entries: SchoolTimetableEntry[],
  week2Entries: SchoolTimetableEntry[],
) {
  await setDoc(doc(db, "schoolTimetables", timetableId(selection)), {
    ...selection,
    mode,
    draftEntries: allEntries,
    draftWeek1Entries: week1Entries,
    draftWeek2Entries: week2Entries,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function publishTimetable(
  selection: SchoolSelection,
  mode: TimetableMode,
  allEntries: SchoolTimetableEntry[],
  week1Entries: SchoolTimetableEntry[],
  week2Entries: SchoolTimetableEntry[],
) {
  await setDoc(doc(db, "schoolTimetables", timetableId(selection)), {
    ...selection,
    mode,
    draftEntries: allEntries,
    publishedEntries: allEntries,
    draftWeek1Entries: week1Entries,
    draftWeek2Entries: week2Entries,
    publishedWeek1Entries: week1Entries,
    publishedWeek2Entries: week2Entries,
    updatedAt: serverTimestamp(),
    publishedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteTimetable(selection: SchoolSelection) {
  await deleteDoc(doc(db, "schoolTimetables", timetableId(selection)));
}

export function roomLocation(code: string, config: SchoolConfig | null) {
  const normalized = code.toUpperCase().replace(/\s+/g, "").trim();
  if (!normalized) return null;
  const match = config?.roomPrefixes.find(item => normalized.startsWith(item.prefix.toUpperCase()));
  if (!match) return { code: normalized, building: "Unknown building", room: normalized };
  const room = normalized.slice(match.prefix.length) || normalized;
  return { code: normalized, building: match.building, room };
}
