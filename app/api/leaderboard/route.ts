import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import QuizResult from "@/lib/models/QuizResult";
import UserStreak from "@/lib/models/UserStreak";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function calculateXP(score: number, total: number): number {
  const baseXP = 10;
  const bonusXP = Math.round((score / Math.max(total, 1)) * 50);
  const perfectBonus = score === total ? 25 : 0;
  return baseXP + bonusXP + perfectBonus;
}

// GET /api/leaderboard?period=week|month|all
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const period = req.nextUrl.searchParams.get("period") || "all";

    let dateFilter: any = {};
    const now = new Date();

    if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { date: { $gte: weekAgo.toISOString() } };
    } else if (period === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { date: { $gte: monthAgo.toISOString() } };
    }

    const results = await QuizResult.find(dateFilter).lean();

    // Aggregate by user
    const map = new Map<
      string,
      { name: string; scores: number[]; xp: number }
    >();

    for (const r of results as any[]) {
      const existing = map.get(r.userId) || {
        name: r.userName,
        scores: [] as number[],
        xp: 0,
      };
      existing.scores.push(r.percent);
      existing.xp += calculateXP(r.score, r.total);
      map.set(r.userId, existing);
    }

    // Get all streaks
    const streaks = await UserStreak.find({}).lean();
    const streakMap = new Map<string, any>();
    for (const s of streaks as any[]) {
      streakMap.set(s.userId, s);
    }

    const entries = Array.from(map.entries())
      .map(([userId, data]) => {
        const streak = streakMap.get(userId);
        return {
          userId,
          userName: data.name,
          avgScore: Math.round(
            data.scores.reduce((a: number, b: number) => a + b, 0) /
              data.scores.length
          ),
          totalQuizzes: data.scores.length,
          bestScore: Math.max(...data.scores),
          totalXP: streak?.totalXP || data.xp,
          streak: streak?.currentStreak || 0,
        };
      })
      .sort((a, b) => b.totalXP - a.totalXP);

    return NextResponse.json(entries);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
