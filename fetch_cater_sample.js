import fs from 'fs';
import dotenv from 'dotenv';

(async () => {
    dotenv.config();
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();
    
    const configSnap = await db.collection('configurations').doc('cater2me').get();
    let CATER_COOKIE = configSnap.exists ? configSnap.data().cookie : null;

    const res = await fetch("https://vendor.cater2.me/api/vendor/orders?limit=10", { headers: { "Cookie": CATER_COOKIE } });
    const json = await res.json();
    
    fs.writeFileSync('cater2me_sample.json', JSON.stringify(json.slice(0, 3), null, 2));
    console.log("Saved JSON sample to cater2me_sample.json");
    process.exit(0);
})();
