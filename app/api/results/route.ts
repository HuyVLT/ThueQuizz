import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import QuizResult from "@/lib/models/QuizResult";
import UserStreak from "@/lib/models/UserStreak";
import SRSCard from "@/lib/models/SRSCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Badge definitions (server-side)
const BADGE_CONDITIONS = [
  { id: "first_quiz", check: (s: any) => s.quizCount >= 1 },
  { id: "five_quizzes", check: (s: any) => s.quizCount >= 5 },
  { id: "ten_quizzes", check: (s: any) => s.quizCount >= 10 },
  { id: "streak_3", check: (s: any) => s.longestStreak >= 3 },
  { id: "streak_7", check: (s: any) => s.longestStreak >= 7 },
  { id: "streak_30", check: (s: any) => s.longestStreak >= 30 },
  { id: "xp_100", check: (s: any) => s.totalXP >= 100 },
  { id: "xp_500", check: (s: any) => s.totalXP >= 500 },
  { id: "xp_1000", check: (s: any) => s.totalXP >= 1000 },
  { id: "twenty_five", check: (s: any) => s.quizCount >= 25 },
];

function calculateXP(score: number, total: number): number {
  const baseXP = 10;
  const bonusXP = Math.round((score / Math.max(total, 1)) * 50);
  const perfectBonus = score === total ? 25 : 0;
  return baseXP + bonusXP + perfectBonus;
}

// GET /api/results?userId=xxx - Lay ket qua theo user hoac tat ca
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const userId = req.nextUrl.searchParams.get("userId");

    let results;
    if (userId) {
      results = await QuizResult.find({ userId }).sort({ date: -1 }).lean();
    } else {
      results = await QuizResult.find({}).sort({ date: -1 }).lean();
    }

    const mapped = results.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/results - Luu ket qua quiz moi + cap nhat streak + SRS
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await connectToDatabase();

    // Save result
    const newResult = await QuizResult.create(body);
    const resultData = {
      ...newResult.toObject(),
      id: newResult._id.toString(),
    };

    // Update streak
    const { userId, score, total, questionResults } = body;
    const today = new Date().toISOString().split("T")[0];
    const xp = calculateXP(score, total);

    let streak = await UserStreak.findOne({ userId });

    if (!streak) {
      streak = await UserStreak.create({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        totalXP: xp,
        badges: [],
        quizCount: 1,
      });
    } else {
      streak.totalXP += xp;
      streak.quizCount++;

      if (streak.lastActiveDate !== today) {
        const lastDate = new Date(streak.lastActiveDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor(
          (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          streak.currentStreak++;
        } else if (diffDays > 1) {
          streak.currentStreak = 1;
        }
        streak.lastActiveDate = today;
      }
      streak.longestStreak = Math.max(
        streak.longestStreak,
        streak.currentStreak
      );

      // Check badges
      for (const badge of BADGE_CONDITIONS) {
        if (!streak.badges.includes(badge.id) && badge.check(streak)) {
          streak.badges.push(badge.id);
        }
      }

      await streak.save();
    }

    // Update SRS cards
    if (Array.isArray(questionResults)) {
      for (const qr of questionResults) {
        await updateSRSCard(userId, qr.questionId, qr.correct);
      }
    }

    const streakData = {
      userId: streak.userId,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      totalXP: streak.totalXP,
      badges: streak.badges,
      quizCount: streak.quizCount,
    };

    return NextResponse.json(
      { result: resultData, streak: streakData },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function updateSRSCard(
  userId: string,
  questionId: string,
  correct: boolean
) {
  const now = new Date();
  let card = await SRSCard.findOne({ userId, questionId });

  if (!card) {
    await SRSCard.create({
      userId,
      questionId,
      interval: correct ? 1 : 0,
      repetitions: correct ? 1 : 0,
      easeFactor: 2.5,
      nextReview: new Date(
        now.getTime() + (correct ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000)
      ).toISOString(),
      lastReview: now.toISOString(),
    });
  } else {
    if (correct) {
      if (card.repetitions === 0) {
        card.interval = 1;
      } else if (card.repetitions === 1) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.easeFactor);
      }
      card.repetitions++;
      card.easeFactor = Math.max(1.3, card.easeFactor + 0.1);
    } else {
      card.repetitions = 0;
      card.interval = 0;
      card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
    }
    card.lastReview = now.toISOString();
    card.nextReview = new Date(
      now.getTime() + card.interval * 24 * 60 * 60 * 1000
    ).toISOString();
    await card.save();
  }
}
