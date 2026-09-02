"use client";

export type PracticeQuestion = {
  number: number;
  type: "short" | "structured" | "extended" | "multiple_choice";
  question: string;
  marks: number;
  options: string[];
  answer: string;
  markScheme: string[];
};
export type PracticePaper = {
  title: string;
  instructions: string[];
  durationMinutes: number;
  totalMarks: number;
  curriculumNote: string;
  questions: PracticeQuestion[];
};
declare global {
  interface Window {
    jspdf?: { jsPDF: new (options?: Record<string, unknown>) => any };
  }
}
function ascii(text: string) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/[^\x20-\x7E\n]/g, "");
}
function safe(value: string) {
  return (
    ascii(value)
      .replace(/[^a-z0-9 _-]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "practice-paper"
  );
}
async function jsPdf() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mstudy-jspdf="true"]',
    );
    if (existing) {
      if (window.jspdf?.jsPDF) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("PDF exporter could not load.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    script.dataset.mstudyJspdf = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PDF exporter could not load."));
    document.head.appendChild(script);
  });
  if (!window.jspdf?.jsPDF) throw new Error("PDF exporter could not start.");
  return window.jspdf.jsPDF;
}
export async function exportPracticePaperPdf(
  paper: PracticePaper,
  subject: string,
  level: string,
) {
  const JsPDF = await jsPdf(),
    pdf = new JsPDF({ unit: "pt", format: "a4" }),
    width = pdf.internal.pageSize.getWidth(),
    height = pdf.internal.pageSize.getHeight(),
    margin = 48,
    usable = width - margin * 2;
  let y = 52;
  function page(space = 30) {
    if (y + space <= height - margin) return;
    pdf.addPage();
    y = 52;
  }
  function block(text: string, size = 10, gap = 7, bold = false) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(ascii(text), usable),
      lineHeight = size * 1.35;
    page(lines.length * lineHeight + gap);
    pdf.text(lines, margin, y);
    y += lines.length * lineHeight + gap;
  }
  block(paper.title, 20, 4, true);
  block(
    `${subject} · ${level} · ${paper.durationMinutes} minutes · ${paper.totalMarks} marks`,
    10,
    14,
  );
  block(
    "Name: ____________________________________    Date: _______________",
    10,
    14,
  );
  paper.instructions.forEach((item) => block(`- ${item}`, 9, 3));
  y += 8;
  paper.questions.forEach((question, index) => {
    block(`${index + 1}. ${question.question}`, 11, 5, true);
    if (question.options?.length)
      question.options.forEach((option, i) =>
        block(`${String.fromCharCode(65 + i)}. ${option}`, 10, 3),
      );
    block(`[${question.marks} mark${question.marks === 1 ? "" : "s"}]`, 9, 8);
    const lines = Math.max(2, Math.min(10, question.marks + 1));
    page(lines * 18 + 10);
    pdf.setDrawColor(215);
    for (let line = 0; line < lines; line++)
      pdf.line(margin, y + line * 18, width - margin, y + line * 18);
    y += lines * 18 + 14;
  });
  pdf.addPage();
  y = 52;
  block("Mark scheme", 20, 5, true);
  block(`${paper.title} · ${paper.totalMarks} marks`, 10, 14);
  block(
    paper.curriculumNote || "Original MPlace Study practice material.",
    9,
    14,
  );
  paper.questions.forEach((question, index) => {
    block(`${index + 1}. ${question.answer}`, 11, 5, true);
    question.markScheme.forEach((point) => block(`- ${point}`, 9, 3));
    block(`Maximum: ${question.marks}`, 9, 12);
  });
  pdf.setProperties({
    title: ascii(paper.title),
    subject: ascii(`${subject} ${level}`),
    creator: "MPlace Study",
  });
  pdf.save(`${safe(paper.title)}.pdf`);
}
