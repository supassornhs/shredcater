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

// Simple CSV parser that handles quotes
function parseCSV(text: string) {
  let result = [];
  let row = [];
  let inQuotes = false;
  let val = '';
  
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i+1] === '"') {
          val += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        val += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(val.trim());
        val = '';
      } else if (char === '\n' || char === '\r') {
        row.push(val.trim());
        result.push(row);
        row = [];
        val = '';
        if (char === '\r' && text[i+1] === '\n') i++;
      } else {
        val += char;
      }
    }
  }
  if (val !== '' || row.length > 0) {
    row.push(val.trim());
    result.push(row);
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const csvLines = parseCSV(body.csvData || '');
    
    if (csvLines.length < 2) {
      return NextResponse.json({ error: "CSV data is empty or missing headers." }, { status: 400 });
    }

    const headers = csvLines[0].map(h => h.toLowerCase());
    const nameIdx = headers.indexOf('name');
    const amountIdx = headers.indexOf('amount');
    const unitIdx = headers.indexOf('unit');
    const typeIdx = headers.indexOf('type');
    const allergensIdx = headers.indexOf('allergens');

    if (nameIdx === -1 || amountIdx === -1) {
      return NextResponse.json({ error: "CSV must contain 'name' and 'amount' headers." }, { status: 400 });
    }

    // Process rows
    let batch = db.batch();
    let recordsCount = 0;

    for (let i = 1; i < csvLines.length; i++) {
      const row = csvLines[i];
      if (row.length < 2 || !row[nameIdx]) continue;

      const name = row[nameIdx];
      const amount = parseFloat(row[amountIdx]) || 0;
      const unit = unitIdx !== -1 && row[unitIdx] ? row[unitIdx] : "Grams";
      const type = typeIdx !== -1 && row[typeIdx] ? row[typeIdx].toLowerCase() : "ingredient";
      
      let allergens: string[] = [];
      if (allergensIdx !== -1 && row[allergensIdx]) {
        allergens = row[allergensIdx].split(',').map(a => a.trim()).filter(a => a.length > 0);
      }

      const docRef = db.collection('stock').doc();
      batch.set(docRef, {
        name,
        amount,
        unit,
        type,
        allergens,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      recordsCount++;
    }

    await batch.commit();

    return NextResponse.json({ success: true, count: recordsCount });
  } catch (error: any) {
    console.error("Bulk Import Error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
