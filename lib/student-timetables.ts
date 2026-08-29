import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
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
  emailLower?: string;
  assignedTimetableId?: string;
  assignedTimetableLabel?: string;
};

export function subscribeSchoolTimetables(callback: (items: SchoolTimetable[]) => void) {
  return onSnapshot(query(collection(db, "schoolTimetables"), orderBy("label", "asc")), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Record<string, unknown>) } as SchoolTimetable)));
  });
}

export function subscribeStudentProfile(uid: string, callback: (profile: StudentProfile | null) => void) {
  return onSnapshot(doc(db, "users", uid), snapshot => callback(snapshot.exists() ? ({ uid: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as StudentProfile) : null));
}

function profileFromSnapshot(snapshot: Awaited<ReturnType<typeof getDocs>>) {
  const first = snapshot.docs[0];
  return first ? ({ uid: first.id, ...(first.data() as Record<string, unknown>) } as StudentProfile) : null;
}

export async function findStudentByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const normalizedResult = await getDocs(query(collection(db, "users"), where("emailLower", "==", normalized), limit(1)));
  const normalizedProfile = profileFromSnapshot(normalizedResult);
  if (normalizedProfile) return normalizedProfile;

  // Backwards compatibility for accounts created before emailLower was added.
  const exactResult = await getDocs(query(collection(db, "users"), where("email", "==", email.trim()), limit(1)));
  return profileFromSnapshot(exactResult);
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
