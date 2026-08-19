import { NextResponse } from "next/server";
import { reserveAIGameQuota } from "@/lib/ai-rate-limit";

type QuestionMode = "mcq" | "written" | "mixed";
type GenerateRequest = { title?: string; subject?: string; text?: string; questionMode?: QuestionMode };

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      minItems: 6,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["mcq", "written"] },
          prompt: { type: "string" },
          choices: { type: "array", maxItems: 4, items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["type", "prompt", "choices", "answer", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI question generation is not configured on this deployment." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as GenerateRequest | null;
  const text = body?.text?.trim();
  if (!text || text.length < 80) return NextResponse.json({ error: "Not enough study material to generate a game." }, { status: 400 });

  let quota: { allowed: boolean; limit: number; used: number; remaining: number };
  try {
    quota = await reserveAIGameQuota(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "AUTH_REQUIRED") return NextResponse.json({ error: "Sign in again before using AI Study Games." }, { status: 401 });
    return NextResponse.json({ error: "MStudy could not check your daily AI limit. Try again in a moment." }, { status: 503 });
  }
  if (!quota.allowed) {
    return NextResponse.json({
      error: `You have reached today's AI Study Game limit of ${quota.limit}. You can still build games with AI turned off, and your AI allowance resets tomorrow.`,
      usage: quota,
    }, { status: 429 });
  }

  const questionMode: QuestionMode = body?.questionMode === "mcq" || body?.questionMode === "written" ? body.questionMode : "mixed";
  const modeInstruction = questionMode === "mcq"
    ? "Generate ONLY multiple-choice questions. Every question must have type=mcq and exactly four choices."
    : questionMode === "written"
      ? "Generate ONLY written free-response questions. Every question must have type=written and choices must be an empty array."
      : "Use a useful mix of multiple-choice and written free-response questions, aiming for roughly half of each when the material supports it.";

  const material = text.slice(0, 24000);
  const prompt = [
    "You are generating revision questions from extracted study-document content.",
    `Display title (metadata only): ${body?.title || "Study challenge"}`,
    `Subject label (metadata only): ${body?.subject || "General"}`,
    "Create 6 to 10 accurate revision questions using ONLY facts, ideas, arguments, definitions, examples, or explanations contained in STUDY CONTENT below.",
    modeInstruction,
    "For type=mcq: provide exactly four distinct choices and make answer exactly match one choice.",
    "For type=written: choices MUST be an empty array. The answer should be a concise model answer containing the key facts a student should mention.",
    "Written questions should usually be answerable in one or two sentences, not essays.",
    "The display title, filename, class name, course name, subject label, source type, and attachment name are NOT study facts. Never ask about those labels unless explicitly stated in the study content itself.",
    "Questions should test understanding of the actual document content, not metadata or formatting.",
    "Prefer meaningful comprehension questions over fill-in-the-blank wording when the content supports them.",
    "Explanations should be short and grounded directly in the study content.",
    "Do not invent facts that are not supported by the study content.",
    "STUDY CONTENT:", material,
  ].join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-nano",
        reasoning: { effort: "minimal" },
        max_output_tokens: 2600,
        input: prompt,
        text: {
          verbosity: "low",
          format: { type: "json_schema", name: "study_game_questions", strict: true, schema },
        },
      }),
    });

    const data = await response.json().catch(() => null) as any;
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || "OpenAI could not generate questions.", usage: quota }, { status: response.status });
    const outputText = data?.output?.flatMap((item: any) => item?.content || [])?.find((item: any) => item?.type === "output_text")?.text;
    if (!outputText) return NextResponse.json({ error: "OpenAI returned no usable question set.", usage: quota }, { status: 502 });

    const parsed = JSON.parse(outputText) as { questions?: Array<{ type?: string; choices?: string[] }> };
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 4) return NextResponse.json({ error: "OpenAI returned an incomplete question set.", usage: quota }, { status: 502 });

    parsed.questions = parsed.questions.map(question => {
      if (questionMode === "written") return { ...question, type: "written", choices: [] };
      if (questionMode === "mcq") return { ...question, type: "mcq", choices: Array.isArray(question.choices) ? question.choices.slice(0, 4) : [] };
      return question.type === "written"
        ? { ...question, choices: [] }
        : { ...question, type: "mcq", choices: Array.isArray(question.choices) ? question.choices.slice(0, 4) : [] };
    });

    return NextResponse.json({ ...parsed, usage: quota });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json({ error: "AI generation took too long, so MStudy will use its built-in generator instead.", usage: quota }, { status: 504 });
    }
    console.error("AI game generation failed", error);
    return NextResponse.json({ error: "AI question generation failed. Try again or use the local generator.", usage: quota }, { status: 500 });
  }
}
