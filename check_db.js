
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountPath = './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function checkDb(label, dbId) {
  console.log(`\n====== ${label} (${dbId || 'default'}) ======`);
  try {
    const db = dbId ? getFirestore(dbId) : getFirestore();

    // Try listing root collections
    try {
      const cols = await db.listCollections();
      console.log(`📁 Root collections: ${cols.map(c => c.id).join(', ') || '(none)'}`);
    } catch (e) {
      console.log(`  listCollections error: ${e.message}`);
    }

    // Try collectionGroup('entries')
    try {
      const snap = await db.collectionGroup('entries').get();
      console.log(`📦 collectionGroup('entries') count: ${snap.size}`);
      snap.docs.slice(0, 5).forEach(doc => {
        console.log(`   - ${doc.id} | date: ${doc.data().order_date} | platform: ${doc.data().platform}`);
      });
    } catch (e) {
      console.log(`  entries error: ${e.message}`);
    }

    // Try 'stock' collection
    try {
      const stock = await db.collection('stock').get();
      console.log(`🧊 stock collection count: ${stock.size}`);
      stock.docs.forEach(doc => {
        console.log(`   - ${doc.data().name} | amount: ${doc.data().amount}`);
      });
    } catch (e) {
      console.log(`  stock error: ${e.message}`);
    }

  } catch (err) {
    console.error(`❌ Fatal error: ${err.message}`);
  }
}

async function run() {
  await checkDb('Default DB', null);
  await checkDb('Named DB: shredcater', 'shredcater');
  console.log('\n====== Done ======');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
