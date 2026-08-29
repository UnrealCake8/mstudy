import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type MasterCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  source?: "manual" | "ics";
  createdAt?: Timestamp;
};

const eventsRef = collection(db, "masterCalendarEvents");

export function subscribeMasterCalendar(callback: (events: MasterCalendarEvent[]) => void) {
  return onSnapshot(query(eventsRef, orderBy("start", "asc")), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as MasterCalendarEvent)));
  });
}

export async function addMasterCalendarEvent(event: Omit<MasterCalendarEvent, "id" | "createdAt">) {
  await addDoc(eventsRef, { ...event, createdAt: serverTimestamp() });
}

export async function deleteMasterCalendarEvent(id: string) {
  await deleteDoc(doc(db, "masterCalendarEvents", id));
}

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsDate(raw: string) {
  const value = raw.trim();
  if (/^\d{8}$/.test(value)) return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return value;
  const [, y, m, d, hh, mm, ss = "00", z] = match;
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${z ? "Z" : ""}`;
}

export function parseIcsEvents(text: string): Omit<MasterCalendarEvent, "id" | "createdAt">[] {
  const unfolded = unfoldIcs(text);
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  return blocks.flatMap(block => {
    const lines = block.split(/\r?\n/);
    const field = (name: string) => {
      const line = lines.find(item => item.toUpperCase().startsWith(`${name}:`) || item.toUpperCase().startsWith(`${name};`));
      return line ? line.slice(line.indexOf(":") + 1) : "";
    };
    const title = unescapeIcs(field("SUMMARY"));
    const rawStart = field("DTSTART");
    if (!title || !rawStart) return [];
    const rawEnd = field("DTEND");
    return [{
      title,
      start: parseIcsDate(rawStart),
      end: rawEnd ? parseIcsDate(rawEnd) : "",
      allDay: /^\d{8}$/.test(rawStart.trim()),
      location: unescapeIcs(field("LOCATION")),
      description: unescapeIcs(field("DESCRIPTION")),
      source: "ics" as const,
    }];
  });
}
