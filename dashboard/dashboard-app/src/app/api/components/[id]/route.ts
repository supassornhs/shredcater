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
