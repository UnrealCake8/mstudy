"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Gamepad2, Heart, Play, RotateCcw, Sparkles, Swords, Trophy, WandSparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, Note, subscribeCollection } from "@/lib/data";

type Question = { id: string; prompt: string; choices: string[]; answer: string; explanation: string };
type Stage = "setup" | "battle" | "results";

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
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 35);

  const pool = Array.from(new Set(
    text.split(/\s+/)
      .map(cleanWord)
      .filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()))
  ));

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
    questions.push({
      id: `${questions.length}-${answer}`,
      prompt,
      choices: shuffle([answer, ...distractors]),
      answer,
      explanation: sentence,
    });
    if (questions.length >= 10) break;
  }
  return questions;
}

export function PlayPage() {
  const { user } = useAuth();
  const search = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [stage, setStage] = useState<Stage>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [bossHp, setBossHp] = useState(1000);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const savedRun = useRef(false);

  useEffect(() => user ? subscribeCollection<Note>(user.uid, "notes", setNotes) : undefined, [user]);
  useEffect(() => {
    const requested = search.get("note");
    if (requested) setSelectedNoteId(requested);
  }, [search]);

  const selectedNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);
  const sourceText = selectedNote?.content?.trim() || pastedText.trim();
  const title = selectedNote?.title || "Custom study challenge";
  const subject = selectedNote?.subject || "Study material";
  const current = questions[index];

  useEffect(() => {
    if (stage !== "results" || savedRun.current || !user) return;
    savedRun.current = true;
    void addItem(user.uid, "studyGames", {
      title,
      subject,
      gameType: "boss",
      sourceType: selectedNote ? "note" : "text",
      sourceId: selectedNote?.id || null,
      score,
      accuracy: questions.length ? Math.round(((questions.length - Math.max(0, 3 - hearts)) / questions.length) * 100) : 0,
      completed: bossHp <= 0 || index >= questions.length - 1,
    });
  }, [stage, user, title, subject, selectedNote, score, questions.length, hearts, bossHp, index]);

  function startGame() {
    const generated = generateQuestions(sourceText);
    if (generated.length < 4) {
      setMessage("Add a little more study material so MStudy can build a proper game. A few detailed paragraphs works best.");
      return;
    }
    setQuestions(generated);
    setIndex(0);
    setBossHp(1000);
    setHearts(3);
    setScore(0);
    setStreak(0);
    setPicked(null);
    setMessage("");
    savedRun.current = false;
    setStage("battle");
  }

  function answer(choice: string) {
    if (picked || !current) return;
    setPicked(choice);
    const correct = choice.toLowerCase() === current.answer.toLowerCase();
    if (correct) {
      const nextStreak = streak + 1;
      const damage = Math.min(220, 110 + nextStreak * 15);
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
    if (bossHp <= 0 || hearts <= 0 || index >= questions.length - 1) {
      setStage("results");
      return;
    }
    setIndex(i => i + 1);
    setPicked(null);
  }

  if (stage === "setup") return <section className="page play-page">
    <div className="page-head play-head">
      <div><p className="eyebrow">Study games</p><h1>Turn revision into a game.</h1><p>Choose one of your notes or paste study material, then fight your way through it.</p></div>
      <div className="play-hero-icon"><Gamepad2 size={34}/></div>
    </div>

    <div className="play-layout">
      <article className="play-panel">
        <div className="form-heading"><BookOpen size={20}/><div><strong>Use an MStudy note</strong><span>Your saved notes are ready to play instantly.</span></div></div>
        <div className="note-picker">
          {notes.length === 0 ? <div className="empty-state compact"><strong>No notes yet</strong><span>Create a note first, or paste material below.</span></div> : notes.map(note =>
            <button key={note.id} onClick={() => { setSelectedNoteId(note.id); setPastedText(""); }} className={selectedNoteId === note.id ? "source-card active" : "source-card"}>
              <span className="pill">{note.subject || "General"}</span><strong>{note.title}</strong><small>{note.content?.slice(0, 90) || "No note text"}</small>
            </button>)}
        </div>
      </article>

      <article className="play-panel">
        <div className="form-heading"><WandSparkles size={20}/><div><strong>Paste study material</strong><span>Great for revision sheets, copied textbook sections or class notes.</span></div></div>
        <textarea className="study-input" rows={12} value={pastedText} onChange={e => { setPastedText(e.target.value); setSelectedNoteId(""); }} placeholder="Paste a few paragraphs of study material here…"/>
      </article>
    </div>

    <div className="game-mode-card">
      <div className="mode-art"><Swords size={30}/></div>
      <div><span className="pill">First game mode</span><h2>Boss Battle</h2><p>Correct answers deal damage. Build a streak for stronger attacks. Three mistakes and the boss wins.</p></div>
      <button className="primary-button game-start" disabled={!sourceText} onClick={startGame}><Play size={18}/> Build my game</button>
    </div>
    {message && <p className="game-warning">{message}</p>}
  </section>;

  if (stage === "results") {
    const won = bossHp <= 0 || hearts > 0;
    return <section className="battle-shell results-shell">
      <div className="results-card">
        <Trophy size={46}/><p className="eyebrow">Battle complete</p><h1>{won ? "You cleared the challenge!" : "The boss got you this time."}</h1>
        <div className="result-stats"><div><strong>{score}</strong><span>Score</span></div><div><strong>{Math.max(0, hearts)}</strong><span>Hearts left</span></div><div><strong>{questions.length}</strong><span>Questions</span></div></div>
        <p>{title} · {subject}</p>
        <div className="form-actions centered"><button className="secondary-button" onClick={() => setStage("setup")}><BookOpen size={17}/> New material</button><button className="primary-button" onClick={startGame}><RotateCcw size={17}/> Play again</button></div>
      </div>
    </section>;
  }

  const isCorrect = picked?.toLowerCase() === current?.answer.toLowerCase();
  return <section className="battle-shell">
    <div className="battle-topbar">
      <div><span className="pill">{subject}</span><strong>{title}</strong></div>
      <div className="battle-stats"><span><Heart size={18}/> {hearts}</span><span><Sparkles size={18}/> {streak}x</span><span>{score} pts</span></div>
    </div>

    <div className="boss-zone">
      <div className="boss-avatar"><Swords size={46}/></div>
      <strong>REVISION BOSS</strong>
      <div className="boss-health"><span style={{ width: `${bossHp / 10}%` }}/></div>
      <small>{bossHp} HP</small>
    </div>

    <article className="question-card">
      <div className="question-meta"><span>Question {index + 1} / {questions.length}</span><span>Fill the missing idea</span></div>
      <h2>{current?.prompt}</h2>
      <div className="choice-grid">{current?.choices.map(choice => {
        const chosen = picked === choice;
        const correctChoice = picked && choice.toLowerCase() === current.answer.toLowerCase();
        const cls = correctChoice ? "choice correct" : chosen ? "choice wrong" : "choice";
        return <button disabled={!!picked} className={cls} key={choice} onClick={() => answer(choice)}>{choice}</button>;
      })}</div>
      {picked && <div className={isCorrect ? "answer-feedback correct" : "answer-feedback wrong"}><strong>{isCorrect ? "Direct hit!" : `Correct answer: ${current.answer}`}</strong><span>{current.explanation}</span><button className="primary-button" onClick={next}>{bossHp <= 0 || hearts <= 0 || index >= questions.length - 1 ? "See results" : "Next attack"}</button></div>}
    </article>
  </section>;
}
