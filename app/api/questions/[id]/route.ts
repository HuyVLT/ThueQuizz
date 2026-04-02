import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Question from "@/lib/models/Question";

// PUT /api/questions/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await connectToDatabase();
    
    const updated = await Question.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
    }
    
    // @ts-ignore
    return NextResponse.json({ ...updated, id: updated._id.toString() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/questions/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    
    await Question.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

