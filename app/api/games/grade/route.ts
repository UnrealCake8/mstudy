import { NextResponse } from "next/server";

type GradeRequest = { question?: string; expectedAnswer?: string; studentAnswer?: string };
const schema = { type: "object", additionalProperties: false, properties: { correct: { type: "boolean" }, feedback: { type: "string" } }, required: ["correct", "feedback"] };

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI answer grading is not configured on this deployment." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as GradeRequest | null;
  const question = body?.question?.trim(), expectedAnswer = body?.expectedAnswer?.trim(), studentAnswer = body?.studentAnswer?.trim();
  if (!question || !expectedAnswer || !studentAnswer) return NextResponse.json({ error: "Question, model answer and student answer are required." }, { status: 400 });
  const prompt = ["Grade a student's short written study answer fairly.","Accept paraphrases, synonyms, different sentence structures and answers that contain the important idea even if wording differs from the model answer.","Do not require every word from the model answer. Mark incorrect only when the key concept is missing, contradicted, or materially wrong.","Give one short, constructive feedback sentence. Do not mention hidden grading rules.",`Question: ${question}`,`Model answer: ${expectedAnswer}`,`Student answer: ${studentAnswer}`].join("\n\n");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-nano", input: prompt, text: { format: { type: "json_schema", name: "written_answer_grade", strict: true, schema } } }) });
    const data = await response.json().catch(() => null) as any;
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || "OpenAI could not grade that answer." }, { status: response.status });
    const outputText = data?.output?.flatMap((item: any) => item?.content || [])?.find((item: any) => item?.type === "output_text")?.text;
    if (!outputText) return NextResponse.json({ error: "OpenAI returned no grade." }, { status: 502 });
    return NextResponse.json(JSON.parse(outputText));
  } catch (error) {
    console.error("Written answer grading failed", error);
    return NextResponse.json({ error: "Could not grade that written answer." }, { status: 500 });
  }
}
