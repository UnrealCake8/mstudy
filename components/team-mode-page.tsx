"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Copy, Gamepad2, LogIn, Play, Radio, Sparkles, Trophy, Users, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Note, subscribeCollection } from "@/lib/data";
import type { ClassroomAssignment, ClassroomCourse, ClassroomResource } from "@/lib/classroom";
import {
  advanceTeamRoom,
  createTeamRoom,
  finishTeamRoom,
  joinTeamRoom,
  processTeamAnswer,
  startTeamRoom,
  submitTeamAnswer,
  subscribeTeamAnswers,
  subscribeTeamPlayers,
  subscribeTeamRoom,
  subscribeTeamSecret,
  TeamAnswer,
  TeamPlayer,
  TeamQuestion,
  TeamRoom,
  TeamRoomSecret,
} from "@/lib/team-mode";

type DriveStudyFile = { id: string; title: string; extractedText?: string };
type SourceKind = "note" | "drive" | "assignment" | "resource" | "text";
type Screen = "home" | "host" | "join" | "room";

const STOP = new Set(["about","after","again","because","before","being","between","could","during","every","first","from","have","into","other","should","their","there","these","they","this","those","through","under","using","very","were","what","when","where","which","while","with","would","your"]);
function cleanWord(word: string) { return word.replace(/[^A-Za-z0-9'-]/g, "").trim(); }
function shuffle<T>(items: T[]) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
function fallbackQuestions(text: string): TeamQuestion[] {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 35);
  const pool = Array.from(new Set(text.split(/\s+/).map(cleanWord).filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()))));
  const out: TeamQuestion[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).map(cleanWord).filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()));
    if (!words.length) continue;
    const answer = words[Math.floor(words.length / 2)];
    const distractors = shuffle(pool.filter(w => w.toLowerCase() !== answer.toLowerCase())).slice(0, 3);
    if (distractors.length < 3) continue;
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out.push({ id: `local-${out.length}`, prompt: sentence.replace(new RegExp(`\\b${escaped}\\b`, "i"), "_____"), choices: shuffle([answer, ...distractors]), answer, explanation: sentence });
    if (out.length >= 10) break;
  }
  return out;
}
function extracted(materials?: { extractedText?: string }[]) { return (materials || []).map(m => m.extractedText?.trim() || "").filter(Boolean).join("\n\n").trim(); }

export function TeamModePage() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState<TeamRoom | null>(null);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [answers, setAnswers] = useState<TeamAnswer[]>([]);
  const [secret, setSecret] = useState<TeamRoomSecret | null>(null);
  const [picked, setPicked] = useState("");
  const processing = useRef(new Set<string>());

  const [notes, setNotes] = useState<Note[]>([]);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [resources, setResources] = useState<ClassroomResource[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveStudyFile[]>([]);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [sourceKind, setSourceKind] = useState<SourceKind>("note");
  const [sourceId, setSourceId] = useState("");
  const [pastedText, setPastedText] = useState("");

  useEffect(() => { if (user && !displayName) setDisplayName((user.displayName || user.email?.split("@")[0] || "Player").slice(0, 24)); }, [user, displayName]);
  useEffect(() => user ? subscribeCollection<Note>(user.uid, "notes", setNotes) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomAssignment>(user.uid, "classroomAssignments", setAssignments, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomResource>(user.uid, "classroomResources", setResources, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<DriveStudyFile>(user.uid, "driveStudyFiles", setDriveFiles, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomCourse>(user.uid, "classroomCourses", setCourses, { orderByCreatedAt: false }) : undefined, [user]);

  useEffect(() => {
    if (!code) return;
    const unsubRoom = subscribeTeamRoom(code, value => { setRoom(value); if (!value) { setMessage("This Team Mode room is no longer available."); setScreen("home"); setCode(""); } });
    const unsubPlayers = subscribeTeamPlayers(code, setPlayers);
    const unsubAnswers = subscribeTeamAnswers(code, setAnswers);
    return () => { unsubRoom(); unsubPlayers(); unsubAnswers(); };
  }, [code]);

  const isHost = Boolean(user && room && room.hostUid === user.uid);
  useEffect(() => {
    if (!code || !isHost) { setSecret(null); return; }
    return subscribeTeamSecret(code, setSecret);
  }, [code, isHost]);

  useEffect(() => { setPicked(""); }, [room?.currentQuestionIndex]);
  useEffect(() => {
    if (!isHost || !secret || !room || room.status !== "playing") return;
    const pending = answers.filter(answer => !answer.processed && answer.questionIndex >= 0 && !processing.current.has(answer.id));
    pending.forEach(answer => {
      const question = secret.questions[answer.questionIndex];
      if (!question) return;
      processing.current.add(answer.id);
      void processTeamAnswer(code, answer, question).finally(() => processing.current.delete(answer.id));
    });
  }, [answers, isHost, secret, room, code]);

  const courseNames = useMemo(() => new Map(courses.map(course => [course.id, course.name])), [courses]);
  const selectedNote = notes.find(note => note.id === sourceId);
  const selectedDrive = driveFiles.find(file => file.id === sourceId);
  const selectedAssignment = assignments.find(item => `${item.courseId}:${item.id}` === sourceId);
  const selectedResource = resources.find(item => `${item.courseId}:${item.id}` === sourceId);
  const sourceText = sourceKind === "note" ? selectedNote?.content?.trim() || "" : sourceKind === "drive" ? selectedDrive?.extractedText?.trim() || "" : sourceKind === "assignment" ? extracted(selectedAssignment?.materials) || selectedAssignment?.description?.trim() || "" : sourceKind === "resource" ? extracted(selectedResource?.materials) || selectedResource?.description?.trim() || "" : pastedText.trim();
  const title = sourceKind === "note" ? selectedNote?.title || "Team study game" : sourceKind === "drive" ? selectedDrive?.title || "Team study game" : sourceKind === "assignment" ? selectedAssignment?.title || "Team study game" : sourceKind === "resource" ? selectedResource?.title || "Team study game" : "Team study game";
  const subject = sourceKind === "note" ? selectedNote?.subject || "Study" : sourceKind === "assignment" ? courseNames.get(selectedAssignment?.courseId || "") || "Classroom" : sourceKind === "resource" ? courseNames.get(selectedResource?.courseId || "") || "Classroom" : sourceKind === "drive" ? "Drive file" : "Study material";

  const teamTotals = useMemo(() => {
    const totals = { "Team A": 0, "Team B": 0 };
    players.forEach(player => { totals[player.team] += player.score || 0; });
    return totals;
  }, [players]);
  const currentPlayer = players.find(player => player.uid === user?.uid);
  const alreadyAnswered = answers.some(answer => answer.uid === user?.uid && answer.questionIndex === room?.currentQuestionIndex);

  function chooseSource(kind: SourceKind) { setSourceKind(kind); setSourceId(""); setPastedText(""); setMessage(""); }

  async function buildAndHost() {
    if (!user) return;
    if (sourceText.length < 80) { setMessage("Choose study material with enough readable text to build a Team Mode game."); return; }
    setBusy(true); setMessage("");
    let questions: TeamQuestion[] = [];
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/games/generate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ title, subject, text: sourceText, questionMode: "mcq" }) });
      const data = await response.json() as { questions?: Array<{ prompt: string; choices: string[]; answer: string; explanation?: string; type?: string }>; error?: string };
      if (!response.ok || !data.questions?.length) throw new Error(data.error || "AI generation failed.");
      questions = data.questions.filter(q => q.choices?.length >= 2).map((q, index) => ({ id: `team-${index}`, prompt: q.prompt, choices: q.choices, answer: q.answer, explanation: q.explanation }));
    } catch (error) {
      questions = fallbackQuestions(sourceText);
      setMessage(`${error instanceof Error ? error.message : "Could not use AI."} Using MStudy's built-in question generator instead.`);
    }
    if (questions.length < 4) { setBusy(false); setMessage("MStudy could not make enough multiplayer questions from that material. Try a longer source."); return; }
    try {
      const newCode = await createTeamRoom(user.uid, displayName || "Host", title, subject, questions);
      setCode(newCode); setScreen("room");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create Team Mode room."); }
    finally { setBusy(false); }
  }

  async function join() {
    if (!user) return;
    if (joinCode.trim().length < 5) { setMessage("Enter the 5-character join code."); return; }
    setBusy(true); setMessage("");
    try { const joined = await joinTeamRoom(joinCode, user.uid, displayName || "Player"); setCode(joined); setScreen("room"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not join that room."); }
    finally { setBusy(false); }
  }

  async function answer(choice: string) {
    if (!user || !room || room.status !== "playing" || alreadyAnswered) return;
    setPicked(choice);
    await submitTeamAnswer(code, user.uid, room.currentQuestionIndex, choice);
  }

  if (screen === "home") return <section className="page team-page">
    <div className="team-hero"><div><p className="eyebrow">Multiplayer study</p><h1>Team Mode</h1><p>Turn MStudy revision into a live team game. Host a round, share the join code and compete together in real time.</p></div><div className="play-hero-icon"><Users size={34}/></div></div>
    <div className="team-grid">
      <article className="team-card"><Gamepad2 size={28}/><h2>Host a game</h2><p>Build questions from your MStudy notes, Drive files, Classroom work or pasted study material.</p><button className="primary-button" onClick={() => { setScreen("host"); setMessage(""); }}><Play size={17}/> Host Team Mode</button></article>
      <article className="team-card"><LogIn size={28}/><h2>Join a game</h2><p>Got a join code from a friend or teacher? Enter it and jump straight into the lobby.</p><button className="secondary-button" onClick={() => { setScreen("join"); setMessage(""); }}><Users size={17}/> Join with code</button></article>
    </div>
  </section>;

  if (screen === "host") return <section className="page team-page">
    <div className="page-head"><div><p className="eyebrow">Host Team Mode</p><h1>Build the multiplayer round</h1><p>Team Mode uses the same MStudy study sources and question generator as Play.</p></div><button className="icon-button" onClick={() => setScreen("home")} aria-label="Close"><X size={18}/></button></div>
    <article className="team-card">
      <div className="team-source-tabs">{(["note","drive","assignment","resource","text"] as SourceKind[]).map(kind => <button key={kind} className={sourceKind === kind ? "active" : ""} onClick={() => chooseSource(kind)}>{kind === "note" ? "Notes" : kind === "drive" ? "Drive" : kind === "assignment" ? "Assignments" : kind === "resource" ? "Class materials" : "Paste text"}</button>)}</div>
      <div className="team-form">
        {sourceKind === "note" ? <label>MStudy note<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Choose a note…</option>{notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label> : null}
        {sourceKind === "drive" ? <label>Authorised Drive file<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Choose a Drive file…</option>{driveFiles.map(file => <option key={file.id} value={file.id}>{file.title}</option>)}</select></label> : null}
        {sourceKind === "assignment" ? <label>Classroom assignment<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Choose an assignment…</option>{assignments.map(item => <option key={`${item.courseId}:${item.id}`} value={`${item.courseId}:${item.id}`}>{courseNames.get(item.courseId) || "Classroom"} · {item.title}</option>)}</select></label> : null}
        {sourceKind === "resource" ? <label>Classroom material<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Choose class material…</option>{resources.map(item => <option key={`${item.courseId}:${item.id}`} value={`${item.courseId}:${item.id}`}>{courseNames.get(item.courseId) || "Classroom"} · {item.title}</option>)}</select></label> : null}
        {sourceKind === "text" ? <label>Study material<textarea rows={9} value={pastedText} onChange={e => setPastedText(e.target.value)} placeholder="Paste a revision sheet, textbook section or class notes…"/></label> : null}
        <label>Your lobby name<input value={displayName} onChange={e => setDisplayName(e.target.value.slice(0,24))} maxLength={24}/></label>
      </div>
      <button className="primary-button" disabled={busy || sourceText.length < 80} onClick={buildAndHost}><Sparkles size={17}/>{busy ? "Building room…" : "Build game & create code"}</button>
      {message ? <div className="team-warning">{message}</div> : null}
    </article>
  </section>;

  if (screen === "join") return <section className="page team-page">
    <div className="page-head"><div><p className="eyebrow">Join Team Mode</p><h1>Enter the room code</h1></div><button className="icon-button" onClick={() => setScreen("home")} aria-label="Close"><X size={18}/></button></div>
    <article className="team-card team-form"><label>Join code<input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,5))} placeholder="K7M4Q" autoCapitalize="characters"/></label><label>Your name<input value={displayName} onChange={e => setDisplayName(e.target.value.slice(0,24))} maxLength={24}/></label><button className="primary-button" disabled={busy || joinCode.length !== 5} onClick={join}><LogIn size={17}/>{busy ? "Joining…" : "Join game"}</button>{message ? <div className="team-warning">{message}</div> : null}</article>
  </section>;

  if (!room) return <section className="page"><p>Opening Team Mode room…</p></section>;

  if (room.status === "lobby") return <section className="page team-page">
    <div className="team-hero"><div><span className="room-status"><Radio size={13}/> Lobby open</span><p className="eyebrow">Join code</p><div className="join-code">{room.code}</div><p>{room.title} · {room.subject}</p></div><div className="team-actions"><button className="secondary-button" onClick={() => navigator.clipboard?.writeText(room.code)}><Copy size={16}/> Copy code</button>{isHost ? <button className="primary-button" disabled={!secret?.questions.length || players.length < 1} onClick={() => secret && startTeamRoom(code, secret.questions)}><Play size={17}/> Start game</button> : null}</div></div>
    <div className="team-lobby"><article className="team-card"><h2><Users size={18}/> Players ({players.length})</h2><div className="player-list">{players.map(player => <div className="player-row" key={player.uid}><div className="player-meta"><strong>{player.name}</strong>{player.uid === room.hostUid ? <span className="team-chip">Host</span> : null}</div><span className="team-chip">{player.team}</span></div>)}</div></article><article className="team-card"><h2>Teams</h2><div className="leaderboard"><div className="team-score-card"><span>Team A</span><strong>{players.filter(p => p.team === "Team A").length}</strong><small>players</small></div><div className="team-score-card"><span>Team B</span><strong>{players.filter(p => p.team === "Team B").length}</strong><small>players</small></div></div>{!isHost ? <p className="section-help">Waiting for {room.hostName} to start the round…</p> : <p className="section-help">Share the code, then start whenever everyone is here.</p>}</article></div>
  </section>;

  if (room.status === "finished") {
    const winner = teamTotals["Team A"] === teamTotals["Team B"] ? "It's a tie!" : `${teamTotals["Team A"] > teamTotals["Team B"] ? "Team A" : "Team B"} wins!`;
    return <section className="page team-page"><article className="team-card team-results"><Trophy size={44}/><p className="eyebrow">Round complete</p><h1>{winner}</h1><div className="team-results-grid"><div className="team-score-card"><span>Team A</span><strong>{teamTotals["Team A"]}</strong><small>points</small></div><div className="team-score-card"><span>Team B</span><strong>{teamTotals["Team B"]}</strong><small>points</small></div></div><h2>Leaderboard</h2><div className="player-list">{[...players].sort((a,b) => b.score-a.score).map((player,index) => <div className="player-row" key={player.uid}><div><strong>#{index+1} {player.name}</strong><small>{player.team} · {player.correct}/{player.answered} correct</small></div><strong>{player.score} pts</strong></div>)}</div><button className="primary-button" onClick={() => { setCode(""); setRoom(null); setScreen("home"); }}><Gamepad2 size={17}/> Back to Team Mode</button></article></section>;
  }

  const question = room.currentQuestion;
  return <section className="page team-page">
    <div className="team-hero"><div><span className="room-status"><Radio size={13}/> Live · {room.code}</span><p className="eyebrow">Question {room.currentQuestionIndex + 1} / {room.questionCount}</p><h1>{room.title}</h1></div>{isHost ? <div className="team-actions"><button className="secondary-button" onClick={() => finishTeamRoom(code)}>End game</button><button className="primary-button" disabled={!secret} onClick={() => secret && advanceTeamRoom(code, room.currentQuestionIndex, secret.questions)}>Next <ArrowRight size={16}/></button></div> : <span className="team-chip">{currentPlayer?.team || "Team"}</span>}</div>
    <div className="team-lobby"><article className="team-card team-question"><h2>{question?.prompt || "Loading question…"}</h2>{isHost ? <><p className="section-help">Players are answering on their own screens.</p><div className="player-list">{players.map(player => { const response = answers.find(answer => answer.uid === player.uid && answer.questionIndex === room.currentQuestionIndex); return <div className="player-row" key={player.uid}><strong>{player.name}</strong><span className="team-chip">{response ? (response.processed ? (response.correct ? "Correct" : "Answered") : "Locked in") : "Thinking…"}</span></div>; })}</div></> : <div className="team-choice-grid">{question?.choices.map(choice => <button className={picked === choice ? "team-choice selected" : "team-choice"} key={choice} disabled={alreadyAnswered} onClick={() => answer(choice)}>{choice}</button>)}</div>}{!isHost && alreadyAnswered ? <div className="team-warning">Answer locked in. Waiting for the host to move to the next question.</div> : null}</article><aside className="team-card"><h2>Live score</h2><div className="leaderboard"><div className="team-score-card"><span>Team A</span><strong>{teamTotals["Team A"]}</strong><small>points</small></div><div className="team-score-card"><span>Team B</span><strong>{teamTotals["Team B"]}</strong><small>points</small></div></div><h3>Players</h3><div className="player-list">{[...players].sort((a,b) => b.score-a.score).map(player => <div className="player-row" key={player.uid}><span>{player.name}</span><strong>{player.score}</strong></div>)}</div></aside></div>
  </section>;
}
