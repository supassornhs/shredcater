import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  // Initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(process.cwd(), '../../serviceAccountKey.json');
    try {
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || 'shredcater',
        });
        console.log('✅ Dashboard Orders API: Initialized using serviceAccountKey.json');
      } else if (process.env.FIREBASE_BASE64_KEY ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') : process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_BASE64_KEY ? Buffer.from(process.env.FIREBASE_BASE64_KEY, "base64").toString("utf8") : (process.env.FIREBASE_SERVICE_ACCOUNT || "{}"));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: 'shredcater',
        });
        console.log('✅ Dashboard Orders API: Initialized using Vercel Environment Variables');
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: 'shredcater',
        });
        console.log('✅ Dashboard Orders API: Initialized using applicationDefault()');
      }
    } catch (err: any) {
      console.error('🚨 Dashboard Orders API: Firebase Init Error:', err.message);
    }
  }
  return getFirestore('shredcater'); // use named database — that's where the data is
}

export async function GET() {
  try {
    const db = getDb();

    // Fetch all orders (entries) from all daily subcollections
    const ordersSnapshot = await db.collectionGroup('entries').get();
    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch all daily items
    const itemsSnapshot = await db.collectionGroup('items').get();
    const items = itemsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`📡 Dashboard Orders API: Fetched ${orders.length} orders and ${items.length} items.`);
    return NextResponse.json({ orders, items });
  } catch (error: any) {
    console.error('🚨 Dashboard Orders API: Fetch Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
