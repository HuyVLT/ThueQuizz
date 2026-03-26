import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "questions.json");

function writeQuestions(questions: unknown[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(questions, null, 2), "utf-8");
}

function readQuestions() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// POST /api/questions/import - Import nhiều câu hỏi cùng lúc (thay thế hoặc nối thêm)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const incoming: unknown[] = Array.isArray(body) ? body : body.questions ?? [];
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const append = req.nextUrl.searchParams.get("mode") === "append";
  const existing = append ? readQuestions() : [];

  const validated = incoming.map((q: unknown, i: number) => {
    const item = q as Record<string, unknown>;
    return {
      id: (item.id as string) || Date.now().toString() + i,
      question: String(item.question || ""),
      options: Array.isArray(item.options) ? (item.options as unknown[]).map(String) : [],
      correctIndex: Number(item.correctIndex ?? 0),
      explanation: item.explanation ? String(item.explanation) : undefined,
      category: item.category ? String(item.category) : undefined,
    };
  });

  const merged = [...existing, ...validated];
  writeQuestions(merged);
  return NextResponse.json({ ok: true, count: validated.length, total: merged.length });
}
