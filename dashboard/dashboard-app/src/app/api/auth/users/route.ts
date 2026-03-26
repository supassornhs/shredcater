import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

// GET - List all allowed users
export async function GET() {
  try {
    const db = getDb();
    const snapshot = await db.collection("allowed_users").orderBy("email").get();
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching allowed users:", error);
    return NextResponse.json({ users: [], error: error.message });
  }
}

// POST - Add a new allowed user
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = getDb();
    const allowlistRef = db.collection("allowed_users");

    // Check if already exists
    const existing = await allowlistRef.where("email", "==", normalizedEmail).get();
    if (!existing.empty) {
      return NextResponse.json({ error: "Email already in allowlist" }, { status: 409 });
    }

    const docRef = await allowlistRef.add({
      email: normalizedEmail,
      added_at: new Date().toISOString(),
    });

    return NextResponse.json({ id: docRef.id, email: normalizedEmail });
  } catch (error: any) {
    console.error("Error adding allowed user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove an allowed user
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    const db = getDb();
    await db.collection("allowed_users").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing allowed user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
