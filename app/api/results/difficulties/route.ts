import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import QuizResult from "@/lib/models/QuizResult";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/results/difficulties - Thong ke cau hoi kho nhat
export async function GET() {
  try {
    await connectToDatabase();

    const results = await QuizResult.find({}).lean();

    const map = new Map<
      string,
      { text: string; total: number; wrong: number; category?: string }
    >();

    for (const r of results as any[]) {
      for (const qr of r.questionResults) {
        const existing = map.get(qr.questionId) || {
          text: qr.questionText,
          total: 0,
          wrong: 0,
          category: qr.category,
        };
        existing.total++;
        if (!qr.correct) existing.wrong++;
        map.set(qr.questionId, existing);
      }
    }

    const difficulties = Array.from(map.entries())
      .map(([id, data]) => ({
        questionId: id,
        questionText: data.text,
        totalAttempts: data.total,
        wrongAttempts: data.wrong,
        errorRate:
          data.total > 0 ? Math.round((data.wrong / data.total) * 100) : 0,
        category: data.category,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);

    return NextResponse.json(difficulties);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
