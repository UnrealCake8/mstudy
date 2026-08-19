import { NextResponse } from "next/server";

type GenerateRequest = {
  title?: string;
  subject?: string;
  text?: string;
};

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
          prompt: { type: "string" },
          choices: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" },
          },
          answer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["prompt", "choices", "answer", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI question generation is not configured on this deployment." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as GenerateRequest | null;
  const text = body?.text?.trim();
  if (!text || text.length < 80) {
    return NextResponse.json({ error: "Not enough study material to generate a game." }, { status: 400 });
  }

  const material = text.slice(0, 24000);
  const prompt = [
    `Title: ${body?.title || "Study challenge"}`,
    `Subject: ${body?.subject || "General"}`,
    "Create 6 to 10 accurate multiple-choice study questions using ONLY the study material below.",
    "Questions should test understanding rather than obscure wording. Avoid trick questions.",
    "Each question must have exactly four distinct choices. The answer must exactly match one of the choices.",
    "Explanations should be short, useful, and grounded in the supplied material.",
    "Do not invent facts that are not supported by the material.",
    "Study material:",
    material,
  ].join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-nano",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "study_game_questions",
            strict: true,
            schema,
          },
        },
      }),
    });

    const data = await response.json().catch(() => null) as any;
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message || "OpenAI could not generate questions." }, { status: response.status });
    }

    const outputText = data?.output
      ?.flatMap((item: any) => item?.content || [])
      ?.find((item: any) => item?.type === "output_text")?.text;

    if (!outputText) {
      return NextResponse.json({ error: "OpenAI returned no usable question set." }, { status: 502 });
    }

    const parsed = JSON.parse(outputText) as { questions?: unknown[] };
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 4) {
      return NextResponse.json({ error: "OpenAI returned an incomplete question set." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("AI game generation failed", error);
    return NextResponse.json({ error: "AI question generation failed. Try again or use the local generator." }, { status: 500 });
  }
}
