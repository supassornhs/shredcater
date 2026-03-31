import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore('shredcater');

(async () => {
   const snapshot = await db.collectionGroup('entries').where('platforms', '==', 'ClubFeast').get();
   const res = [];
   snapshot.forEach(doc => {
       res.push(`${doc.id} -> ${doc.data().status}`);
   });
   console.log(res.join('\n'));
   process.exit(0);
})();
