import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Homework = { id: string; title: string; subject: string; dueDate: string; completed: boolean; priority: "low"|"medium"|"high"; createdAt?: unknown };
export type Note = { id: string; title: string; subject: string; content: string; updatedAt?: unknown };
export type EventItem = { id: string; title: string; date: string; details: string; createdAt?: unknown };
export type TimetableClass = { id: string; subject: string; day: string; startTime: string; endTime: string; room: string; teacher: string; createdAt?: unknown };

function userCollection(uid: string, name: string) { return collection(db, "users", uid, name); }

export function subscribeCollection<T>(uid: string, name: string, callback: (items: T[]) => void, options?: { orderByCreatedAt?: boolean }) {
  const ref = userCollection(uid, name);
  const source = options?.orderByCreatedAt === false ? ref : query(ref, orderBy("createdAt", "desc"));
  return onSnapshot(source, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as T))));
}

export async function addItem(uid: string, name: string, value: Record<string, unknown>) { return addDoc(userCollection(uid, name), { ...value, createdAt: serverTimestamp() }); }
export async function updateItem(uid: string, name: string, id: string, value: Record<string, unknown>) { return updateDoc(doc(db,"users",uid,name,id), value); }
export async function deleteItem(uid: string, name: string, id: string) { return deleteDoc(doc(db,"users",uid,name,id)); }
