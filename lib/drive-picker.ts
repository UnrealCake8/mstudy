"use client";

import { GoogleAuthProvider, reauthenticateWithPopup, type User } from "firebase/auth";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ClassroomAssignment, ClassroomMaterial, ClassroomResource } from "@/lib/classroom";

declare global {
  interface Window {
    gapi?: { load: (name: string, callback: () => void) => void };
    google?: any;
    pdfjsLib?: any;
    Tesseract?: any;
  }
}

type PickedFile = { id: string; name: string; mimeType?: string; url?: string };
type AuthorizationResult = { fileName: string; matched: boolean; readable: boolean; source: "assignment" | "resource" | "drive" | null };

const PICKER_MIME_TYPES = [
  "application/pdf",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.spreadsheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",");

function pickerConfig() {
  const developerKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  if (!developerKey || !appId) throw new Error("Google Picker is not configured yet. Add the Picker API key and Cloud project number in Vercel.");
  return { developerKey, appId };
}

function loadScript(selector: string, src: string, marker: string, ready: () => boolean, onReady: () => void, errorMessage: string) {
  if (ready()) { onReady(); return; }
  const existing = document.querySelector<HTMLScriptElement>(selector);
  if (existing) { existing.addEventListener("load", onReady, { once: true }); return; }
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  script.dataset[marker] = "true";
  script.onload = onReady;
  script.onerror = () => { throw new Error(errorMessage); };
  document.head.appendChild(script);
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
    if (existing) { if (window.gapi) loadPicker(); else existing.addEventListener("load", loadPicker, { once: true }); return; }
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

function loadPdfJs() {
  if (typeof window === "undefined") return Promise.reject(new Error("PDF reading only works in the browser."));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise<any>((resolve, reject) => {
    const ready = () => {
      if (!window.pdfjsLib) return reject(new Error("PDF reader could not start."));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-mstudy-pdfjs="true"]');
    if (existing) { if (window.pdfjsLib) ready(); else existing.addEventListener("load", ready, { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.defer = true;
    script.dataset.mstudyPdfjs = "true";
    script.onload = ready;
    script.onerror = () => reject(new Error("MStudy could not load its PDF reader."));
    document.head.appendChild(script);
  });
}

function loadTesseract() {
  if (typeof window === "undefined") return Promise.reject(new Error("OCR only works in the browser."));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise<any>((resolve, reject) => {
    const ready = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error("OCR reader could not start."));
    const existing = document.querySelector<HTMLScriptElement>('script[data-mstudy-tesseract="true"]');
    if (existing) { if (window.Tesseract) ready(); else existing.addEventListener("load", ready, { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.defer = true;
    script.dataset.mstudyTesseract = "true";
    script.onload = ready;
    script.onerror = () => reject(new Error("MStudy could not load its OCR reader."));
    document.head.appendChild(script);
  });
}

async function ocrImageSource(source: Blob | HTMLCanvasElement) {
  const Tesseract = await loadTesseract();
  const result = await Tesseract.recognize(source, "eng", { logger: () => {} });
  return String(result?.data?.text || "").replace(/\s+/g, " ").trim();
}

async function extractPdfText(buffer: ArrayBuffer) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const chunks: string[] = [];
  const pageLimit = Math.min(pdf.numPages, 80);

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items.map((item: any) => typeof item?.str === "string" ? item.str : "").filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (line) chunks.push(line);
    if (chunks.join("\n\n").length >= 40000) break;
  }

  const normalText = chunks.join("\n\n").slice(0, 40000).trim();
  if (normalText.length >= 120) return { text: normalText, usedOcr: false };

  const ocrChunks: string[] = [];
  const ocrPageLimit = Math.min(pdf.numPages, 8);
  for (let pageNumber = 1; pageNumber <= ocrPageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const text = await ocrImageSource(canvas);
    if (text) ocrChunks.push(text);
    canvas.width = 1;
    canvas.height = 1;
    if (ocrChunks.join("\n\n").length >= 40000) break;
  }
  return { text: ocrChunks.join("\n\n").slice(0, 40000).trim(), usedOcr: true };
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
    view.setMimeTypes(PICKER_MIME_TYPES);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(developerKey)
      .setAppId(appId)
      .setOrigin(window.location.origin)
      .setTitle("Choose a study file from Drive")
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.CANCEL) return reject(new Error("File selection was cancelled."));
        if (data.action !== google.picker.Action.PICKED) return;
        const picked = data[google.picker.Response.DOCUMENTS]?.[0];
        const id = picked?.[google.picker.Document.ID];
        if (!id) return reject(new Error("Google Picker did not return a file."));
        resolve({ id, name: picked?.[google.picker.Document.NAME] || "Drive file", mimeType: picked?.[google.picker.Document.MIME_TYPE] || "", url: picked?.[google.picker.Document.URL] });
      }).build();
    picker.setVisible(true);
  });
}

async function googleError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
  return [body?.error?.message, body?.error?.errors?.[0]?.reason].filter(Boolean).join(" · ") || `Google Drive returned ${response.status}.`;
}

async function readSelectedFile(file: PickedFile, token: string): Promise<ClassroomMaterial> {
  const headers = { Authorization: `Bearer ${token}` };
  let meta: { id?: string; name?: string; mimeType?: string; webViewLink?: string; size?: string } = {};
  const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?fields=id,name,mimeType,webViewLink,size&supportsAllDrives=true`, { headers });
  if (metaResponse.ok) meta = await metaResponse.json();
  const mimeType = meta.mimeType || file.mimeType || "";
  const material: ClassroomMaterial & { extractionMethod?: string } = { type: "drive", id: file.id, title: meta.name || file.name, url: meta.webViewLink || file.url, mimeType };

  if (mimeType === "application/pdf") {
    const size = Number(meta.size || 0);
    if (size && size > 25_000_000) throw new Error("That PDF is too large for MStudy right now. Try a PDF under 25 MB.");
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, { headers });
    if (!response.ok) throw new Error(`MStudy could not download that PDF from Drive. ${await googleError(response)}`);
    const extracted = await extractPdfText(await response.arrayBuffer());
    if (!extracted.text) throw new Error("MStudy opened the PDF but OCR could not find enough readable text. Try a clearer scan or another file.");
    material.extractedText = extracted.text;
    material.extractionMethod = extracted.usedOcr ? "ocr" : "pdf-text";
    return material;
  }

  if (mimeType.startsWith("image/")) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, { headers });
    if (!response.ok) throw new Error(`MStudy could not download that image from Drive. ${await googleError(response)}`);
    const text = await ocrImageSource(await response.blob());
    if (!text) throw new Error("MStudy could not find readable text in that image. Try a clearer photo with the page filling most of the frame.");
    material.extractedText = text.slice(0, 40000);
    material.extractionMethod = "ocr";
    return material;
  }

  if (!metaResponse.ok) throw new Error(`MStudy could not open that Drive file. ${await googleError(metaResponse)}`);

  let textResponse: Response | null = null;
  if (mimeType === "application/vnd.google-apps.document" || mimeType === "application/vnd.google-apps.presentation") {
    textResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent("text/plain")}`, { headers });
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    textResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent("text/csv")}`, { headers });
  } else if (["text/plain", "text/markdown", "text/csv", "application/json"].includes(mimeType)) {
    textResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, { headers });
  }

  if (textResponse && !textResponse.ok) throw new Error(`MStudy could not read that Drive file. ${await googleError(textResponse)}`);
  if (textResponse?.ok) {
    const text = (await textResponse.text()).replace(/\u0000/g, "").trim();
    if (text) {
      material.extractedText = text.slice(0, 40000);
      material.extractionMethod = mimeType.includes("google-apps") ? "google-export" : "text";
    }
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
    const updated = replaceMaterial((snapshot.data() as ClassroomAssignment).materials, selected);
    if (!updated.matched) continue;
    await setDoc(doc(db, "users", user.uid, "classroomAssignments", snapshot.id), { materials: updated.materials }, { merge: true });
    return { fileName: selected.title, matched: true, readable: Boolean(selected.extractedText), source: "assignment" };
  }
  for (const snapshot of resources.docs) {
    const updated = replaceMaterial((snapshot.data() as ClassroomResource).materials, selected);
    if (!updated.matched) continue;
    await setDoc(doc(db, "users", user.uid, "classroomResources", snapshot.id), { materials: updated.materials }, { merge: true });
    return { fileName: selected.title, matched: true, readable: Boolean(selected.extractedText), source: "resource" };
  }
  await setDoc(doc(db, "users", user.uid, "driveStudyFiles", selected.id || picked.id), { ...selected, authorizedAt: new Date().toISOString() }, { merge: true });
  return { fileName: selected.title, matched: false, readable: Boolean(selected.extractedText), source: "drive" };
}
