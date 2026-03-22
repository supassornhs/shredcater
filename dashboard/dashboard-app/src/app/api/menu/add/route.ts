import { NextResponse } from 'next/server';
import admin, { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    
    const menuData = {
      name: body.name || '',
      price: Number(body.price) || 0.00,
      components: body.components || [],
      packaging: body.packaging || '',
      platforms: body.platforms || [],
      allergens: body.allergens || [],
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('menu').add(menuData);

    return NextResponse.json({ success: true, id: docRef.id, ...menuData });
  } catch (error: any) {
    console.error('Add Menu Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
