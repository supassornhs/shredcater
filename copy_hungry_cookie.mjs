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
            let cookieData = doc.data().cookie;
            // Write to .env natively!
            fs.appendFileSync('.env', '\nHUNGRY_COOKIE="' + cookieData + '"\n');
            await db.collection('configurations').doc('hungry').set({ cookie: cookieData, last_updated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            console.log("Wrote HUNGRY_COOKIE to .env successfully and copied into Firebase hungry document!");
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
})();
