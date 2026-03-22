import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(process.cwd(), '../../serviceAccountKey.json');
    if (process.env.FIREBASE_BASE64_KEY || process.env.FIREBASE_SERVICE_ACCOUNT) {
      const keyString = process.env.FIREBASE_BASE64_KEY ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(keyString || '{}')),
        projectId: 'shredcater',
      });
    } else if (fs.existsSync(serviceAccountPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
        projectId: 'shredcater',
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'shredcater',
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
