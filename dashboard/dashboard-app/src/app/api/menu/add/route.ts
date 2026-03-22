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
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('menu').add(menuData);

    return NextResponse.json({ success: true, id: docRef.id, ...menuData });
  } catch (error: any) {
    console.error('Add Menu Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
