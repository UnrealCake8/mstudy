"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { DrivePickerButton } from "@/components/drive-picker-button";
import { subscribeCollection } from "@/lib/data";
import {
  exportPracticePaperPdf,
  PracticePaper,
} from "@/lib/export-practice-paper-pdf";

type DriveStudyFile = {
  id: string;
  title: string;
  extractedText?: string;
  mimeType?: string;
};

export function PracticePaperPage() {
  const { user } = useAuth();
  const [driveFiles, setDriveFiles] = useState<DriveStudyFile[]>([]);
  const [driveId, setDriveId] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");
  const [paper, setPaper] = useState<PracticePaper | null>(null);
  const [form, setForm] = useState({
    title: "",
    level: "GCSE",
    examBoard: "Not specified",
    subject: "",
    topic: "",
    tier: "Not specified",
    difficulty: "Mixed",
    durationMinutes: 60,
    totalMarks: 50,
    questionCount: 10,
    customPrompt: "",
  });

  useEffect(
    () =>
      user
        ? subscribeCollection<DriveStudyFile>(
            user.uid,
            "driveStudyFiles",
            setDriveFiles,
            { orderByCreatedAt: false },
          )
        : undefined,
    [user],
  );
  const selectedFile = useMemo(
    () => driveFiles.find((file) => file.id === driveId),
    [driveFiles, driveId],
  );
  const update = (key: keyof typeof form, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    setPaper(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/practice-papers/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          sourceTitle: selectedFile?.title,
          sourceText: selectedFile?.extractedText || "",
        }),
      });
      const data = (await response.json()) as {
        paper?: PracticePaper;
        error?: string;
      };
      if (!response.ok || !data.paper)
        throw new Error(
          data.error || "MPlace Study could not generate the paper.",
        );
      setPaper(data.paper);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "MPlace Study could not generate the paper.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!paper) return;
    setPdfBusy(true);
    setError("");
    try {
      await exportPracticePaperPdf(
        paper,
        form.subject || "Practice",
        form.level,
      );
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "The PDF could not be created.",
      );
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section className="page practice-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">AI revision tool</p>
          <h1>Practice paper builder</h1>
          <p>
            Create an original British-curriculum practice paper and printable
            mark scheme using MPlace Study&apos;s existing AI configuration.
          </p>
        </div>
      </div>
      <div className="practice-disclaimer">
        <FileText size={19} />
        <div>
          <strong>Practice material, not an official paper</strong>
          <p>
            Choose the exact qualification, subject and specification area. A
            named exam board guides style only; MPlace Study does not claim
            endorsement or reproduce past papers.
          </p>
        </div>
      </div>
      <form className="practice-form panel" onSubmit={generate}>
        <label>
          Paper title
          <input
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="e.g. Year 10 Biology revision"
          />
        </label>
        <label>
          Level or qualification
          <select
            value={form.level}
            onChange={(event) => update("level", event.target.value)}
          >
            {["KS2", "KS3", "GCSE", "IGCSE", "AS Level", "A Level"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Exam board
          <select
            value={form.examBoard}
            onChange={(event) => update("examBoard", event.target.value)}
          >
            {[
              "Not specified",
              "AQA",
              "Pearson Edexcel",
              "OCR",
              "Cambridge",
              "WJEC / Eduqas",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <input
            required
            value={form.subject}
            onChange={(event) => update("subject", event.target.value)}
            placeholder="e.g. Biology"
          />
        </label>
        <label className="practice-wide">
          Topic or specification area
          <input
            value={form.topic}
            onChange={(event) => update("topic", event.target.value)}
            placeholder="e.g. Cell biology: microscopy and mitosis"
          />
        </label>
        <label>
          Tier
          <select
            value={form.tier}
            onChange={(event) => update("tier", event.target.value)}
          >
            {["Not specified", "Foundation", "Higher"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select
            value={form.difficulty}
            onChange={(event) => update("difficulty", event.target.value)}
          >
            {["Mixed", "Accessible", "Standard", "Challenging"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Duration (minutes)
          <input
            type="number"
            min="15"
            max="180"
            value={form.durationMinutes}
            onChange={(event) =>
              update("durationMinutes", Number(event.target.value))
            }
          />
        </label>
        <label>
          Total marks
          <input
            type="number"
            min="10"
            max="100"
            value={form.totalMarks}
            onChange={(event) =>
              update("totalMarks", Number(event.target.value))
            }
          />
        </label>
        <label>
          Number of questions
          <input
            type="number"
            min="5"
            max="20"
            value={form.questionCount}
            onChange={(event) =>
              update("questionCount", Number(event.target.value))
            }
          />
        </label>
        <div className="practice-drive practice-wide">
          <label>
            Authorized Google Drive source
            <select
              value={driveId}
              onChange={(event) => setDriveId(event.target.value)}
            >
              <option value="">No Drive source</option>
              {driveFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.title}
                  {file.extractedText ? "" : " (no readable text)"}
                </option>
              ))}
            </select>
          </label>
          <DrivePickerButton />
        </div>
        <label className="practice-wide">
          Detailed instructions or a prompt from ChatGPT
          <textarea
            rows={7}
            value={form.customPrompt}
            onChange={(event) => update("customPrompt", event.target.value)}
            placeholder="Paste a detailed paper brief here, including topics, learning objectives, question balance or accessibility requirements."
          />
        </label>
        {selectedFile && !selectedFile.extractedText ? (
          <p className="practice-warning practice-wide">
            This Drive file has no extracted text. Authorize a supported Google
            Doc, PDF, Word file or plain-text file, or continue without it.
          </p>
        ) : null}
        {error ? (
          <p className="practice-error practice-wide" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions practice-wide">
          <button className="primary-button" type="submit" disabled={busy}>
            <Sparkles size={17} />
            {busy ? "Building paper…" : "Generate practice paper"}
          </button>
        </div>
      </form>
      {paper ? (
        <section className="practice-result panel">
          <div className="page-head">
            <div>
              <p className="eyebrow">Generated paper</p>
              <h2>{paper.title}</h2>
              <p>
                {paper.durationMinutes} minutes · {paper.totalMarks} marks ·{" "}
                {paper.questions.length} questions
              </p>
            </div>
            <button
              className="primary-button"
              onClick={download}
              disabled={pdfBusy}
            >
              <Download size={17} />
              {pdfBusy ? "Creating PDF…" : "Print / save as PDF"}
            </button>
          </div>
          <div className="practice-note">
            <strong>Alignment note</strong>
            <p>{paper.curriculumNote}</p>
          </div>
          <ol className="practice-questions">
            {paper.questions.map((question) => (
              <li key={question.number}>
                <div>
                  <p>{question.question}</p>
                  {question.options.length ? (
                    <ol type="A">
                      {question.options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ol>
                  ) : null}
                </div>
                <strong>
                  {question.marks} mark{question.marks === 1 ? "" : "s"}
                </strong>
              </li>
            ))}
          </ol>
          <details>
            <summary>Preview mark scheme</summary>
            {paper.questions.map((question) => (
              <article className="practice-answer" key={question.number}>
                <strong>
                  {question.number}. {question.answer}
                </strong>
                <ul>
                  {question.markScheme.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </details>
        </section>
      ) : null}
    </section>
  );
}
