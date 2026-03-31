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
    console.log("🔍 Scanning Firebase for Orders without Statuses...");
    const snap = await db.collectionGroup('entries').get();
    
    let count = 0;
    const batch = db.batch();
    
    snap.forEach(doc => {
        const d = doc.data();
        if (!d.status) {
            let assignedStatus = "Finalized"; // Default to Finalized because it's in the past
            
            if (!d.platforms || d.platforms.toLowerCase().includes("manual")) {
                assignedStatus = "N/A";
            }
            if (!d.Order_Type || d.Order_Type === "N/A") {
                assignedStatus = "N/A"; // If no order type, N/A statuses
            }

            console.log(`Setting [${d.Order_ID || doc.id}] (${d.platforms}) -> ${assignedStatus}`);
            batch.update(doc.ref, { status: assignedStatus });
            count++;
            
            if (count > 490) { // Batch limit is 500
                console.log("Exceeding batch limit, pausing...");
            }
        }
    });

    if (count > 0) {
        await batch.commit();
    }
    console.log(`\n🎉 Success! Backfilled status tags for ${count} legacy database orders.`);
    
    process.exit(0);
}

run().catch(console.error);
