import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(process.cwd(), '../../serviceAccountKey.json');
    try {
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || 'shredcater2',
        });
        console.log('✅ Stock API: Initialized using serviceAccountKey.json');
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: 'shredcater2',
        });
        console.log('⚠️ Stock API: Fallback to ADC.');
      }
    } catch (err: any) {
      console.error('🚨 Stock API: Firebase Init Error:', err.message);
    }
  }
  return getFirestore('shredcater'); // use named database
}

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
