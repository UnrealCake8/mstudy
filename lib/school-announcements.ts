"use client";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SchoolAnnouncement = {
  id: string;
  title: string;
  body: string;
  group: string;
  audience: "all" | "secondary" | "house";
  pinned: boolean;
  createdAt?: { toDate?: () => Date } | string;
  createdBy?: string;
};

export type AnnouncementFolder = {
  id: string;
  name: string;
  noticeIds: string[];
};
const announcementsRef = collection(db, "schoolAnnouncements");

export function subscribeSchoolAnnouncements(
  callback: (items: SchoolAnnouncement[]) => void,
) {
  return onSnapshot(
    query(announcementsRef, orderBy("createdAt", "desc")),
    (snapshot) =>
      callback(
        snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as SchoolAnnouncement,
        ),
      ),
  );
}
export async function createSchoolAnnouncement(
  value: Omit<SchoolAnnouncement, "id" | "createdAt">,
) {
  await addDoc(announcementsRef, { ...value, createdAt: serverTimestamp() });
}
export async function updateSchoolAnnouncement(
  id: string,
  value: Partial<SchoolAnnouncement>,
) {
  await updateDoc(doc(db, "schoolAnnouncements", id), value);
}
export async function deleteSchoolAnnouncement(id: string) {
  await deleteDoc(doc(db, "schoolAnnouncements", id));
}

export function subscribeAnnouncementFolders(
  uid: string,
  callback: (items: AnnouncementFolder[]) => void,
) {
  return onSnapshot(
    collection(db, "users", uid, "announcementGroups"),
    (snapshot) =>
      callback(
        snapshot.docs.map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
              noticeIds: Array.isArray(item.data().noticeIds)
                ? item.data().noticeIds
                : [],
            }) as AnnouncementFolder,
        ),
      ),
  );
}
export async function createAnnouncementFolder(uid: string, name: string) {
  await addDoc(collection(db, "users", uid, "announcementGroups"), {
    name,
    noticeIds: [],
    createdAt: serverTimestamp(),
  });
}
export async function deleteAnnouncementFolder(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "announcementGroups", id));
}
export async function addNoticeToFolder(
  uid: string,
  folderId: string,
  noticeId: string,
) {
  await updateDoc(doc(db, "users", uid, "announcementGroups", folderId), {
    noticeIds: arrayUnion(noticeId),
  });
}
export async function removeNoticeFromFolder(
  uid: string,
  folderId: string,
  noticeId: string,
) {
  await updateDoc(doc(db, "users", uid, "announcementGroups", folderId), {
    noticeIds: arrayRemove(noticeId),
  });
}
