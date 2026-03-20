import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin identically to orders API
let app: any;
if (!admin.apps.length) {
  try {
      if (process.env.FIREBASE_BASE64_KEY ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') : process.env.FIREBASE_SERVICE_ACCOUNT) {
        app = admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_BASE64_KEY ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') : (process.env.FIREBASE_SERVICE_ACCOUNT || '{}'))),
          projectId: 'shredcater' 
        });
      } else {
        app = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: 'shredcater' 
        });
      }
  } catch (error: any) {
    console.error('Firebase initialization error in settings API', error);
  }
} else {
  app = admin.app();
}

const db = getFirestore(app, 'shredcater');

export async function GET() {
  try {
    const snapshot = await db.collection('configurations').get();
    let configs: any = {};
    snapshot.forEach(doc => { configs[doc.id] = doc.data(); });
    return NextResponse.json(configs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, cookie, auth } = await req.json();
    const docId = id || 'clubfeast';
    await db.collection('configurations').doc(docId).set({
      cookie: cookie || '',
      auth: auth || '',
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
