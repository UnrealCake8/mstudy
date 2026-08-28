import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const BUILTIN_CHAT_DOMAINS = ["ses-students.org", "sharjahenglishschool.org"] as const;
export const MAX_GROUP_SIZE = 20;

export type ChatProfile = {
  uid: string;
  name: string;
  email: string;
  domain: string;
  nameLower: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ChatConversation = {
  id: string;
  type: "direct" | "group";
  title: string;
  members: string[];
  ownerUid: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastMessage?: string;
  lastSenderUid?: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUid: string;
  text: string;
  createdAt?: unknown;
};

export type ChatDomain = { domain: string; createdAt?: unknown; createdBy?: string };

function normaliseDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function emailDomain(email?: string | null) {
  return normaliseDomain(email?.split("@").pop() || "");
}

export async function isChatDomainAllowed(email?: string | null) {
  const domain = emailDomain(email);
  if (!domain) return false;
  if ((BUILTIN_CHAT_DOMAINS as readonly string[]).includes(domain)) return true;
  return (await getDoc(doc(db, "chatDomains", domain))).exists();
}

export async function ensureChatProfile(uid: string, email: string, displayName?: string | null) {
  const domain = emailDomain(email);
  if (!(await isChatDomainAllowed(email))) return false;
  const name = (displayName?.trim() || email.split("@")[0] || "Student").slice(0, 80);
  await setDoc(doc(db, "chatProfiles", uid), {
    uid,
    name,
    email: email.toLowerCase(),
    domain,
    nameLower: name.toLowerCase(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return true;
}

export async function listChatProfiles() {
  const snap = await getDocs(query(collection(db, "chatProfiles"), limit(500)));
  return snap.docs.map(item => item.data() as ChatProfile);
}

export function subscribeConversations(uid: string, callback: (items: ChatConversation[]) => void) {
  const q = query(collection(db, "conversations"), where("members", "array-contains", uid));
  return onSnapshot(q, snap => callback(snap.docs.map(item => ({ id: item.id, ...item.data() } as ChatConversation)).sort((a, b) => timestampMs(b.updatedAt) - timestampMs(a.updatedAt))));
}

export function subscribeMessages(conversationId: string, callback: (items: ChatMessage[]) => void) {
  const q = query(collection(db, "conversations", conversationId, "messages"), orderBy("createdAt", "asc"), limit(500));
  return onSnapshot(q, snap => callback(snap.docs.map(item => ({ id: item.id, conversationId, ...item.data() } as ChatMessage))));
}

export async function createDirectConversation(me: ChatProfile, other: ChatProfile) {
  const existingSnap = await getDocs(
    query(collection(db, "conversations"), where("members", "array-contains", me.uid), limit(100))
  );
  const existing = existingSnap.docs.find(item => {
    const data = item.data() as ChatConversation;
    return data.type === "direct"
      && data.members?.length === 2
      && data.members.includes(me.uid)
      && data.members.includes(other.uid);
  });
  if (existing) return existing.id;

  const members = [me.uid, other.uid].sort();
  const ref = await addDoc(collection(db, "conversations"), {
    type: "direct",
    title: "",
    members,
    ownerUid: me.uid,
    createdBy: me.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "",
    lastSenderUid: "",
  });
  return ref.id;
}

export async function createGroupConversation(ownerUid: string, title: string, memberUids: string[]) {
  const members = Array.from(new Set([ownerUid, ...memberUids])).slice(0, MAX_GROUP_SIZE);
  if (members.length < 3) throw new Error("Choose at least two other students for a group chat.");
  const ref = await addDoc(collection(db, "conversations"), {
    type: "group",
    title: title.trim().slice(0, 80) || "Study group",
    members,
    ownerUid,
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "",
    lastSenderUid: "",
  });
  return ref.id;
}

export async function sendMessage(conversationId: string, senderUid: string, text: string) {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return;
  const blocked = await isBlockedInConversation(conversationId, senderUid);
  if (blocked) throw new Error("Messaging is unavailable in this conversation because one of the participants has blocked the other.");
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderUid,
    text: clean,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: clean.slice(0, 120),
    lastSenderUid: senderUid,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteOwnMessage(conversationId: string, messageId: string) {
  await deleteDoc(doc(db, "conversations", conversationId, "messages", messageId));
}

export async function reportMessage(conversationId: string, message: ChatMessage, reporterUid: string, reason: string) {
  await addDoc(collection(db, "chatReports"), {
    conversationId,
    messageId: message.id,
    senderUid: message.senderUid,
    reporterUid,
    messageText: message.text,
    reason: reason.trim().slice(0, 500) || "Student safety concern",
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function blockUser(blockerUid: string, blockedUid: string) {
  if (blockerUid === blockedUid) return;
  await setDoc(doc(db, "chatBlocks", `${blockerUid}_${blockedUid}`), { blockerUid, blockedUid, createdAt: serverTimestamp() });
}

export async function unblockUser(blockerUid: string, blockedUid: string) {
  await deleteDoc(doc(db, "chatBlocks", `${blockerUid}_${blockedUid}`));
}

export async function isUserBlocked(blockerUid: string, blockedUid: string) {
  return (await getDoc(doc(db, "chatBlocks", `${blockerUid}_${blockedUid}`))).exists();
}

async function isBlockedInConversation(conversationId: string, senderUid: string) {
  const snap = await getDoc(doc(db, "conversations", conversationId));
  if (!snap.exists()) return true;
  const conversation = snap.data() as ChatConversation;
  if (conversation.type !== "direct") return false;
  const otherUid = conversation.members.find(uid => uid !== senderUid);
  if (!otherUid) return false;
  const [a, b] = await Promise.all([
    getDoc(doc(db, "chatBlocks", `${senderUid}_${otherUid}`)),
    getDoc(doc(db, "chatBlocks", `${otherUid}_${senderUid}`)),
  ]);
  return a.exists() || b.exists();
}

export async function addChatDomain(domainInput: string, adminUid: string) {
  const domain = normaliseDomain(domainInput);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error("Enter a valid email domain.");
  await setDoc(doc(db, "chatDomains", domain), { domain, createdBy: adminUid, createdAt: serverTimestamp() });
  return domain;
}

export async function removeChatDomain(domainInput: string) {
  const domain = normaliseDomain(domainInput);
  if ((BUILTIN_CHAT_DOMAINS as readonly string[]).includes(domain)) throw new Error("The two original SES domains are built in and cannot be removed here.");
  await deleteDoc(doc(db, "chatDomains", domain));
}

export function subscribeChatDomains(callback: (items: ChatDomain[]) => void) {
  return onSnapshot(collection(db, "chatDomains"), snap => callback(snap.docs.map(item => item.data() as ChatDomain)));
}

export function subscribeAllConversations(callback: (items: ChatConversation[]) => void) {
  return onSnapshot(collection(db, "conversations"), snap => callback(snap.docs.map(item => ({ id: item.id, ...item.data() } as ChatConversation)).sort((a,b) => timestampMs(b.updatedAt) - timestampMs(a.updatedAt))));
}

export async function logAdminChatAction(adminUid: string, action: "view" | "export", conversationId: string) {
  await addDoc(collection(db, "adminAuditLogs"), { adminUid, action, conversationId, createdAt: serverTimestamp() });
}

export function timestampMs(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}
