import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SchoolTimetable = {
  id: string;
  label: string;
  pdfUrl: string;
  group?: string;
};

export type StudentProfile = {
  uid: string;
  name: string;
  email: string;
  assignedTimetableId?: string;
  assignedTimetableLabel?: string;
};

export function subscribeSchoolTimetables(callback: (items: SchoolTimetable[]) => void) {
  return onSnapshot(query(collection(db, "schoolTimetables"), orderBy("label", "asc")), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as SchoolTimetable)));
  });
}

export function subscribeStudents(callback: (items: StudentProfile[]) => void) {
  return onSnapshot(query(collection(db, "users"), orderBy("name", "asc")), snapshot => {
    callback(snapshot.docs.map(item => ({ uid: item.id, ...item.data() } as StudentProfile)));
  });
}

export function subscribeStudentProfile(uid: string, callback: (profile: StudentProfile | null) => void) {
  return onSnapshot(doc(db, "users", uid), snapshot => callback(snapshot.exists() ? ({ uid: snapshot.id, ...snapshot.data() } as StudentProfile) : null));
}

export async function saveSchoolTimetable(input: SchoolTimetable) {
  await setDoc(doc(db, "schoolTimetables", input.id), {
    label: input.label,
    pdfUrl: input.pdfUrl,
    group: input.group || "",
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function assignStudentTimetable(studentUid: string, timetable: SchoolTimetable | null) {
  await updateDoc(doc(db, "users", studentUid), timetable ? {
    assignedTimetableId: timetable.id,
    assignedTimetableLabel: timetable.label,
    timetableAssignedAt: serverTimestamp(),
  } : {
    assignedTimetableId: "",
    assignedTimetableLabel: "",
    timetableAssignedAt: serverTimestamp(),
  });
}
