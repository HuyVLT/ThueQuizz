import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/lib/models/User";

// POST /api/auth/login - Dang nhap bang email
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vui long nhap email" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const found = await User.findOne({
      email: email.trim().toLowerCase(),
    }).lean();

    if (!found) {
      return NextResponse.json(
        { success: false, error: "Khong tim thay tai khoan voi email nay" },
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
