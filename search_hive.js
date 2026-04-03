import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('C:/Users/User/Desktop/ShredCater/serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore('shredcater');

(async () => {
   const snapshot = await db.collectionGroup('entries').get();
   const res = [];
   snapshot.forEach(doc => {
       const data = doc.data();
       const name = data.Customer_Name || data.Contact_Name || data.Event_Name || data.companyName || "";
       if (name.includes('Hive') || name.includes('Kelly Lai')) {
           res.push(`ID: ${doc.id}, Reference: ${doc.ref.path}, Name: ${name}, Date: ${data.PickUp_Date || data.deliveryDate}, Platform: ${data.platforms || data.source}`);
       }
   });
   console.log(res.join('\n'));
   process.exit(0);
})();
