import { NextResponse } from 'next/server';
import admin, { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';



export async function GET() {
  try {
    const db = getDb();
    const stockSnapshot = await db.collection('stock').get();
    const stock = stockSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json({ stock });
  } catch (error: any) {
    console.error('Stock Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();

    const ingredient = {
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('stock').add(ingredient);
    return NextResponse.json({ id: docRef.id, ...ingredient });
  } catch (error: any) {
    console.error('Stock Save Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
