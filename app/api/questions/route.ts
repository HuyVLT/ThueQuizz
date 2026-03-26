import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Lưu ở thư mục data/ ngoài .next để persist qua các lần build
const DATA_FILE = path.join(process.cwd(), "data", "questions.json");

function readQuestions() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, "[]", "utf-8");
    }
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

// GET /api/questions - Lấy tất cả câu hỏi
export async function GET() {
  const questions = readQuestions();
  return NextResponse.json(questions);
}

// POST /api/questions - Thêm 1 câu hỏi mới
export async function POST(req: NextRequest) {
  const body = await req.json();
  const questions = readQuestions();
  const newQ = {
    ...body,
    id: Date.now().toString(),
  };
  questions.push(newQ);
  writeQuestions(questions);
  return NextResponse.json(newQ, { status: 201 });
}

// DELETE /api/questions - Xóa tất cả (reset)
export async function DELETE() {
  writeQuestions([]);
  return NextResponse.json({ ok: true });
}
