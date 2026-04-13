import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/lib/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/auth/me?id=xxx - Lay thong tin user hien tai theo ID
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Thieu user ID" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const found = await User.findById(userId).lean();

    if (!found) {
      return NextResponse.json(
        { success: false, error: "Khong tim thay user" },
        { status: 404 }
      );
    }

    const user = {
      id: (found as any)._id.toString(),
      name: (found as any).name,
      email: (found as any).email,
      createdAt: (found as any).createdAt
        ? new Date((found as any).createdAt).toISOString()
        : new Date().toISOString(),
    };

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/auth/me - Cap nhat thong tin user
export async function PUT(req: NextRequest) {
  try {
    const { userId, name } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Thieu user ID" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updates: Record<string, string> = {};
    if (name?.trim()) updates.name = name.trim();

    const updated = await User.findByIdAndUpdate(userId, updates, {
      new: true,
    }).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Khong tim thay user" },
        { status: 404 }
      );
    }

    const user = {
      id: (updated as any)._id.toString(),
      name: (updated as any).name,
      email: (updated as any).email,
      createdAt: (updated as any).createdAt
        ? new Date((updated as any).createdAt).toISOString()
        : new Date().toISOString(),
    };

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
