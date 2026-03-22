import { NextResponse } from 'next/server';
import admin, { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const snapshot = await db.collection('configurations').get();
    let configs: any = {};
    snapshot.forEach(doc => { configs[doc.id] = doc.data(); });
    return NextResponse.json(configs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const { id, cookie, auth } = await req.json();
    const docId = id || 'clubfeast';
    await db.collection('configurations').doc(docId).set({
      cookie: cookie || '',
      auth: auth || '',
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
