import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/lib/models/User";

// POST /api/auth/register - Dang ky tai khoan moi
export async function POST(req: NextRequest) {
  try {
    const { name, email } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vui long nhap ten va email" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const existing = await User.findOne({
      email: email.trim().toLowerCase(),
    }).lean();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Email da duoc su dung" },
        { status: 409 }
      );
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
    });

    const user = {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      createdAt: newUser.createdAt
        ? newUser.createdAt.toISOString()
        : new Date().toISOString(),
    };

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
