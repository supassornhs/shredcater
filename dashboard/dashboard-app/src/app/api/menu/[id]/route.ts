import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(process.cwd(), '../../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'shredcater2',
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'shredcater2',
      });
    }
  }
  return getFirestore('shredcater');
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await req.json();
    
    const menuData = {
      name: body.name || '',
      price: Number(body.price) || 0,
      components: body.components || [],
      packaging: body.packaging || '',
      platforms: body.platforms || [],
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('menu').doc(id).update(menuData);
    return NextResponse.json({ success: true, id, ...menuData });
  } catch (error: any) {
    console.error("PUT Menu Error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const resolvedParams = await params;
    const id = resolvedParams.id;
    await db.collection('menu').doc(id).delete();
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("DELETE Menu Error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
