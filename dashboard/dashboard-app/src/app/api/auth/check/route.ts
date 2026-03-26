import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ allowed: false, error: "No email provided" });
  }

  try {
    const db = getDb();
    const allowlistRef = db.collection("allowed_users");

    // Check if the email exists in the allowed_users collection
    const snapshot = await allowlistRef.where("email", "==", email.toLowerCase()).get();

    if (!snapshot.empty) {
      return NextResponse.json({ allowed: true });
    }

    return NextResponse.json({ allowed: false });
  } catch (error: any) {
    console.error("Error checking allowlist:", error);
    return NextResponse.json({ allowed: false, error: error.message });
  }
}
