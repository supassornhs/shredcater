import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountPath = './serviceAccountKey.json';
let db = null;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = getFirestore('shredcater'); 
} else {
  admin.initializeApp({ projectId: 'shredcater2' });
  db = getFirestore('shredcater'); 
}

async function run() {
    console.log("🧨 Searching explicitly for the rogue duplicate via 'Hungry HQ' string match...");
    
    const snap = await db.collectionGroup('entries').get();
    let deletions = 0;
    
    for (const doc of snap.docs) {
        const d = doc.data();
        if (d.Customer_Name && d.Customer_Name.includes("Hungry HQ")) {
            console.log(`Found explicit duplicate via Customer string search: ${doc.ref.path}`);
            console.log(`Its actual ID is: ${doc.id}`);
            console.log(`Its actual Order_ID value is: ${d.Order_ID}`);
            console.log(`Its actual PickUp_Date is: ${d.PickUp_Date}`);
            await doc.ref.delete();
            deletions++;
        }
    }
    
    console.log(`✅ Success! Eradicated ${deletions} duplicate records based on string patterns.`);
    process.exit(0);
}

run().catch(console.error);
