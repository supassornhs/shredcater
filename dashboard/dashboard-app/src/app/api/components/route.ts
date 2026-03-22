import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';



export async function GET() {
  try {
    const db = getDb();
    const snapshot = await db.collection('component').get();
    const components = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json({ components });
  } catch (error: any) {
    console.error('Components Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
