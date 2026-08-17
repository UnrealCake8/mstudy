"use client";

import { GoogleAuthProvider, reauthenticateWithPopup, type User } from "firebase/auth";
import { collection, doc, getDocs, serverTimestamp, setDoc, writeBatch, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";

const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
] as const;

export type ClassroomCourse = {
  id: string;
  name: string;
  section?: string;
  alternateLink?: string;
  courseState?: string;
};

export type ClassroomAssignment = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  alternateLink?: string;
  dueDate?: string;
  dueTime?: string;
  state?: string;
};

type ClassroomDate = { year?: number; month?: number; day?: number };
type ClassroomTime = { hours?: number; minutes?: number };
type RawAssignment = Omit<ClassroomAssignment, "courseId" | "dueDate" | "dueTime"> & { dueDate?: ClassroomDate; dueTime?: ClassroomTime };
type CoursesResponse = { courses?: ClassroomCourse[]; nextPageToken?: string };
type WorkResponse = { courseWork?: RawAssignment[]; nextPageToken?: string };
type BatchOp = { ref: DocumentReference; data?: Record<string, unknown>; remove?: boolean };

function provider() {
  const p = new GoogleAuthProvider();
  CLASSROOM_SCOPES.forEach(scope => p.addScope(scope));
  p.setCustomParameters({ prompt: "consent", include_granted_scopes: "true" });
  return p;
}

async function classroomFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://classroom.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Google Classroom request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

async function allCourses(token: string) {
  const courses: ClassroomCourse[] = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ studentId: "me", courseStates: "ACTIVE", pageSize: "100" });
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await classroomFetch<CoursesResponse>(`courses?${qs}`, token);
    courses.push(...(data.courses || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return courses;
}

async function allWork(courseId: string, token: string) {
  const work: RawAssignment[] = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ courseWorkStates: "PUBLISHED", orderBy: "dueDate desc", pageSize: "100" });
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await classroomFetch<WorkResponse>(`courses/${encodeURIComponent(courseId)}/courseWork?${qs}`, token);
    work.push(...(data.courseWork || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return work;
}

function formatDate(value?: ClassroomDate) {
  if (!value?.year || !value.month || !value.day) return "";
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function formatTime(value?: ClassroomTime) {
  if (!value) return "";
  return `${String(value.hours || 0).padStart(2, "0")}:${String(value.minutes || 0).padStart(2, "0")}`;
}

async function commitInChunks(ops: BatchOp[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(op => op.remove ? batch.delete(op.ref) : batch.set(op.ref, op.data || {}));
    await batch.commit();
  }
}

export async function syncClassroom(user: User) {
  const result = await reauthenticateWithPopup(user, provider());
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) throw new Error("Google did not return Classroom access. Try connecting again.");

  const courses = await allCourses(token);
  const assignments = (await Promise.all(courses.map(async course => {
    const items = await allWork(course.id, token);
    return items.map(item => ({
      id: item.id,
      courseId: course.id,
      title: item.title,
      description: item.description || "",
      alternateLink: item.alternateLink || "",
      dueDate: formatDate(item.dueDate),
      dueTime: formatTime(item.dueTime),
      state: item.state || "",
    } satisfies ClassroomAssignment));
  }))).flat();

  const courseRef = collection(db, "users", user.uid, "classroomCourses");
  const assignmentRef = collection(db, "users", user.uid, "classroomAssignments");
  const [oldCourses, oldAssignments] = await Promise.all([getDocs(courseRef), getDocs(assignmentRef)]);

  await commitInChunks([
    ...oldCourses.docs.map(item => ({ ref: item.ref, remove: true })),
    ...oldAssignments.docs.map(item => ({ ref: item.ref, remove: true })),
  ]);

  await commitInChunks([
    ...courses.map(course => ({ ref: doc(courseRef, course.id), data: course as Record<string, unknown> })),
    ...assignments.map(item => ({ ref: doc(assignmentRef, `${item.courseId}_${item.id}`), data: item as Record<string, unknown> })),
  ]);

  await setDoc(doc(db, "users", user.uid), {
    classroomConnected: true,
    classroomLastSync: serverTimestamp(),
  }, { merge: true });

  return { courses, assignments };
}

export async function disconnectClassroom(user: User) {
  const [courses, assignments] = await Promise.all([
    getDocs(collection(db, "users", user.uid, "classroomCourses")),
    getDocs(collection(db, "users", user.uid, "classroomAssignments")),
  ]);
  await commitInChunks([
    ...courses.docs.map(item => ({ ref: item.ref, remove: true })),
    ...assignments.docs.map(item => ({ ref: item.ref, remove: true })),
  ]);
  await setDoc(doc(db, "users", user.uid), { classroomConnected: false, classroomLastSync: null }, { merge: true });
}
