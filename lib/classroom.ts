"use client";

import { GoogleAuthProvider, reauthenticateWithPopup, type User } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
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

type CoursesResponse = { courses?: ClassroomCourse[]; nextPageToken?: string };
type WorkResponse = { courseWork?: ClassroomAssignment[]; nextPageToken?: string };

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
  const work: ClassroomAssignment[] = [];
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

function dueDate(value?: { year?: number; month?: number; day?: number }) {
  if (!value?.year || !value.month || !value.day) return "";
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

export async function syncClassroom(user: User) {
  const result = await reauthenticateWithPopup(user, provider());
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) throw new Error("Google did not return Classroom access. Try connecting again.");

  const courses = await allCourses(token);
  const assignments = (await Promise.all(courses.map(async course => {
    const items = await allWork(course.id, token);
    return items.map((item: any) => ({
      id: item.id,
      courseId: course.id,
      title: item.title,
      description: item.description || "",
      alternateLink: item.alternateLink || "",
      dueDate: dueDate(item.dueDate),
      dueTime: item.dueTime ? `${String(item.dueTime.hours || 0).padStart(2,"0")}:${String(item.dueTime.minutes || 0).padStart(2,"0")}` : "",
      state: item.state || "",
    } satisfies ClassroomAssignment));
  }))).flat();

  const courseRef = collection(db, "users", user.uid, "classroomCourses");
  const assignmentRef = collection(db, "users", user.uid, "classroomAssignments");
  const [oldCourses, oldAssignments] = await Promise.all([getDocs(courseRef), getDocs(assignmentRef)]);

  const cleanup = writeBatch(db);
  oldCourses.docs.forEach(d => cleanup.delete(d.ref));
  oldAssignments.docs.forEach(d => cleanup.delete(d.ref));
  await cleanup.commit();

  const batch = writeBatch(db);
  courses.forEach(course => batch.set(doc(courseRef, course.id), course));
  assignments.forEach(item => batch.set(doc(assignmentRef, `${item.courseId}_${item.id}`), item));
  batch.set(doc(db, "users", user.uid), {
    classroomConnected: true,
    classroomLastSync: serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  return { courses, assignments };
}

export async function disconnectClassroom(user: User) {
  const [courses, assignments] = await Promise.all([
    getDocs(collection(db, "users", user.uid, "classroomCourses")),
    getDocs(collection(db, "users", user.uid, "classroomAssignments")),
  ]);
  await Promise.all([...courses.docs, ...assignments.docs].map(d => deleteDoc(d.ref)));
  await setDoc(doc(db, "users", user.uid), { classroomConnected: false, classroomLastSync: null }, { merge: true });
}
