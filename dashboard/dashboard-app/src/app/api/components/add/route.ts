import { NextResponse } from 'next/server';
import admin, { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';



export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    
    const componentData = {
      name: body.name || '',
      serving: Number(body.serving) || 1,
      ingredients: body.ingredients || [],
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('component').add(componentData);

    return NextResponse.json({ success: true, id: docRef.id, ...componentData });
  } catch (error: any) {
    console.error('Add Component Error:', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
