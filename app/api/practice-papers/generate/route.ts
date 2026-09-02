import { NextResponse } from "next/server";
import { reserveAIGameQuota } from "@/lib/ai-rate-limit";

type RequestBody = {
  title?: string;
  level?: string;
  examBoard?: string;
  subject?: string;
  topic?: string;
  tier?: string;
  difficulty?: string;
  durationMinutes?: number;
  totalMarks?: number;
  questionCount?: number;
  customPrompt?: string;
  sourceText?: string;
  sourceTitle?: string;
};
const questionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    number: { type: "integer" },
    type: {
      type: "string",
      enum: ["short", "structured", "extended", "multiple_choice"],
    },
    question: { type: "string" },
    marks: { type: "integer", minimum: 1, maximum: 20 },
    options: { type: "array", maxItems: 4, items: { type: "string" } },
    answer: { type: "string" },
    markScheme: { type: "array", items: { type: "string" } },
  },
  required: [
    "number",
    "type",
    "question",
    "marks",
    "options",
    "answer",
    "markScheme",
  ],
};
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    instructions: { type: "array", items: { type: "string" } },
    durationMinutes: { type: "integer" },
    totalMarks: { type: "integer" },
    curriculumNote: { type: "string" },
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 20,
      items: questionSchema,
    },
  },
  required: [
    "title",
    "instructions",
    "durationMinutes",
    "totalMarks",
    "curriculumNote",
    "questions",
  ],
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json(
      {
        error:
          "Practice-paper generation is not configured on this deployment.",
      },
      { status: 503 },
    );
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body?.subject?.trim() && !body?.customPrompt?.trim())
    return NextResponse.json(
      { error: "Enter a subject or paste a detailed paper prompt." },
      { status: 400 },
    );
  let quota;
  try {
    quota = await reserveAIGameQuota(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "AUTH_REQUIRED"
            ? "Sign in again before generating a paper."
            : "MPlace Study could not check your daily AI limit.",
      },
      { status: 401 },
    );
  }
  if (!quota.allowed)
    return NextResponse.json(
      {
        error: `You have reached today's AI generation limit of ${quota.limit}.`,
        usage: quota,
      },
      { status: 429 },
    );
  const requestedMarks = Math.min(
      100,
      Math.max(10, Number(body.totalMarks) || 50),
    ),
    requestedQuestions = Math.min(
      20,
      Math.max(5, Number(body.questionCount) || 10),
    ),
    source = (body.sourceText || "").trim().slice(0, 30000),
    custom = (body.customPrompt || "").trim().slice(0, 6000);
  const prompt = [
    "You are an expert British-curriculum assessment writer creating an original student practice paper and mark scheme.",
    `Level or qualification: ${body.level || "Not specified"}`,
    `Exam board: ${body.examBoard || "Not specified"}`,
    `Subject: ${body.subject || "Not specified"}`,
    `Topic or specification area: ${body.topic || "Not specified"}`,
    `Tier: ${body.tier || "Not specified"}`,
    `Difficulty: ${body.difficulty || "Mixed"}`,
    `Requested duration: ${Math.min(180, Math.max(15, Number(body.durationMinutes) || 60))} minutes`,
    `Requested total marks: ${requestedMarks}`,
    `Requested question count: ${requestedQuestions}`,
    custom ? `STUDENT'S PAPER INSTRUCTIONS:\n${custom}` : "",
    "Use terminology, command words, depth and mathematical/scientific conventions appropriate to the stated British level. If an exam board is named, imitate the general skills and structure but do not claim this is an official or endorsed paper and do not copy protected past-paper questions.",
    source
      ? "Use the supplied source as the factual ground truth. Do not test unsupported facts outside it unless the student's explicit prompt asks for broader curriculum knowledge."
      : "Use well-established curriculum knowledge. If the details are too vague, create a balanced diagnostic paper and state the assumptions in curriculumNote.",
    "Ensure marks awarded across questions add up EXACTLY to totalMarks. Include realistic space-appropriate short, structured and extended questions. Use multiple choice only when educationally useful.",
    "For every question provide a concise model answer and point-by-point mark scheme. options must be empty unless type is multiple_choice.",
    source
      ? `AUTHORISED SOURCE (${body.sourceTitle || "Drive file"}):\n${source}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-nano",
        reasoning: { effort: "medium" },
        max_output_tokens: 7500,
        input: prompt,
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "british_practice_paper",
            strict: true,
            schema,
          },
        },
      }),
    });
    const data = (await response.json().catch(() => null)) as any;
    if (!response.ok)
      return NextResponse.json(
        {
          error: data?.error?.message || "OpenAI could not generate the paper.",
          usage: quota,
        },
        { status: response.status },
      );
    const outputText = data?.output
      ?.flatMap((item: any) => item?.content || [])
      ?.find((item: any) => item?.type === "output_text")?.text;
    if (!outputText)
      return NextResponse.json(
        { error: "OpenAI returned no usable paper.", usage: quota },
        { status: 502 },
      );
    const paper = JSON.parse(outputText);
    if (!Array.isArray(paper.questions) || paper.questions.length < 5)
      return NextResponse.json(
        { error: "OpenAI returned an incomplete paper.", usage: quota },
        { status: 502 },
      );
    const marks = paper.questions.reduce(
      (sum: number, item: { marks?: number }) => sum + Number(item.marks || 0),
      0,
    );
    paper.totalMarks = marks;
    return NextResponse.json({ paper, usage: quota });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      return NextResponse.json(
        {
          error:
            "Paper generation took too long. Try fewer questions or a shorter source file.",
          usage: quota,
        },
        { status: 504 },
      );
    console.error("Practice-paper generation failed", error);
    return NextResponse.json(
      { error: "Practice-paper generation failed.", usage: quota },
      { status: 500 },
    );
  }
}
