import { NextResponse } from 'next/server';
import admin, { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';



export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await req.json();
    
    const componentData = {
      name: body.name || '',
      serving: Number(body.serving) || 1,
      ingredients: body.ingredients || [],
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('component').doc(id).update(componentData);
    return NextResponse.json({ success: true, id, ...componentData });
  } catch (error: any) {
    console.error("PUT Component Error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const resolvedParams = await params;
    const id = resolvedParams.id;
    await db.collection('component').doc(id).delete();
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("DELETE Component Error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
