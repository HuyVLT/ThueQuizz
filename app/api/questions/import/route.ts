import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Question from "@/lib/models/Question";

// POST /api/questions/import - Import nhiều câu hỏi cùng lúc (thay thế hoặc nối thêm)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming: unknown[] = Array.isArray(body) ? body : body.questions ?? [];
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    await connectToDatabase();
    const append = req.nextUrl.searchParams.get("mode") === "append";
    
    if (!append) {
      await Question.deleteMany({});
    }

    const validated = incoming.map((q: unknown) => {
      const item = q as Record<string, unknown>;
      // We don't need to generate string ID anymore, MongoDB will create _id
      return {
        question: String(item.question || ""),
        options: Array.isArray(item.options) ? (item.options as unknown[]).map(String) : [],
        correctIndex: Number(item.correctIndex ?? 0),
        explanation: item.explanation ? String(item.explanation) : undefined,
        category: item.category ? String(item.category) : undefined,
      };
    });

    if (validated.length > 0) {
      await Question.insertMany(validated);
    }
    
    const total = await Question.countDocuments();
    return NextResponse.json({ ok: true, count: validated.length, total });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

