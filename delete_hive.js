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
       const dateStr = data.PickUp_Date || data.deliveryDate || "";
       
       if ((name.includes('Hive') || name.includes('Kelly Lai')) && dateStr.includes('-11')) {
           targets.push(doc.ref);
           console.log(`DELETING -> ID: ${doc.id}, Reference: ${doc.ref.path}, Name: ${name}, Date: ${dateStr}, Platform: ${data.platforms || data.source}`);
       }
   }
   
   // Actually delete them
   for (const ref of targets) {
       await ref.delete();
       console.log(`Deleted ${ref.path}`);
   }
   
   if (targets.length === 0) {
       console.log("No matching 'Hive' or 'Kelly Lai' orders found on the 11th.");
   }
   process.exit(0);
})();
