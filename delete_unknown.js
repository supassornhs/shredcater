import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('C:/Users/User/Desktop/ShredCater/serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore('shredcater');

(async () => {
   const snapshot = await db.collectionGroup('entries').get();
   const targets = [];
   
   for (const doc of snapshot.docs) {
       const data = doc.data();
       const name = data.Customer_Name || data.Contact_Name || data.Event_Name || data.companyName || "";
       const platform = data.platforms || data.source || "";
       const dateStr = data.PickUp_Date || data.deliveryDate || "";
       
       if (name.includes('Unknown') && platform.toLowerCase().includes('ezcater')) {
           // If there's multiple Unknown ezCater orders, we might as well clean them up.
           targets.push(doc.ref);
           console.log(`DELETING -> ID: ${doc.id}, Reference: ${doc.ref.path}, Name: ${name}, Date: ${dateStr}`);
       }
   }
   
   // Actually delete them
   for (const ref of targets) {
       await ref.delete();
       console.log(`Deleted ${ref.path}`);
   }
   
   if (targets.length === 0) {
       console.log("No matching 'Unknown' ezCater orders found.");
   }
   process.exit(0);
})();
