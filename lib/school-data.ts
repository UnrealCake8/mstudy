import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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
export type SchoolTimetable = {
  id: string;
  schoolId: string;
  yearId: string;
  classId: string;
  houseId: string;
  draftEntries: SchoolTimetableEntry[];
  publishedEntries: SchoolTimetableEntry[];
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
  return onSnapshot(doc(db, "schools", schoolId), snap => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as SchoolConfig) : null));
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

export async function saveDraftTimetable(selection: SchoolSelection, entries: SchoolTimetableEntry[]) {
  await setDoc(doc(db, "schoolTimetables", timetableId(selection)), {
    ...selection,
    draftEntries: entries,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function publishTimetable(selection: SchoolSelection, entries: SchoolTimetableEntry[]) {
  await setDoc(doc(db, "schoolTimetables", timetableId(selection)), {
    ...selection,
    draftEntries: entries,
    publishedEntries: entries,
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
