"use client";

import { GoogleAuthProvider, reauthenticateWithPopup, type User } from "firebase/auth";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ClassroomAssignment, ClassroomMaterial, ClassroomResource } from "@/lib/classroom";

declare global {
  interface Window {
    gapi?: { load: (name: string, callback: () => void) => void };
    google?: any;
  }
}

type PickedFile = { id: string; name: string; mimeType?: string; url?: string };

type AuthorizationResult = {
  fileName: string;
  matched: boolean;
  readable: boolean;
  source: "assignment" | "resource" | null;
};

function pickerConfig() {
  const developerKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  if (!developerKey || !appId) {
    throw new Error("Google Picker is not configured yet. Add the Picker API key and Cloud project number in Vercel.");
  }
  return { developerKey, appId };
}

function loadPickerApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Picker only works in the browser."));
  if (window.google?.picker) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const loadPicker = () => {
      if (!window.gapi) return reject(new Error("Google Picker could not start."));
      window.gapi.load("picker", () => resolve());
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-mstudy-google-picker="true"]');
    if (existing) {
      if (window.gapi) loadPicker();
      else existing.addEventListener("load", loadPicker, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.mstudyGooglePicker = "true";
    script.onload = loadPicker;
    script.onerror = () => reject(new Error("Google Picker could not be loaded."));
    document.head.appendChild(script);
  });
}

async function driveToken(user: User) {
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  provider.setCustomParameters({ prompt: "consent", include_granted_scopes: "true" });
  const result = await reauthenticateWithPopup(user, provider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error("Google did not return Drive access. Try again.");
  return token;
}

async function pickFile(token: string): Promise<PickedFile> {
  await loadPickerApi();
  const { developerKey, appId } = pickerConfig();
  const google = window.google;

  return new Promise<PickedFile>((resolve, reject) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    view.setIncludeFolders(false);
    view.setSelectFolderEnabled(false);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(developerKey)
      .setAppId(appId)
      .setOrigin(window.location.origin)
      .setTitle("Choose the Classroom file to use")
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.CANCEL) {
          reject(new Error("File selection was cancelled."));
          return;
        }
        if (data.action !== google.picker.Action.PICKED) return;
        const picked = data[google.picker.Response.DOCUMENTS]?.[0];
        const id = picked?.[google.picker.Document.ID];
        if (!id) return reject(new Error("Google Picker did not return a file."));
        resolve({
          id,
          name: picked?.[google.picker.Document.NAME] || "Drive file",
          mimeType: picked?.[google.picker.Document.MIME_TYPE],
          url: picked?.[google.picker.Document.URL],
        });
      })
      .build();

    picker.setVisible(true);
  });
}

async function readSelectedFile(file: PickedFile, token: string): Promise<ClassroomMaterial> {
  const headers = { Authorization: `Bearer ${token}` };
  const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`, { headers });
  if (!metaResponse.ok) throw new Error("MStudy could not open that Drive file.");
  const meta = await metaResponse.json() as { id?: string; name?: string; mimeType?: string; webViewLink?: string };
  const mimeType = meta.mimeType || file.mimeType || "";
  const material: ClassroomMaterial = {
    type: "drive",
    id: file.id,
    title: meta.name || file.name,
    url: meta.webViewLink || file.url,
    mimeType,
  };

  let textResponse: Response | null = null;
  if (mimeType === "application/vnd.google-apps.document" || mimeType === "application/vnd.google-apps.presentation") {
    textResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent("text/plain")}`, { headers });
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    textResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent("text/csv")}`, { headers });
  } else if (["text/plain", "text/markdown", "text/csv", "application/json"].includes(mimeType)) {
    textResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, { headers });
  }

  if (textResponse?.ok) {
    const text = (await textResponse.text()).replace(/\u0000/g, "").trim();
    if (text) material.extractedText = text.slice(0, 40000);
  }
  return material;
}

function replaceMaterial(materials: ClassroomMaterial[] | undefined, selected: ClassroomMaterial) {
  let matched = false;
  const next = (materials || []).map(material => {
    if (!material.id || material.id !== selected.id) return material;
    matched = true;
    return { ...material, ...selected };
  });
  return { matched, materials: next };
}

export async function authorizeClassroomDriveFile(user: User): Promise<AuthorizationResult> {
  const token = await driveToken(user);
  const picked = await pickFile(token);
  const selected = await readSelectedFile(picked, token);

  const [assignments, resources] = await Promise.all([
    getDocs(collection(db, "users", user.uid, "classroomAssignments")),
    getDocs(collection(db, "users", user.uid, "classroomResources")),
  ]);

  for (const snapshot of assignments.docs) {
    const item = snapshot.data() as ClassroomAssignment;
    const updated = replaceMaterial(item.materials, selected);
    if (!updated.matched) continue;
    await setDoc(doc(db, "users", user.uid, "classroomAssignments", snapshot.id), { materials: updated.materials }, { merge: true });
    return { fileName: selected.title, matched: true, readable: Boolean(selected.extractedText), source: "assignment" };
  }

  for (const snapshot of resources.docs) {
    const item = snapshot.data() as ClassroomResource;
    const updated = replaceMaterial(item.materials, selected);
    if (!updated.matched) continue;
    await setDoc(doc(db, "users", user.uid, "classroomResources", snapshot.id), { materials: updated.materials }, { merge: true });
    return { fileName: selected.title, matched: true, readable: Boolean(selected.extractedText), source: "resource" };
  }

  return { fileName: selected.title, matched: false, readable: Boolean(selected.extractedText), source: null };
}
