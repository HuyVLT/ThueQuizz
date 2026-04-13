import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import SRSCard from "@/lib/models/SRSCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/srs/[userId]?due=true - Lay SRS cards cua user (hoac chi cac card den han)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const dueOnly = req.nextUrl.searchParams.get("due") === "true";

    await connectToDatabase();

    let filter: any = { userId };
    if (dueOnly) {
      filter.nextReview = { $lte: new Date().toISOString() };
    }

    const cards = await SRSCard.find(filter).lean();

    const mapped = (cards as any[]).map((c) => ({
      questionId: c.questionId,
      userId: c.userId,
      interval: c.interval,
      repetitions: c.repetitions,
      easeFactor: c.easeFactor,
      nextReview: c.nextReview,
      lastReview: c.lastReview,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
