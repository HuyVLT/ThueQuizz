import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Question from "@/lib/models/Question";

// GET /api/questions - Lấy tất cả câu hỏi
export async function GET() {
  try {
    await connectToDatabase();
    const docs = await Question.find({}).lean();
    const questions = docs.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
    }));
    return NextResponse.json(questions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/questions - Thêm 1 câu hỏi mới
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const newQ = await Question.create(body);
    const result = { ...newQ.toObject(), id: newQ._id.toString() };
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/questions - Xóa tất cả (reset)
export async function DELETE() {
  try {
    await connectToDatabase();
    await Question.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

