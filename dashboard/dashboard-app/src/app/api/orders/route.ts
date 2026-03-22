import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';



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
