"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Bot, Gamepad2, GraduationCap, Heart, ImagePlus, Play, RotateCcw, Sparkles, Swords, Trophy, WandSparkles, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, Note, subscribeCollection } from "@/lib/data";
import type { ClassroomAssignment, ClassroomCourse } from "@/lib/classroom";

type Question = { id: string; prompt: string; choices: string[]; answer: string; explanation: string };
type Stage = "setup" | "battle" | "results";

const BOSS_IMAGE_KEY = "mstudy:boss-image";
const BOSS_NAME_KEY = "mstudy:boss-name";
const STOP = new Set(["about","after","again","against","because","before","being","between","could","during","every","first","from","have","into","other","should","their","there","these","they","this","those","through","under","using","very","were","what","when","where","which","while","with","would","your"]);

function cleanWord(word: string) {
  return word.replace(/[^A-Za-z0-9'-]/g, "").trim();
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateQuestions(text: string): Question[] {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 35);
  const pool = Array.from(new Set(text.split(/\s+/).map(cleanWord).filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()))));
  const questions: Question[] = [];

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).map(cleanWord).filter(Boolean);
    const candidates = words.filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()));
    if (!candidates.length) continue;
    const answer = candidates[Math.floor(candidates.length / 2)];
    const distractors = shuffle(pool.filter(w => w.toLowerCase() !== answer.toLowerCase())).slice(0, 3);
    if (distractors.length < 3) continue;
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prompt = sentence.replace(new RegExp(`\\b${escaped}\\b`, "i"), "_____");
    questions.push({ id: `${questions.length}-${answer}`, prompt, choices: shuffle([answer, ...distractors]), answer, explanation: sentence });
    if (questions.length >= 10) break;
  }
  return questions;
}

export function PlayPage() {
  const { user } = useAuth();
  const search = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [stage, setStage] = useState<Stage>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [bossHp, setBossHp] = useState(1000);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [building, setBuilding] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [bossImage, setBossImage] = useState("");
  const [bossName, setBossName] = useState("Revision Boss");
  const savedRun = useRef(false);

  useEffect(() => user ? subscribeCollection<Note>(user.uid, "notes", setNotes) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomAssignment>(user.uid, "classroomAssignments", setAssignments, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomCourse>(user.uid, "classroomCourses", setCourses, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => {
    try {
      setBossImage(localStorage.getItem(BOSS_IMAGE_KEY) || "");
      setBossName(localStorage.getItem(BOSS_NAME_KEY) || "Revision Boss");
    } catch {}
  }, []);
  useEffect(() => {
    const requestedNote = search.get("note");
    const requestedAssignment = search.get("assignment");
    const requestedCourse = search.get("course");
    if (requestedNote) setSelectedNoteId(requestedNote);
    if (requestedAssignment && requestedCourse) setSelectedAssignmentKey(`${requestedCourse}:${requestedAssignment}`);
  }, [search]);

  const courseNames = useMemo(() => new Map(courses.map(course => [course.id, course.name])), [courses]);
  const selectedNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);
  const selectedAssignment = useMemo(() => assignments.find(a => `${a.courseId}:${a.id}` === selectedAssignmentKey), [assignments, selectedAssignmentKey]);
  const assignmentText = selectedAssignment ? `Assignment: ${selectedAssignment.title}\n\n${selectedAssignment.description || ""}`.trim() : "";
  const sourceText = selectedNote?.content?.trim() || assignmentText || pastedText.trim();
  const title = selectedNote?.title || selectedAssignment?.title || "Custom study challenge";
  const subject = selectedNote?.subject || (selectedAssignment ? courseNames.get(selectedAssignment.courseId) : "") || "Study material";
  const sourceType = selectedNote ? "note" : selectedAssignment ? "classroom" : "text";
  const sourceId = selectedNote?.id || (selectedAssignment ? `${selectedAssignment.courseId}:${selectedAssignment.id}` : null);
  const current = questions[index];

  useEffect(() => {
    if (stage !== "results" || savedRun.current || !user) return;
    savedRun.current = true;
    void addItem(user.uid, "studyGames", {
      title, subject, gameType: "boss", sourceType, sourceId, score,
      accuracy: answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0,
      completed: true,
      usedAI: aiEnabled,
    });
  }, [stage, user, title, subject, sourceType, sourceId, score, answeredCount, correctCount, aiEnabled]);

  function resetSources(kind: "note" | "assignment" | "text") {
    if (kind !== "note") setSelectedNoteId("");
    if (kind !== "assignment") setSelectedAssignmentKey("");
    if (kind !== "text") setPastedText("");
  }

  async function uploadBossImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Choose an image file for your boss."); return; }
    if (file.size > 900_000) { setMessage("Keep boss images under 900 KB so they can stay safely in this browser."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value) return;
      try {
        localStorage.setItem(BOSS_IMAGE_KEY, value);
        setBossImage(value);
        setMessage("");
      } catch {
        setMessage("This browser does not have enough local storage for that image. Try a smaller one.");
      }
    };
    reader.readAsDataURL(file);
  }

  function changeBossName(value: string) {
    const next = value.slice(0, 32);
    setBossName(next);
    try { localStorage.setItem(BOSS_NAME_KEY, next || "Revision Boss"); } catch {}
  }

  function removeBossImage() {
    setBossImage("");
    try { localStorage.removeItem(BOSS_IMAGE_KEY); } catch {}
  }

  async function startGame() {
    if (sourceText.length < 80) {
      setMessage("Add more study material first. Classroom assignments need a useful description, and pasted material should be at least a short paragraph.");
      return;
    }

    setBuilding(true);
    setMessage("");
    let generated: Question[] = [];

    if (aiEnabled) {
      try {
        const response = await fetch("/api/games/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, subject, text: sourceText }),
        });
        const data = await response.json() as { questions?: Omit<Question, "id">[]; error?: string };
        if (!response.ok || !data.questions?.length) throw new Error(data.error || "AI generation failed.");
        generated = data.questions.map((question, i) => ({ ...question, id: `ai-${i}` }));
      } catch (error) {
        generated = generateQuestions(sourceText);
        setMessage(`${error instanceof Error ? error.message : "AI generation failed."} Using the built-in generator instead.`);
      }
    } else {
      generated = generateQuestions(sourceText);
    }

    setBuilding(false);
    if (generated.length < 4) {
      setMessage("MStudy could not make enough useful questions from this material. Try adding a few more detailed paragraphs or turn AI generation on.");
      return;
    }

    setQuestions(generated);
    setIndex(0); setBossHp(1000); setHearts(3); setScore(0); setStreak(0); setCorrectCount(0); setAnsweredCount(0); setPicked(null);
    savedRun.current = false;
    setStage("battle");
  }

  function answer(choice: string) {
    if (picked || !current) return;
    setPicked(choice);
    setAnsweredCount(value => value + 1);
    const correct = choice.toLowerCase() === current.answer.toLowerCase();
    if (correct) {
      const nextStreak = streak + 1;
      const damage = Math.min(220, 110 + nextStreak * 15);
      setCorrectCount(value => value + 1);
      setStreak(nextStreak);
      setBossHp(hp => Math.max(0, hp - damage));
      setScore(s => s + 100 + nextStreak * 20);
    } else {
      setStreak(0);
      setHearts(h => Math.max(0, h - 1));
    }
  }

  function next() {
    if (!picked) return;
    if (bossHp <= 0 || hearts <= 0 || index >= questions.length - 1) { setStage("results"); return; }
    setIndex(i => i + 1); setPicked(null);
  }

  if (stage === "setup") return <section className="page play-page">
    <div className="page-head play-head">
      <div><p className="eyebrow">Study games</p><h1>Turn revision into a game.</h1><p>Use notes, Classroom work or pasted material, then customize who you fight.</p></div>
      <div className="play-hero-icon"><Gamepad2 size={34}/></div>
    </div>

    <div className="play-layout">
      <article className="play-panel">
        <div className="form-heading"><BookOpen size={20}/><div><strong>Use an MStudy note</strong><span>Your saved notes are ready to play.</span></div></div>
        <div className="note-picker">{notes.length === 0 ? <div className="empty-state compact"><strong>No notes yet</strong><span>Create a note first, or use another source.</span></div> : notes.map(note =>
          <button key={note.id} onClick={() => { resetSources("note"); setSelectedNoteId(note.id); }} className={selectedNoteId === note.id ? "source-card active" : "source-card"}>
            <span className="pill">{note.subject || "General"}</span><strong>{note.title}</strong><small>{note.content?.slice(0, 90) || "No note text"}</small>
          </button>)}</div>
      </article>

      <article className="play-panel">
        <div className="form-heading"><GraduationCap size={20}/><div><strong>Use Google Classroom</strong><span>Build from synced assignment instructions and descriptions.</span></div></div>
        <div className="note-picker">{assignments.length === 0 ? <div className="empty-state compact"><strong>No synced assignments</strong><span>Connect or sync Classroom first.</span></div> : assignments.map(item => {
          const key = `${item.courseId}:${item.id}`;
          return <button key={key} onClick={() => { resetSources("assignment"); setSelectedAssignmentKey(key); }} className={selectedAssignmentKey === key ? "source-card active" : "source-card"}>
            <span className="pill">{courseNames.get(item.courseId) || "Classroom"}</span><strong>{item.title}</strong><small>{item.description?.slice(0, 100) || "No assignment description supplied"}</small>
          </button>;
        })}</div>
      </article>

      <article className="play-panel">
        <div className="form-heading"><WandSparkles size={20}/><div><strong>Paste study material</strong><span>Great for revision sheets, textbook sections or class notes.</span></div></div>
        <textarea className="study-input" rows={10} value={pastedText} onChange={e => { resetSources("text"); setPastedText(e.target.value); }} placeholder="Paste a few paragraphs of study material here…"/>
      </article>

      <article className="play-panel boss-customizer">
        <div className="form-heading"><ImagePlus size={20}/><div><strong>Customize your boss</strong><span>The image stays in local browser storage and is not uploaded to MStudy.</span></div></div>
        <div className="boss-preview-row">
          <div className="boss-preview">{bossImage ? <img src={bossImage} alt="Custom boss"/> : <Swords size={30}/>}</div>
          <div className="boss-fields"><label><span>Boss name</span><input value={bossName} onChange={e => changeBossName(e.target.value)} placeholder="Revision Boss"/></label><div className="boss-buttons"><label className="secondary-button upload-button"><ImagePlus size={16}/> Upload image<input type="file" accept="image/*" onChange={uploadBossImage}/></label>{bossImage ? <button className="secondary-button" onClick={removeBossImage}><X size={16}/> Remove</button> : null}</div></div>
        </div>
      </article>
    </div>

    <div className="game-mode-card">
      <div className="mode-art"><Swords size={30}/></div>
      <div><span className="pill">Boss Battle</span><h2>{bossName || "Revision Boss"}</h2><p>Correct answers deal damage. Build a streak for stronger attacks. Three mistakes and the boss wins.</p><label className="ai-toggle"><input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)}/><Bot size={16}/><span><strong>Use OpenAI for better questions</strong><small>Optional. If unavailable, MStudy automatically falls back to its built-in generator.</small></span></label></div>
      <button className="primary-button game-start" disabled={!sourceText || building} onClick={startGame}><Play size={18}/>{building ? "Building…" : "Build my game"}</button>
    </div>
    {message && <p className="game-warning">{message}</p>}
  </section>;

  if (stage === "results") {
    const won = hearts > 0;
    return <section className="battle-shell results-shell"><div className="results-card">
      <Trophy size={46}/><p className="eyebrow">Battle complete</p><h1>{won ? `You defeated ${bossName || "the boss"}!` : `${bossName || "The boss"} got you this time.`}</h1>
      <div className="result-stats"><div><strong>{score}</strong><span>Score</span></div><div><strong>{answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0}%</strong><span>Accuracy</span></div><div><strong>{Math.max(0, hearts)}</strong><span>Hearts left</span></div></div>
      <p>{title} · {subject}</p><div className="form-actions centered"><button className="secondary-button" onClick={() => setStage("setup")}><BookOpen size={17}/> New material</button><button className="primary-button" onClick={startGame}><RotateCcw size={17}/> Play again</button></div>
    </div></section>;
  }

  const isCorrect = picked?.toLowerCase() === current?.answer.toLowerCase();
  return <section className="battle-shell">
    <div className="battle-topbar"><div><span className="pill">{subject}</span><strong>{title}</strong></div><div className="battle-stats"><span><Heart size={18}/> {hearts}</span><span><Sparkles size={18}/> {streak}x</span><span>{score} pts</span></div></div>
    <div className="boss-zone"><div className={picked && isCorrect ? "boss-avatar boss-hit" : "boss-avatar"}>{bossImage ? <img src={bossImage} alt={bossName || "Custom boss"}/> : <Swords size={46}/>}</div><strong>{(bossName || "REVISION BOSS").toUpperCase()}</strong><div className="boss-health"><span style={{ width: `${bossHp / 10}%` }}/></div><small>{bossHp} HP</small></div>
    <article className="question-card"><div className="question-meta"><span>Question {index + 1} / {questions.length}</span><span>{aiEnabled ? "AI study challenge" : "Study challenge"}</span></div><h2>{current?.prompt}</h2>
      <div className="choice-grid">{current?.choices.map(choice => { const chosen = picked === choice; const correctChoice = picked && choice.toLowerCase() === current.answer.toLowerCase(); const cls = correctChoice ? "choice correct" : chosen ? "choice wrong" : "choice"; return <button disabled={!!picked} className={cls} key={choice} onClick={() => answer(choice)}>{choice}</button>; })}</div>
      {picked && <div className={isCorrect ? "answer-feedback correct" : "answer-feedback wrong"}><strong>{isCorrect ? "Direct hit!" : `Correct answer: ${current.answer}`}</strong><span>{current.explanation}</span><button className="primary-button" onClick={next}>{bossHp <= 0 || hearts <= 0 || index >= questions.length - 1 ? "See results" : "Next attack"}</button></div>}
    </article>
  </section>;
}
