import fs from 'fs';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore(app, 'shredcater');

(async () => {
    try {
        const doc = await db.collection('configurations').doc('clubfeast').get();
        if (doc.exists && doc.data().cookie) {
            fs.appendFileSync('.env', '\nCATER_COOKIE="' + doc.data().cookie + '"\n');
            console.log("Wrote CATER_COOKIE to .env!");
        } else {
            console.log("Cookie not found in Firebase!");
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
})();
