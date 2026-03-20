import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getDb() {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    const url = new URL(req.url);
    const dateStr = url.searchParams.get("date");
    
    if (!dateStr || !dateStr.includes('-')) {
      return NextResponse.json({ error: "Missing or invalid PickUp_Date (?date=YYYY-MM-DD)" }, { status: 400 });
    }

    const [year, month, day] = dateStr.split('-');
    await db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(id).delete();
    
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("DELETE Order Error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await req.json();
    
    const dateStr = body.originalDate || body.PickUp_Date;
    if (!dateStr || !dateStr.includes('-')) {
      return NextResponse.json({ error: "Missing PickUp_Date" }, { status: 400 });
    }

    const [year, month, day] = dateStr.split('-');
    const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(id);

    const orderDoc = {
      ...body,
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Remove the temporary originalDate key before saving
    delete orderDoc.originalDate;

    await orderRef.set(orderDoc, { merge: true });
    
    return NextResponse.json({ success: true, id, ...orderDoc });
  } catch (error: any) {
    console.error("PUT Order Error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
