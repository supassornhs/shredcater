import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountPath = './serviceAccountKey.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || 'shredcater',
});
const db = getFirestore('shredcater');

(async () => {
    console.log("⚙️ Starting Universal Statistics Aggregation (Rebuilding Daily Dish Map)...");

    // Get all days that exist
    const daysSnapshot = await db.collectionGroup('days').get();
    
    // We only want paths that look like orders/{y}/months/{m}/days/{d}
    // and not other paths that happen to be named 'days'.
    const validDayRefs = [];
    for (const doc of daysSnapshot.docs) {
        if (doc.ref.path.includes('orders/')) {
            validDayRefs.push(doc.ref);
        }
    }

    let totalItemsAggregated = 0;

    for (const dayRef of validDayRefs) {
        const entriesSnap = await dayRef.collection('entries').get();
        if (entriesSnap.empty) continue;
        
        let dailyAggregation = {};

        for (const entry of entriesSnap.docs) {
            const data = entry.data();
            const items = data.Item || data.items || [];
            const platform = typeof data.platforms === 'string' ? data.platforms : (data.platform || 'Unknown');
            
            for (const item of items) {
                // Cater2me/Hungry might use different casing for item amount
                const amt = Number(item.Item_Amount || item.item_amount || item.quantity || 1);
                const name = (item.Item_Name || item.item_name || item.name || 'Unknown').trim();
                if (!name) continue;

                if (!dailyAggregation[name]) {
                    dailyAggregation[name] = {
                        Item_Name: name,
                        total_quantity: 0,
                        platformsSet: new Set()
                    };
                }
                dailyAggregation[name].total_quantity += amt;
                if (platform && platform !== 'Unknown') {
                   dailyAggregation[name].platformsSet.add(platform);
                }
            }
        }

        const dailyItemsBase = dayRef.collection('items');
        
        // 1. Clear out legacy aggregated documents manually for mathematically fresh data
        const oldItemsSnap = await dailyItemsBase.get();
        const batch = db.batch();
        let batchCount = 0;

        for (const old of oldItemsSnap.docs) {
            batch.delete(old.ref);
            batchCount++;
            if (batchCount === 450) {
               await batch.commit();
               batchCount = 0;
            }
        }
        if (batchCount > 0) await batch.commit();

        // 2. Write completely mathematically pure statistics instantly
        const writeBatch = db.batch();
        let writeCount = 0;

        for (const name in dailyAggregation) {
            const agg = dailyAggregation[name];
            // Format doc ID to prevent firestore invalid character crash
            const docId = name.replace(/[\/\.]/g, '-');
            const newRef = dailyItemsBase.doc(docId);
            
            writeBatch.set(newRef, {
                Item_Name: agg.Item_Name,
                total_quantity: agg.total_quantity,
                platforms: Array.from(agg.platformsSet).join(', ')
            });
            writeCount++;
            totalItemsAggregated++;

            if (writeCount === 450) {
                await writeBatch.commit();
                writeCount = 0;
            }
        }
        if (writeCount > 0) await writeBatch.commit();
    }

    console.log(`\n🎉 Mission Accomplished! Successfully rebuilt statistics maps for ${totalItemsAggregated} unique daily dishes globally!`);
    process.exit(0);
})();
