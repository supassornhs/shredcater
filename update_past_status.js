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
    console.log("🔍 Scanning Firebase to fix past orders...");
    const snap = await db.collectionGroup('entries').get();
    
    let todayObj = new Date();
    todayObj.setHours(0,0,0,0);

    let updates = [];

    snap.forEach(doc => {
        const d = doc.data();
        let currentStatus = typeof d.status === 'string' ? d.status.toLowerCase() : d.status;
        let dateStr = d.PickUp_Date;
        
        if (dateStr) {
            let [y, m, day] = dateStr.split('-');
            let orderDateObj = new Date(y, parseInt(m) - 1, day);
            
            // If the date is passed, we update it
            if (orderDateObj < todayObj && currentStatus !== "completed") {
                updates.push(doc.ref);
            }
        }
    });

    console.log(`Found ${updates.length} orders safely trapped in the past without 'completed' status.`);
    
    // Process in batches of 400
    for (let i = 0; i < updates.length; i += 400) {
        const batch = db.batch();
        const chunk = updates.slice(i, i + 400);
        chunk.forEach(ref => {
            batch.update(ref, { status: "completed" });
        });
        await batch.commit();
        console.log(`Saved batch of ${chunk.length} completed statuses.`);
    }

    console.log(`\n🎉 Success! Forced 'completed' status on ${updates.length} historical database orders.`);
    
    process.exit(0);
}

run().catch(console.error);
