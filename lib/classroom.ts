"use client";

import { GoogleAuthProvider, reauthenticateWithPopup, type User } from "firebase/auth";
import { collection, doc, getDocs, serverTimestamp, setDoc, writeBatch, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";

const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
] as const;

export type ClassroomMaterial = {
  type: "drive" | "link" | "youtube" | "form" | "unknown";
  title: string;
  url?: string;
  id?: string;
  thumbnailUrl?: string;
};

export type ClassroomCourse = {
  id: string;
  name: string;
  section?: string;
  alternateLink?: string;
  courseState?: string;
  role?: "student" | "teacher" | "unknown";
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
  materials?: ClassroomMaterial[];
};

export type ClassroomSyncSummary = {
  googleEmail: string;
  studentCourses: number;
  teacherCourses: number;
  totalCourses: number;
  assignments: number;
};

type ClassroomDate = { year?: number; month?: number; day?: number };
type ClassroomTime = { hours?: number; minutes?: number };
type RawDriveFile = { id?: string; title?: string; alternateLink?: string; thumbnailUrl?: string };
type RawMaterial = {
  driveFile?: { driveFile?: RawDriveFile; shareMode?: string };
  link?: { url?: string; title?: string; thumbnailUrl?: string };
  youtubeVideo?: { id?: string; title?: string; alternateLink?: string; thumbnailUrl?: string };
  form?: { formUrl?: string; title?: string; thumbnailUrl?: string };
};
type RawAssignment = Omit<ClassroomAssignment, "courseId" | "dueDate" | "dueTime" | "materials"> & { dueDate?: ClassroomDate; dueTime?: ClassroomTime; materials?: RawMaterial[] };
type CoursesResponse = { courses?: ClassroomCourse[]; nextPageToken?: string };
type WorkResponse = { courseWork?: RawAssignment[]; nextPageToken?: string };
type Submission = { courseWorkId?: string; state?: string };
type SubmissionsResponse = { studentSubmissions?: Submission[]; nextPageToken?: string };
type BatchOp = { ref: DocumentReference; data?: Record<string, unknown>; remove?: boolean };

function provider() {
  const p = new GoogleAuthProvider();
  CLASSROOM_SCOPES.forEach(scope => p.addScope(scope));
  p.setCustomParameters({ prompt: "consent", include_granted_scopes: "true" });
  return p;
}

function friendlyError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const lower = raw.toLowerCase();
  if (lower.includes("missing or insufficient permissions") || lower.includes("permission-denied")) return new Error("MStudy is signed in, but Firestore is blocking access. Deploy the firestore.rules from this PR in Firebase Console → Firestore Database → Rules, then try again.");
  if (lower.includes("access blocked") || lower.includes("admin_policy_enforced")) return new Error("Your school Google Workspace administrator has blocked MStudy from accessing Google Classroom.");
  if (lower.includes("api has not been used") || lower.includes("classroom.googleapis.com") && lower.includes("disabled")) return new Error("The Google Classroom API is not enabled for the MStudy Google Cloud project yet.");
  return error instanceof Error ? error : new Error("Could not sync Google Classroom.");
}

async function classroomFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://classroom.googleapis.com/v1/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Google Classroom request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function normalizeMaterials(materials?: RawMaterial[]): ClassroomMaterial[] {
  return (materials || []).map((material): ClassroomMaterial | null => {
    const drive = material.driveFile?.driveFile;
    if (drive) return { type: "drive", title: drive.title || "Google Drive material", url: drive.alternateLink, id: drive.id, thumbnailUrl: drive.thumbnailUrl };
    if (material.link) return { type: "link", title: material.link.title || material.link.url || "Link", url: material.link.url, thumbnailUrl: material.link.thumbnailUrl };
    if (material.youtubeVideo) return { type: "youtube", title: material.youtubeVideo.title || "YouTube video", url: material.youtubeVideo.alternateLink, id: material.youtubeVideo.id, thumbnailUrl: material.youtubeVideo.thumbnailUrl };
    if (material.form) return { type: "form", title: material.form.title || "Google Form", url: material.form.formUrl, thumbnailUrl: material.form.thumbnailUrl };
    return null;
  }).filter((item): item is ClassroomMaterial => Boolean(item));
}

async function coursesForRole(token: string, role: "student" | "teacher") {
  const courses: ClassroomCourse[] = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    qs.set(role === "student" ? "studentId" : "teacherId", "me");
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await classroomFetch<CoursesResponse>(`courses?${qs.toString()}`, token);
    courses.push(...(data.courses || []).map(course => ({ ...course, role })));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return courses;
}

async function allCourses(token: string) {
  const [studentResult, teacherResult] = await Promise.allSettled([coursesForRole(token, "student"), coursesForRole(token, "teacher")]);
  const studentCourses = studentResult.status === "fulfilled" ? studentResult.value : [];
  const teacherCourses = teacherResult.status === "fulfilled" ? teacherResult.value : [];
  const merged = new Map<string, ClassroomCourse>();
  [...studentCourses, ...teacherCourses].forEach(course => {
    const existing = merged.get(course.id);
    merged.set(course.id, existing ? { ...existing, role: existing.role === course.role ? existing.role : "unknown" } : course);
  });
  return { courses: [...merged.values()], studentCount: studentCourses.length, teacherCount: teacherCourses.length };
}

async function allWork(courseId: string, token: string) {
  const work: RawAssignment[] = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ orderBy: "dueDate desc", pageSize: "100" });
    qs.append("courseWorkStates", "PUBLISHED");
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await classroomFetch<WorkResponse>(`courses/${encodeURIComponent(courseId)}/courseWork?${qs.toString()}`, token);
    work.push(...(data.courseWork || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return work;
}

async function ownSubmissionStates(courseId: string, token: string) {
  const states = new Map<string, string>();
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ userId: "me", pageSize: "100" });
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await classroomFetch<SubmissionsResponse>(`courses/${encodeURIComponent(courseId)}/courseWork/-/studentSubmissions?${qs.toString()}`, token);
    for (const submission of data.studentSubmissions || []) if (submission.courseWorkId) states.set(submission.courseWorkId, submission.state || "");
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return states;
}

function formatDate(value?: ClassroomDate) {
  if (!value?.year || !value.month || !value.day) return "";
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}
function formatTime(value?: ClassroomTime) { if (!value) return ""; return `${String(value.hours || 0).padStart(2, "0")}:${String(value.minutes || 0).padStart(2, "0")}`; }
function isDoneSubmission(state?: string) { return state === "TURNED_IN" || state === "RETURNED"; }

async function commitInChunks(ops: BatchOp[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(op => op.remove ? batch.delete(op.ref) : batch.set(op.ref, op.data || {}));
    await batch.commit();
  }
}

export async function syncClassroom(user: User) {
  try {
    const result = await reauthenticateWithPopup(user, provider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    if (!token) throw new Error("Google did not return Classroom access. Try connecting again.");
    const googleEmail = result.user.email || user.email || "Unknown Google account";
    const discovered = await allCourses(token);
    const courses = discovered.courses;
    const assignments = (await Promise.all(courses.map(async course => {
      try {
        const [items, submissionStates] = await Promise.all([allWork(course.id, token), course.role === "student" ? ownSubmissionStates(course.id, token).catch(() => new Map<string, string>()) : Promise.resolve(new Map<string, string>())]);
        return items.filter(item => !isDoneSubmission(submissionStates.get(item.id))).map(item => ({
          id: item.id, courseId: course.id, title: item.title, description: item.description || "", alternateLink: item.alternateLink || "", dueDate: formatDate(item.dueDate), dueTime: formatTime(item.dueTime), state: item.state || "", materials: normalizeMaterials(item.materials),
        } satisfies ClassroomAssignment));
      } catch (error) { console.warn(`Could not load coursework for Classroom course ${course.id}`, error); return []; }
    }))).flat();

    const courseRef = collection(db, "users", user.uid, "classroomCourses");
    const assignmentRef = collection(db, "users", user.uid, "classroomAssignments");
    const [oldCourses, oldAssignments] = await Promise.all([getDocs(courseRef), getDocs(assignmentRef)]);
    await commitInChunks([...oldCourses.docs.map(item => ({ ref: item.ref, remove: true })), ...oldAssignments.docs.map(item => ({ ref: item.ref, remove: true }))]);
    await commitInChunks([...courses.map(course => ({ ref: doc(courseRef, course.id), data: course as Record<string, unknown> })), ...assignments.map(item => ({ ref: doc(assignmentRef, `${item.courseId}_${item.id}`), data: item as Record<string, unknown> }))]);
    const summary: ClassroomSyncSummary = { googleEmail, studentCourses: discovered.studentCount, teacherCourses: discovered.teacherCount, totalCourses: courses.length, assignments: assignments.length };
    await setDoc(doc(db, "users", user.uid), { classroomConnected: true, classroomLastSync: serverTimestamp(), classroomSyncSummary: summary }, { merge: true });
    return { courses, assignments, summary };
  } catch (error) { throw friendlyError(error); }
}

export async function disconnectClassroom(user: User) {
  try {
    const [courses, assignments] = await Promise.all([getDocs(collection(db, "users", user.uid, "classroomCourses")), getDocs(collection(db, "users", user.uid, "classroomAssignments"))]);
    await commitInChunks([...courses.docs.map(item => ({ ref: item.ref, remove: true })), ...assignments.docs.map(item => ({ ref: item.ref, remove: true }))]);
    await setDoc(doc(db, "users", user.uid), { classroomConnected: false, classroomLastSync: null, classroomSyncSummary: null }, { merge: true });
  } catch (error) { throw friendlyError(error); }
}
