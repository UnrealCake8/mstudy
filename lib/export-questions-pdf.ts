"use client";

type ExportQuestion = {
  type: "mcq" | "written";
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
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

function safeFileName(value: string) {
  return ascii(value).replace(/[^a-z0-9 _-]/gi, "").trim().replace(/\s+/g, "-").slice(0, 60) || "mstudy-questions";
}

async function loadJsPdf() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-mstudy-jspdf="true"]');
    if (existing) {
      if (window.jspdf?.jsPDF) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("PDF exporter could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    script.defer = true;
    script.dataset.mstudyJspdf = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PDF exporter could not be loaded."));
    document.head.appendChild(script);
  });
  if (!window.jspdf?.jsPDF) throw new Error("PDF exporter could not start.");
  return window.jspdf.jsPDF;
}

export async function exportQuestionsPdf(options: {
  title: string;
  subject: string;
  questions: ExportQuestion[];
}) {
  const JsPDF = await loadJsPdf();
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const usableWidth = pageWidth - margin * 2;
  let y = 56;

  function ensureSpace(height = 28) {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = 56;
  }

  function textBlock(text: string, size = 11, gap = 8, bold = false) {
    const cleaned = ascii(text);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(cleaned, usableWidth);
    const lineHeight = size * 1.35;
    ensureSpace(lines.length * lineHeight + gap);
    pdf.text(lines, margin, y);
    y += lines.length * lineHeight + gap;
  }

  textBlock(options.title || "MStudy Questions", 20, 5, true);
  textBlock(options.subject || "Study material", 11, 16, false);
  pdf.setDrawColor(210);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 18;
  textBlock("Questions", 15, 14, true);

  options.questions.forEach((question, index) => {
    textBlock(`${index + 1}. ${question.prompt}`, 11, 6, true);
    if (question.type === "mcq") {
      question.choices.forEach((choice, choiceIndex) => {
        textBlock(`${String.fromCharCode(65 + choiceIndex)}. ${choice}`, 10, 3, false);
      });
      y += 6;
    } else {
      ensureSpace(56);
      pdf.setDrawColor(210);
      for (let line = 0; line < 3; line += 1) {
        pdf.line(margin, y + line * 18, pageWidth - margin, y + line * 18);
      }
      y += 62;
    }
  });

  pdf.addPage();
  y = 56;
  textBlock("Answer key", 18, 14, true);
  options.questions.forEach((question, index) => {
    textBlock(`${index + 1}. ${question.answer}`, 11, 5, true);
    if (question.explanation) textBlock(`Explanation: ${question.explanation}`, 9, 12, false);
  });

  pdf.setProperties({ title: ascii(options.title || "MStudy Questions"), subject: ascii(options.subject || "Study material"), creator: "MStudy" });
  pdf.save(`${safeFileName(options.title)}-questions.pdf`);
}
