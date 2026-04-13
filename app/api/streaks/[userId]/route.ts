import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import UserStreak from "@/lib/models/UserStreak";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/streaks/[userId] - Lay streak cua user
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    await connectToDatabase();

    const streak = await UserStreak.findOne({ userId }).lean();

    if (!streak) {
      return NextResponse.json({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: "",
        totalXP: 0,
        badges: [],
        quizCount: 0,
      });
    }

    return NextResponse.json({
      userId: (streak as any).userId,
      currentStreak: (streak as any).currentStreak,
      longestStreak: (streak as any).longestStreak,
      lastActiveDate: (streak as any).lastActiveDate,
      totalXP: (streak as any).totalXP,
      badges: (streak as any).badges,
      quizCount: (streak as any).quizCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
