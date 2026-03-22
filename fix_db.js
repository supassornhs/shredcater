import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase
const serviceAccountPath = './serviceAccountKey.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || 'shredcater',
});
const db = getFirestore('shredcater');

(async () => {
  console.log("🚀 Starting database cleanup mission... Stripping '(X piece)' from all historical orders!");

  const entriesSnapshot = await db.collectionGroup('entries').get();
  let updatedCount = 0;

  for (const doc of entriesSnapshot.docs) {
    const data = doc.data();
    if (!data.Item || !Array.isArray(data.Item)) continue;

    let needsUpdate = false;
    const cleanItems = data.Item.map((item) => {
      if (item.Item_Name && typeof item.Item_Name === 'string') {
        const regex = /\s*\(\d+\s*pieces?\)/i;
        if (regex.test(item.Item_Name)) {
          needsUpdate = true;
          return {
            ...item,
            Item_Name: item.Item_Name.replace(regex, '').trim()
          };
        }
      }
      return item;
    });

    if (needsUpdate) {
      console.log(`Fixing order: ${doc.id}`);
      await doc.ref.update({ Item: cleanItems });
      updatedCount++;
    }
  }

  console.log(`\n🎉 Mission Accomplished! Successfully fixed ${updatedCount} historical orders natively in Firebase!`);
  
  // Also clean up any 'items' aggregation collection
  console.log("Cleaning up daily aggregated items...");
  const itemsSnapshot = await db.collectionGroup('items').get();
  for (const doc of itemsSnapshot.docs) {
      const data = doc.data();
      const regex = /\s*\(\d+\s*pieces?\)/i;
      if (data.Item_Name && typeof data.Item_Name === 'string' && regex.test(data.Item_Name)) {
          console.log(`Deleting legacy corrupted item aggregation: ${doc.id}`);
          // Just delete it, the next time scraper runs or we recalculate it will be fine
          await doc.ref.delete();
      }
  }
  
  console.log("All legacy items wiped completely.");
  process.exit(0);
})();
