"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Bot, ExternalLink, FileText, FolderOpen, Gamepad2, GraduationCap, Heart, ImagePlus, Play, RotateCcw, Sparkles, Swords, Trophy, WandSparkles, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, Note, subscribeCollection } from "@/lib/data";
import type { ClassroomAssignment, ClassroomCourse, ClassroomResource } from "@/lib/classroom";

type Question = { id: string; type: "mcq" | "written"; prompt: string; choices: string[]; answer: string; explanation: string };
type QuestionMode = "mcq" | "written" | "mixed";
type Stage = "setup" | "battle" | "results";
type SourceKind = "note" | "assignment" | "resource" | "drive" | "text";
type DriveStudyFile = { id: string; title: string; url?: string; mimeType?: string; extractedText?: string };
type WrittenGrade = { correct: boolean; feedback: string };

const BOSS_IMAGE_KEY = "mstudy:boss-image";
const BOSS_NAME_KEY = "mstudy:boss-name";
const STOP = new Set(["about","after","again","against","because","before","being","between","could","during","every","first","from","have","into","other","should","their","there","these","they","this","those","through","under","using","very","were","what","when","where","which","while","with","would","your"]);

function cleanWord(word: string) { return word.replace(/[^A-Za-z0-9'-]/g, "").trim(); }
function shuffle<T>(items: T[]) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
function generateQuestions(text: string, mode: QuestionMode): Question[] {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 35);
  const pool = Array.from(new Set(text.split(/\s+/).map(cleanWord).filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()))));
  const questions: Question[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).map(cleanWord).filter(Boolean);
    const candidates = words.filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()));
    if (!candidates.length) continue;
    const answerWord = candidates[Math.floor(candidates.length / 2)];
    const shouldWrite = mode === "written" || (mode === "mixed" && questions.length % 2 === 1);
    if (shouldWrite) {
      questions.push({ id: `${questions.length}-written`, type: "written", prompt: `Explain the main idea in this statement: “${sentence}”`, choices: [], answer: sentence, explanation: sentence });
    } else {
      const distractors = shuffle(pool.filter(w => w.toLowerCase() !== answerWord.toLowerCase())).slice(0, 3);
      if (distractors.length < 3) continue;
      const escaped = answerWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      questions.push({ id: `${questions.length}-${answerWord}`, type: "mcq", prompt: sentence.replace(new RegExp(`\\b${escaped}\\b`, "i"), "_____"), choices: shuffle([answerWord, ...distractors]), answer: answerWord, explanation: sentence });
    }
    if (questions.length >= 10) break;
  }
  return questions;
}

function extractedMaterialText(materials?: { extractedText?: string }[]) {
  return (materials || []).map(m => m.extractedText?.trim() || "").filter(Boolean).join("\n\n").trim();
}

function simpleWrittenFallback(studentAnswer: string, expected: string) {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const student = normalise(studentAnswer);
  const model = normalise(expected);
  if (!student || !model) return false;
  if (student === model || student.includes(model) || model.includes(student)) return true;
  const keywords = model.split(" ").filter(word => word.length >= 5 && !STOP.has(word));
  if (!keywords.length) return false;
  const hits = keywords.filter(word => student.includes(word)).length;
  return hits / keywords.length >= 0.65;
}

export function PlayPage() {
  const { user } = useAuth();
  const search = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [resources, setResources] = useState<ClassroomResource[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveStudyFile[]>([]);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState("");
  const [selectedResourceKey, setSelectedResourceKey] = useState("");
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [stage, setStage] = useState<Stage>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionMode, setQuestionMode] = useState<QuestionMode>("mixed");
  const [index, setIndex] = useState(0);
  const [bossHp, setBossHp] = useState(1000);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [writtenGrade, setWrittenGrade] = useState<WrittenGrade | null>(null);
  const [grading, setGrading] = useState(false);
  const [message, setMessage] = useState("");
  const [building, setBuilding] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [bossImage, setBossImage] = useState("");
  const [bossName, setBossName] = useState("Revision Boss");
  const savedRun = useRef(false);

  useEffect(() => user ? subscribeCollection<Note>(user.uid, "notes", setNotes) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomAssignment>(user.uid, "classroomAssignments", setAssignments, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomResource>(user.uid, "classroomResources", setResources, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<DriveStudyFile>(user.uid, "driveStudyFiles", setDriveFiles, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => user ? subscribeCollection<ClassroomCourse>(user.uid, "classroomCourses", setCourses, { orderByCreatedAt: false }) : undefined, [user]);
  useEffect(() => { try { setBossImage(localStorage.getItem(BOSS_IMAGE_KEY) || ""); setBossName(localStorage.getItem(BOSS_NAME_KEY) || "Revision Boss"); } catch {} }, []);
  useEffect(() => {
    const note = search.get("note"), assignment = search.get("assignment"), resource = search.get("resource"), drive = search.get("drive"), course = search.get("course");
    if (note) setSelectedNoteId(note);
    if (assignment && course) setSelectedAssignmentKey(`${course}:${assignment}`);
    if (resource && course) setSelectedResourceKey(`${course}:${resource}`);
    if (drive) setSelectedDriveId(drive);
  }, [search]);

  const courseNames = useMemo(() => new Map(courses.map(c => [c.id, c.name])), [courses]);
  const selectedNote = useMemo(() => notes.find(n => n.id === selectedNoteId), [notes, selectedNoteId]);
  const selectedAssignment = useMemo(() => assignments.find(a => `${a.courseId}:${a.id}` === selectedAssignmentKey), [assignments, selectedAssignmentKey]);
  const selectedResource = useMemo(() => resources.find(r => `${r.courseId}:${r.id}` === selectedResourceKey), [resources, selectedResourceKey]);
  const selectedDrive = useMemo(() => driveFiles.find(f => f.id === selectedDriveId), [driveFiles, selectedDriveId]);

  const assignmentMaterial = extractedMaterialText(selectedAssignment?.materials);
  const resourceMaterial = extractedMaterialText(selectedResource?.materials);
  const assignmentText = selectedAssignment ? (assignmentMaterial || selectedAssignment.description?.trim() || "") : "";
  const resourceText = selectedResource ? (resourceMaterial || selectedResource.description?.trim() || "") : "";
  const sourceText = selectedNote?.content?.trim() || selectedDrive?.extractedText?.trim() || assignmentText || resourceText || pastedText.trim();
  const title = selectedNote?.title || selectedDrive?.title || selectedAssignment?.title || selectedResource?.title || "Custom study challenge";
  const sourceCourseId = selectedAssignment?.courseId || selectedResource?.courseId;
  const subject = selectedNote?.subject || (sourceCourseId ? courseNames.get(sourceCourseId) : "") || (selectedDrive ? "Drive file" : "Study material");
  const sourceType: SourceKind = selectedNote ? "note" : selectedDrive ? "drive" : selectedAssignment ? "assignment" : selectedResource ? "resource" : "text";
  const sourceId = selectedNote?.id || selectedDrive?.id || (selectedAssignment ? `${selectedAssignment.courseId}:${selectedAssignment.id}` : selectedResource ? `${selectedResource.courseId}:${selectedResource.id}` : null);
  const current = questions[index];
  const hasAnswered = current?.type === "written" ? Boolean(writtenGrade) : Boolean(picked);
  const currentCorrect = current?.type === "written" ? Boolean(writtenGrade?.correct) : Boolean(picked && current && picked.toLowerCase() === current.answer.toLowerCase());

  useEffect(() => {
    if (stage !== "results" || savedRun.current || !user) return;
    savedRun.current = true;
    void addItem(user.uid, "studyGames", { title, subject, gameType: "boss", sourceType, sourceId, score, accuracy: answeredCount ? Math.round(correctCount / answeredCount * 100) : 0, completed: true, usedAI: aiEnabled, questionMode });
  }, [stage, user, title, subject, sourceType, sourceId, score, answeredCount, correctCount, aiEnabled, questionMode]);

  function resetSources(kind: SourceKind) {
    if (kind !== "note") setSelectedNoteId("");
    if (kind !== "assignment") setSelectedAssignmentKey("");
    if (kind !== "resource") setSelectedResourceKey("");
    if (kind !== "drive") setSelectedDriveId("");
    if (kind !== "text") setPastedText("");
  }

  async function uploadBossImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Choose an image file for your boss."); return; }
    if (file.size > 900000) { setMessage("Keep boss images under 900 KB so they can stay safely in this browser."); return; }
    const reader = new FileReader();
    reader.onload = () => { const value = typeof reader.result === "string" ? reader.result : ""; if (!value) return; try { localStorage.setItem(BOSS_IMAGE_KEY, value); setBossImage(value); setMessage(""); } catch { setMessage("This browser does not have enough local storage for that image. Try a smaller one."); } };
    reader.readAsDataURL(file);
  }
  function changeBossName(value: string) { const next = value.slice(0, 32); setBossName(next); try { localStorage.setItem(BOSS_NAME_KEY, next || "Revision Boss"); } catch {} }
  function removeBossImage() { setBossImage(""); try { localStorage.removeItem(BOSS_IMAGE_KEY); } catch {} }

  async function startGame() {
    if (sourceText.length < 80) { setMessage("MStudy needs actual readable study content. Authorise the Drive file again or choose a source with extracted text."); return; }
    setBuilding(true); setMessage(""); let generated: Question[] = [];
    if (aiEnabled) {
      try {
        const response = await fetch("/api/games/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, subject, text: sourceText, questionMode }) });
        const data = await response.json() as { questions?: Omit<Question, "id">[]; error?: string };
        if (!response.ok || !data.questions?.length) throw new Error(data.error || "AI generation failed.");
        generated = data.questions.map((q, i) => ({ ...q, type: q.type === "written" ? "written" : "mcq", choices: q.type === "written" ? [] : q.choices, id: `ai-${i}` }));
      } catch (error) {
        generated = generateQuestions(sourceText, questionMode);
        setMessage(`${error instanceof Error ? error.message : "AI generation failed."} Using the built-in generator instead.`);
      }
    } else generated = generateQuestions(sourceText, questionMode);
    setBuilding(false);
    if (generated.length < 4) { setMessage("MStudy could not make enough useful questions from the actual document text. Try another source or a longer file."); return; }
    setQuestions(generated); setIndex(0); setBossHp(1000); setHearts(3); setScore(0); setStreak(0); setCorrectCount(0); setAnsweredCount(0); setPicked(null); setWrittenAnswer(""); setWrittenGrade(null); savedRun.current = false; setStage("battle");
  }

  function applyResult(correct: boolean) {
    setAnsweredCount(v => v + 1);
    if (correct) { const nextStreak = streak + 1; const damage = Math.min(220, 110 + nextStreak * 15); setCorrectCount(v => v + 1); setStreak(nextStreak); setBossHp(h => Math.max(0, h - damage)); setScore(s => s + 100 + nextStreak * 20); }
    else { setStreak(0); setHearts(h => Math.max(0, h - 1)); }
  }
  function answer(choice: string) { if (picked || !current || current.type !== "mcq") return; setPicked(choice); applyResult(choice.toLowerCase() === current.answer.toLowerCase()); }
  async function submitWritten() {
    if (!current || current.type !== "written" || writtenGrade || grading || !writtenAnswer.trim()) return;
    setGrading(true); let grade: WrittenGrade;
    try {
      const response = await fetch("/api/games/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: current.prompt, expectedAnswer: current.answer, studentAnswer: writtenAnswer.trim() }) });
      const data = await response.json() as { correct?: boolean; feedback?: string; error?: string };
      if (!response.ok || typeof data.correct !== "boolean") throw new Error(data.error || "Could not grade answer.");
      grade = { correct: data.correct, feedback: data.feedback || (data.correct ? "Good answer." : "Review the model answer below.") };
    } catch {
      const correct = simpleWrittenFallback(writtenAnswer, current.answer);
      grade = { correct, feedback: correct ? "Your answer includes the key idea." : "Your answer is missing part of the key idea." };
    }
    setWrittenGrade(grade); applyResult(grade.correct); setGrading(false);
  }
  function next() { if (!hasAnswered) return; if (bossHp <= 0 || hearts <= 0 || index >= questions.length - 1) { setStage("results"); return; } setIndex(i => i + 1); setPicked(null); setWrittenAnswer(""); setWrittenGrade(null); }

  if (stage === "setup") return <section className="page play-page">
    <div className="page-head play-head"><div><p className="eyebrow">Study games</p><h1>Turn revision into a game.</h1><p>Use notes, Drive files, assignments, Classroom materials or pasted text, then customize who you fight.</p></div><div className="play-hero-icon"><Gamepad2 size={34}/></div></div>
    <div className="play-layout">
      <article className="play-panel"><div className="form-heading"><BookOpen size={20}/><div><strong>Use an MStudy note</strong><span>Your saved notes are ready to play.</span></div></div><div className="note-picker">{notes.length === 0 ? <div className="empty-state compact"><strong>No notes yet</strong></div> : notes.map(note => <button key={note.id} onClick={() => { resetSources("note"); setSelectedNoteId(note.id); }} className={selectedNoteId === note.id ? "source-card active" : "source-card"}><span className="pill">{note.subject || "General"}</span><strong>{note.title}</strong><small>{note.content?.slice(0, 90) || "No note text"}</small></button>)}</div></article>
      <article className="play-panel"><div className="form-heading"><FolderOpen size={20}/><div><strong>Use an authorised Drive file</strong><span>Uses the actual extracted document text, not the filename.</span></div></div><div className="note-picker">{driveFiles.length === 0 ? <div className="empty-state compact"><strong>No authorised Drive files</strong><span>Use Authorise Drive file on the Classroom page first.</span></div> : driveFiles.map(file => <button key={file.id} onClick={() => { resetSources("drive"); setSelectedDriveId(file.id); }} className={selectedDriveId === file.id ? "source-card active" : "source-card"}><span className="pill">Drive</span><strong>{file.title}</strong><small>{file.extractedText ? `${file.extractedText.slice(0, 100)}…` : "No readable text extracted"}</small></button>)}</div></article>
      <article className="play-panel"><div className="form-heading"><GraduationCap size={20}/><div><strong>Use a Classroom assignment</strong><span>Document text is used first; assignment instructions are only a fallback.</span></div></div><div className="note-picker">{assignments.length === 0 ? <div className="empty-state compact"><strong>No synced assignments</strong><span>Sync Classroom first.</span></div> : assignments.map(item => { const key = `${item.courseId}:${item.id}`; const readable = Boolean(extractedMaterialText(item.materials)); return <button key={key} onClick={() => { resetSources("assignment"); setSelectedAssignmentKey(key); }} className={selectedAssignmentKey === key ? "source-card active" : "source-card"}><span className="pill">{courseNames.get(item.courseId) || "Classroom"}</span><strong>{item.title}</strong><small>{readable ? "Actual attachment text ready" : item.description?.slice(0, 90) || "No readable content yet"}</small></button>; })}</div></article>
      <article className="play-panel"><div className="form-heading"><FileText size={20}/><div><strong>Use Classroom materials</strong><span>Readable document contents are used as the study source.</span></div></div><div className="note-picker">{resources.length === 0 ? <div className="empty-state compact"><strong>No class materials yet</strong></div> : resources.map(item => { const key = `${item.courseId}:${item.id}`; const readable = Boolean(extractedMaterialText(item.materials)); return <button key={key} onClick={() => { resetSources("resource"); setSelectedResourceKey(key); }} className={selectedResourceKey === key ? "source-card active" : "source-card"}><span className="pill">{courseNames.get(item.courseId) || "Classroom"}</span><strong>{item.title}</strong><small>{readable ? "Actual resource text ready" : item.description?.slice(0, 90) || "No readable content yet"}</small></button>; })}</div></article>
      <article className="play-panel"><div className="form-heading"><WandSparkles size={20}/><div><strong>Paste study material</strong><span>Great for revision sheets, textbook sections or class notes.</span></div></div><textarea className="study-input" rows={10} value={pastedText} onChange={e => { resetSources("text"); setPastedText(e.target.value); }} placeholder="Paste a few paragraphs of study material here…"/></article>
      {(selectedAssignment || selectedResource)?.materials?.length ? <article className="play-panel"><div className="form-heading"><FileText size={20}/><div><strong>Selected attachments</strong><span>Only attachments with extracted text are used to generate questions.</span></div></div><div className="classroom-materials">{(selectedAssignment?.materials || selectedResource?.materials || []).map((m, i) => <div key={`${m.id || m.url || m.title}-${i}`} className="material-row"><span><FileText size={15}/>{m.title}{m.extractedText ? " ✓ text ready" : " · not readable yet"}</span>{m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="text-button">Open <ExternalLink size={13}/></a> : null}</div>)}</div></article> : null}
      <article className="play-panel boss-customizer"><div className="form-heading"><ImagePlus size={20}/><div><strong>Customize your boss</strong><span>The image stays in this browser and is not uploaded to MStudy.</span></div></div><div className="boss-preview-row"><div className="boss-preview">{bossImage ? <img src={bossImage} alt="Custom boss"/> : <Swords size={30}/>}</div><div className="boss-fields"><label><span>Boss name</span><input value={bossName} onChange={e => changeBossName(e.target.value)} placeholder="Revision Boss"/></label><div className="boss-buttons"><label className="secondary-button upload-button"><ImagePlus size={16}/> Upload image<input type="file" accept="image/*" onChange={uploadBossImage}/></label>{bossImage ? <button className="secondary-button" onClick={removeBossImage}><X size={16}/> Remove</button> : null}</div></div></div></article>
    </div>

    <div className="game-mode-card"><div className="mode-art"><Swords size={30}/></div><div><span className="pill">Boss Battle</span><h2>{bossName || "Revision Boss"}</h2><p>Choose how you want to be tested, then fight the boss.</p><div className="form-actions"><button className={questionMode === "mcq" ? "primary-button" : "secondary-button"} onClick={() => setQuestionMode("mcq")}>MCQs only</button><button className={questionMode === "written" ? "primary-button" : "secondary-button"} onClick={() => setQuestionMode("written")}>Written only</button><button className={questionMode === "mixed" ? "primary-button" : "secondary-button"} onClick={() => setQuestionMode("mixed")}>Mixed</button></div><label className="ai-toggle"><input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)}/><Bot size={16}/><span><strong>Use OpenAI for better questions</strong><small>{questionMode === "mcq" ? "Generate multiple-choice questions only." : questionMode === "written" ? "Generate written questions only and grade answers for meaning." : "Generate a mix of MCQs and written questions."}</small></span></label></div><button className="primary-button game-start" disabled={!sourceText || building} onClick={startGame}><Play size={18}/>{building ? "Building…" : "Build my game"}</button></div>
    {message && <p className="game-warning">{message}</p>}
  </section>;

  if (stage === "results") {
    const accuracy = answeredCount ? Math.round(correctCount / answeredCount * 100) : 0;
    return <section className="battle-shell results-shell"><div className="results-card"><Trophy size={48}/><p className="eyebrow">Battle complete</p><h1>{bossHp <= 0 ? `${bossName || "The boss"} defeated!` : hearts <= 0 ? `${bossName || "The boss"} got you this time.` : "Round finished"}</h1><div className="result-stats"><div><strong>{score}</strong><span>Score</span></div><div><strong>{accuracy}%</strong><span>Accuracy</span></div><div><strong>{correctCount}/{answeredCount}</strong><span>Correct</span></div></div><div className="form-actions centered"><button className="secondary-button" onClick={() => { savedRun.current = false; setStage("setup"); }}><BookOpen size={17}/> Change material</button><button className="primary-button" onClick={startGame}><RotateCcw size={17}/> Play again</button></div></div></section>;
  }

  return <section className="battle-shell">
    <header className="battle-topbar"><div><button className="icon-button" onClick={() => setStage("setup")} aria-label="Exit battle"><X size={18}/></button><div><strong>{title}</strong><small>{subject}</small></div></div><div className="battle-stats"><span><Heart size={15}/> {hearts}</span><span><Sparkles size={15}/> x{streak}</span><span>{score} pts</span></div></header>
    <div className="boss-zone"><div className={`boss-avatar ${currentCorrect ? "boss-hit" : ""}`}>{bossImage ? <img src={bossImage} alt={bossName || "Custom boss"}/> : <Swords size={50}/>}</div><strong>{bossName || "REVISION BOSS"}</strong><div className="boss-health"><span style={{ width: `${bossHp / 10}%` }}/></div><small>{bossHp} HP</small></div>
    {current ? <article className="question-card"><div className="question-meta"><span>Question {index + 1} / {questions.length}</span><span>{current.type === "written" ? "Written" : "Multiple choice"}</span></div><h2>{current.prompt}</h2>
      {current.type === "mcq" ? <div className="choice-grid">{current.choices.map(choice => { const chosen = picked === choice; const isAnswer = choice.toLowerCase() === current.answer.toLowerCase(); return <button key={choice} disabled={Boolean(picked)} onClick={() => answer(choice)} className={`choice ${picked ? (isAnswer ? "correct" : chosen ? "wrong" : "") : ""}`}>{choice}</button>; })}</div> : <div className="written-question"><textarea className="study-input" rows={5} value={writtenAnswer} disabled={Boolean(writtenGrade) || grading} onChange={e => setWrittenAnswer(e.target.value)} placeholder="Write your answer in your own words…"/><button className="primary-button" disabled={!writtenAnswer.trim() || Boolean(writtenGrade) || grading} onClick={submitWritten}>{grading ? "Checking…" : "Submit answer"}</button></div>}
      {hasAnswered ? <div className={`answer-feedback ${currentCorrect ? "correct" : "wrong"}`}><strong>{currentCorrect ? "Direct hit!" : "Not quite."}</strong><span>{current.type === "written" ? writtenGrade?.feedback : current.explanation}</span>{current.type === "written" ? <span><strong>Model answer:</strong> {current.answer}</span> : null}<button className="primary-button" onClick={next}>{bossHp <= 0 || hearts <= 0 || index >= questions.length - 1 ? "See results" : "Next attack"}</button></div> : null}
    </article> : null}
  </section>;
}
