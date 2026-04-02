import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";

export const dynamic = 'force-dynamic';

// GET /api/health - Endpoint chan doan ket noi MongoDB
export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env_MONGO_URI: process.env.MONGO_URI ? "SET (hidden)" : "NOT SET",
    env_MONGODB_URI: process.env.MONGODB_URI ? "SET (hidden)" : "NOT SET",
  };

  try {
    const conn = await connectToDatabase();
    diagnostics.connected = true;
    diagnostics.dbName = conn.connection?.db?.databaseName ?? "unknown";
    diagnostics.readyState = conn.connection?.readyState;
    return NextResponse.json({ status: "ok", diagnostics });
  } catch (error: any) {
    diagnostics.connected = false;
    diagnostics.errorName = error.name;
    diagnostics.errorMessage = error.message;
    diagnostics.errorCode = error.code;
    return NextResponse.json({ status: "error", diagnostics }, { status: 500 });
  }
}
