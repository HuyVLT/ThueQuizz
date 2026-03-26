import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "questions.json");

function readQuestions() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeQuestions(questions: unknown[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(questions, null, 2), "utf-8");
}

// PUT /api/questions/[id] - Cập nhật câu hỏi
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const questions = readQuestions();
  const idx = questions.findIndex((q: { id: string }) => q.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
  }
  questions[idx] = { ...body, id };
  writeQuestions(questions);
  return NextResponse.json(questions[idx]);
}

// DELETE /api/questions/[id] - Xóa 1 câu hỏi
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const questions = readQuestions();
  const filtered = questions.filter((q: { id: string }) => q.id !== id);
  writeQuestions(filtered);
  return NextResponse.json({ ok: true });
}
