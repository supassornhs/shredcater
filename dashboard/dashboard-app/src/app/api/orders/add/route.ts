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
    
    // Helper to map month strings to 'MM' format
    const getMonthNum = (monthName: string) => {
      const d = new Date(`${monthName} 1, 2026`);
      return isNaN(d.getTime()) ? '01' : (d.getMonth() + 1).toString().padStart(2, '0');
    };

    let year, month, day;
    let fallbackDateStr = new Date().toISOString().split('T')[0];
    
    // Check if it's the Firecrawl Payload Structure natively
    if (body.PickUp_Year && body.PickUp_Month && body.PickUp_Date && !body.PickUp_Date.includes('-')) {
      year = body.PickUp_Year.toString();
      month = getMonthNum(body.PickUp_Month);
      day = body.PickUp_Date.toString().padStart(2, '0');
      fallbackDateStr = `${year}-${month}-${day}`;
    } else {
      let dateStr = body.PickUp_Date;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          dateStr = fallbackDateStr;
      }
      [year, month, day] = dateStr.split('-');
      fallbackDateStr = dateStr;
    }
    
    // Check if it's Firecrawl supplying an explicitly extracted Doordash/EzCater ID
    const orderId = body.Order_ID || `O-${Date.now().toString().slice(-6)}`;

    // Set correct document tree routing natively based on exact dates
    const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(orderId);

    const orderDoc = {
      ...body,
      Order_ID: orderId,
      Customer_Name: body.Customer_Name || '',
      PickUp_Date: fallbackDateStr,
      PickUp_Time: body.PickUp_Time || '',
      Deliver_Time: body.Deliver_Time || '',
      Deliver_Address: body.Deliver_Address || '',
      Deliver_Instruction: body.Deliver_Instruction || '',
      Order_Notes: body.Order_Notes || '',
      Utensils: body.Utensils || (body.Utensils === true ? 'Yes' : 'No'),
      Deliver_Partner: body.Deliver_Partner || body.platforms || 'Direct',
      platforms: body.Deliver_Partner || body.platforms || 'Direct',
      Order_Subtotal: Number(body.Order_Subtotal) || 0,
      Tax: Number(body.Tax) || 0,
      Order_Total: Number(body.Order_Total) || Number(body.total_amount) || Number(body.Order_Subtotal) || 0,
      Item: Array.isArray(body.Item) ? body.Item : [],
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    };

    await orderRef.set(orderDoc, { merge: true });

    return NextResponse.json({ success: true, order: orderDoc });
  } catch (error: any) {
    console.error('Add Order Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
