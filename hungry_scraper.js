import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const HUNGRY_COOKIE = process.env.HUNGRY_COOKIE || "";
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore(admin.app(), 'shredcater');

(async () => {
    console.log("\n⚡ Initiating Hungry JSON Native Scraper Engine...");
    if (!HUNGRY_COOKIE) {
        console.error("❌ HUNGRY_COOKIE is missing from .env!");
        process.exit(1);
    }

    try {
        console.log("👉 Validating Global Dashboard Payload...");
        
        let startStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: 'numeric'});
        let endStr = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: 'numeric'});
        const res = await fetch(`https://api.tryhungry.com/chef-dashboard?start=${startStr}&end=${endStr}`, {
            headers: {
                "Authorization": HUNGRY_COOKIE,
                "Accept": "application/json"
            }
        });
        
        if (res.status === 401 || res.status === 403) {
            console.error("Authentication rejected! Token expired.");
            process.exit(1);
        }

        let rawText = await res.text();
        let orders = [];
        try {
            orders = JSON.parse(rawText);
        } catch(e) {
            console.error("❌ Failed to parse JSON! Raw response was: ", rawText.substring(0, 300));
            process.exit(1);
        }
        
        let count = 0;
        for (let order of orders) {
            if (order.status === "Cancelled" || order.deleted) continue;

            let pickUpRaw = order.pickupTimes && order.pickupTimes.length > 0 ? order.pickupTimes[0] : order.date;
            
            // Extract YYYY-MM-DD reliably without shifting timezone arbitrarily
            let datePartStr = pickUpRaw.split('T')[0];
            let timePartStr = pickUpRaw.includes('T') ? pickUpRaw.split('T')[1].split('-')[0].split('+')[0] : "10:00:00"; 
            
            let [year, month, day] = datePartStr.split('-');
            let formattedDate = `${year}-${month}-${day}`;
            
            // Reformat HH:MM military to exactly HH:MM AM/PM inherently without Node UTC shifting
            let rawHours = parseInt(timePartStr.split(':')[0], 10);
            let rawMinutes = timePartStr.split(':')[1] || "00";
            let ampm = rawHours >= 12 ? 'PM' : 'AM';
            let formattedHours = rawHours % 12;
            formattedHours = formattedHours ? formattedHours : 12;
            let pickUpTimeStr = `${formattedHours}:${rawMinutes} ${ampm}`;

            // Parse Confirm Date natively converting from UTC to Pacific Time to avoid incorrect UTC rollovers seen in cutoff stamps
            let confirmRaw = order.cutoffTime || pickUpRaw;
            let confirmDateStr = confirmRaw;
            try {
                 confirmDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(confirmRaw));
            } catch(e) {}
            
            // Parse Items List natively
            let itemsList = [];
            let validItems = order.items ? order.items.filter(i => i.quantity > 0) : [];
            validItems.forEach(i => {
                let cleanName = i.item || "Unknown Dish";
                
                // Standardization
                cleanName = cleanName.replace(/\bw\//gi, 'With ');
                cleanName = cleanName.replace(/\s*\(GF\)/gi, '');
                cleanName = cleanName.replace(/\s+/g, ' ').trim();
                cleanName = cleanName.replace(/\bwith\b/gi, 'With');

                itemsList.push({
                    Item_Name: cleanName,
                    Item_Amount: parseInt(i.quantity) || 1,
                    Item_Total: parseFloat(i.finalPrice || 0) * (parseInt(i.quantity) || 1)
                });
            });

            // If the order has no items, inject TBD placeholder (like Unfinalized orders)
            if (itemsList.length === 0) {
               itemsList.push({ Item_Name: "Menu TBD - Unfinalized", Item_Amount: 1, Item_Total: 0 });
            }

            let mappedType = String(order.mealType || "").toLowerCase().includes('group') ? "meal manager" : "catering";
            
            let orderIdParsed = `GRPSFO${String(order.orderNumber || "").replace(/[^0-9]/g, '')}`;

            let orderPayload = {
                Order_ID: orderIdParsed,
                Customer_Name: orderIdParsed, // Setting Customer Name explicitly to Order ID like ClubFeast
                Order_Type: mappedType,
                PickUp_Date: formattedDate,
                Order_Confirmation_Date: confirmDateStr,
                PickUp_Time: pickUpTimeStr,
                Deliver_Time: "N/A",  // Usually pickup
                Deliver_Address: "", // Hungry does not provide target addresses
                Order_Subtotal: parseFloat(order.grossPayout || 0),
                Tax: parseFloat(order.tax || 0),
                Order_Total: parseFloat(order.totalPayout || 0),
                Order_Notes: order.instructions || order.dietaryPreferences || "No instructions provided.",
                Utensils: order.usesReusablePackages ? "No (Reusable)" : "Yes",
                platforms: "Hungry",
                Item: itemsList
            };

            const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(orderPayload.Order_ID);
            const existingSnap = await orderRef.get();
            const existingData = existingSnap.exists ? existingSnap.data() : null;

            await orderRef.set({
                ...orderPayload,
                orderUpdated: admin.firestore.FieldValue.serverTimestamp(),
                isNewlyCreated: !existingData
            }, { merge: true });

            count++;
            console.log(`📠 Synced Order ${orderPayload.Order_ID} | Total $${orderPayload.Order_Total} -> Firebase!`);
            await new Promise(r => setTimeout(r, 400));
        }

        console.log(`\n🎉 Total Hungry Native Processing Complete! Exported ${count} active arrays.`);
        process.exit(0);

    } catch(e) {
        console.error("Critical Failure: ", e);
        process.exit(1);
    }
})();
