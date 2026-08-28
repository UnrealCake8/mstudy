import { collection, doc, getDoc, getDocs, increment, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TeamQuestion = { id: string; prompt: string; choices: string[]; answer: string; explanation?: string };
export type PublicTeamQuestion = Pick<TeamQuestion, "id" | "prompt" | "choices">;
export type TeamRoom = {
  code: string; hostUid: string; hostName: string; title: string; subject: string;
  status: "lobby" | "playing" | "finished"; roundState: "question" | "results";
  currentQuestionIndex: number; currentQuestion: PublicTeamQuestion | null; questionCount: number;
  questionStartedAt?: unknown; revealedAnswer?: string; revealedExplanation?: string;
  createdAt?: unknown; updatedAt?: unknown; expiresAt?: unknown;
};
export type TeamPlayer = { uid: string; name: string; team: "Team A" | "Team B"; score: number; correct: number; answered: number; active: boolean; joinedAt?: unknown };
export type TeamAnswer = { id: string; uid: string; questionIndex: number; choice: string; processed?: boolean; correct?: boolean; points?: number; responseMs?: number; answeredAt?: unknown };
export type TeamRoomSecret = { questions: TeamQuestion[] };

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode() { return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(""); }
function safeName(value: string) { return value.replace(/[^A-Za-z0-9 _.'-]/g, "").trim().slice(0, 24) || "Player"; }
function publicQuestion(question: TeamQuestion): PublicTeamQuestion { return { id: question.id, prompt: question.prompt, choices: question.choices }; }
function millis(value: unknown) { return value && typeof value === "object" && "toMillis" in value && typeof (value as {toMillis?:unknown}).toMillis === "function" ? (value as {toMillis:()=>number}).toMillis() : 0; }

async function balancedTeam(code: string): Promise<TeamPlayer["team"]> {
  const snap = await getDocs(collection(db, "teamRooms", code, "players"));
  let a = 0, b = 0;
  snap.forEach(item => { const team = (item.data() as TeamPlayer).team; if (team === "Team A") a++; else if (team === "Team B") b++; });
  return a <= b ? "Team A" : "Team B";
}

export async function createTeamRoom(hostUid: string, hostName: string, title: string, subject: string, questions: TeamQuestion[]) {
  let code = "";
  for (let attempt = 0; attempt < 8; attempt++) { const candidate = randomCode(); if (!(await getDoc(doc(db, "teamRooms", candidate))).exists()) { code = candidate; break; } }
  if (!code) throw new Error("Could not create a unique join code. Try again.");
  await setDoc(doc(db, "teamRooms", code), { code, hostUid, hostName: safeName(hostName || "Host"), title: title.slice(0,100), subject: subject.slice(0,80), status: "lobby", roundState: "question", currentQuestionIndex: -1, currentQuestion: null, questionCount: questions.length, revealedAnswer: "", revealedExplanation: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now()+6*60*60*1000) });
  await setDoc(doc(db, "teamRoomSecrets", code), { questions });
  await joinTeamRoom(code, hostUid, hostName || "Host");
  return code;
}

export async function joinTeamRoom(codeInput: string, uid: string, displayName: string) {
  const code = codeInput.trim().toUpperCase();
  const room = await getDoc(doc(db, "teamRooms", code));
  if (!room.exists()) throw new Error("That Team Mode code does not exist.");
  const data = room.data() as TeamRoom;
  if (data.status === "finished") throw new Error("That Team Mode game has already finished.");
  const playerRef = doc(db, "teamRooms", code, "players", uid);
  const existing = await getDoc(playerRef);
  if (existing.exists()) await updateDoc(playerRef, { name: safeName(displayName), active: true });
  else await setDoc(playerRef, { uid, name: safeName(displayName), team: await balancedTeam(code), score: 0, correct: 0, answered: 0, active: true, joinedAt: serverTimestamp() });
  return code;
}

export function subscribeTeamRoom(code: string, callback: (room: TeamRoom|null)=>void) { return onSnapshot(doc(db,"teamRooms",code), snap => callback(snap.exists() ? snap.data() as TeamRoom : null)); }
export function subscribeTeamPlayers(code: string, callback: (players: TeamPlayer[])=>void) { return onSnapshot(collection(db,"teamRooms",code,"players"), snap => callback(snap.docs.map(item => item.data() as TeamPlayer))); }
export function subscribeTeamAnswers(code: string, callback: (answers: TeamAnswer[])=>void) { return onSnapshot(collection(db,"teamRooms",code,"answers"), snap => callback(snap.docs.filter(item => !item.metadata.hasPendingWrites).map(item => ({id:item.id,...item.data()} as TeamAnswer)))); }
export function subscribeTeamSecret(code: string, callback: (secret: TeamRoomSecret|null)=>void) { return onSnapshot(doc(db,"teamRoomSecrets",code), snap => callback(snap.exists() ? snap.data() as TeamRoomSecret : null)); }

export async function startTeamRoom(code: string, questions: TeamQuestion[]) { if (!questions.length) return; await updateDoc(doc(db,"teamRooms",code), { status:"playing", roundState:"question", currentQuestionIndex:0, currentQuestion:publicQuestion(questions[0]), questionStartedAt:serverTimestamp(), revealedAnswer:"", revealedExplanation:"", updatedAt:serverTimestamp() }); }
export async function revealTeamResults(code: string, index: number, questions: TeamQuestion[]) { const q=questions[index]; if (!q) return; await updateDoc(doc(db,"teamRooms",code), { roundState:"results", revealedAnswer:q.answer, revealedExplanation:q.explanation || "", updatedAt:serverTimestamp() }); }
export async function advanceTeamRoom(code: string, index: number, questions: TeamQuestion[]) { const next=index+1; if (next>=questions.length) return finishTeamRoom(code); await updateDoc(doc(db,"teamRooms",code), { roundState:"question", currentQuestionIndex:next, currentQuestion:publicQuestion(questions[next]), questionStartedAt:serverTimestamp(), revealedAnswer:"", revealedExplanation:"", updatedAt:serverTimestamp() }); }
export async function finishTeamRoom(code: string) { await updateDoc(doc(db,"teamRooms",code), { status:"finished", currentQuestion:null, updatedAt:serverTimestamp() }); }

export async function submitTeamAnswer(code:string, uid:string, questionIndex:number, choice:string) { const id=`${uid}_${questionIndex}`; const ref=doc(db,"teamRooms",code,"answers",id); if ((await getDoc(ref)).exists()) return; await setDoc(ref,{uid,questionIndex,choice,processed:false,answeredAt:serverTimestamp()}); }
export async function processTeamAnswer(code:string, answer:TeamAnswer, question:TeamQuestion, questionStartedAt?:unknown) {
  if (answer.processed || millis(answer.answeredAt) === 0 || millis(questionStartedAt) === 0) return;
  const correct=answer.choice.trim().toLowerCase()===question.answer.trim().toLowerCase();
  const responseMs=Math.max(0, millis(answer.answeredAt)-millis(questionStartedAt));
  const speedBonus=correct ? Math.max(0, 100-Math.floor(responseMs/200)) : 0;
  const points=correct ? 100+speedBonus : 0;
  await updateDoc(doc(db,"teamRooms",code,"answers",answer.id),{processed:true,correct,points,responseMs});
  await updateDoc(doc(db,"teamRooms",code,"players",answer.uid),{score:increment(points),correct:increment(correct?1:0),answered:increment(1)});
}
