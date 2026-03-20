import fs from 'fs';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { PDFExtract } from 'pdf.js-extract';

dotenv.config();

const CATER_COOKIE = process.env.CATER_COOKIE || "";
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore(admin.app(), 'shredcater');
const pdfExtractor = new PDFExtract();

(async () => {
    console.log("\n⚡ Initiating Cater2.Me Hybrid PDF+JSON Scraper Engine...");
    if (!CATER_COOKIE) {
        console.error("❌ CATER_COOKIE is missing from .env!");
        process.exit(1);
    }

    try {
        console.log("👉 Validating Active Orders from Vendor Dashboard...");
        const res = await fetch("https://dashboard.cater2.me/vendor_app/orders", {
            headers: { "Cookie": CATER_COOKIE, "Accept": "application/json" }
        });
        
        const listData = await res.json();
        
        let validOrders = [];
        if (listData && listData.dates) {
            listData.dates.forEach(dateObj => {
                if (dateObj.orders && dateObj.orders.length > 0) {
                    dateObj.orders.forEach(o => {
                        if (o.guid) {
                           validOrders.push({
                               guid: o.guid,
                               original_id: o.menu ? o.menu.original_id : o.id,
                               type: o.type, // e.g. "Group Ordering" or "Managed Ordering"
                               day: dateObj.day, // "Friday March 20 2026"
                               pdf_url: o.print_order_sheet_path
                           });
                        }
                    });
                }
            });
        }
        
        console.log(`✅ Dynamically isolated ${validOrders.length} Cater2.Me shipments.`);

        for (let i = 0; i < validOrders.length; i++) {
            let o = validOrders[i];
            const order_Id_String = `#${o.original_id}`;
            console.log(`\n[${i+1}/${validOrders.length}] 📥 Fetching Source PDF for ${order_Id_String}...`);
            
            // DOWNLOAD AND PARSE PDF IN MEMORY
            const pdfRes = await fetch(o.pdf_url, { headers: { "Cookie": CATER_COOKIE, "Accept": "*/*" } });
            const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
            const data = await pdfExtractor.extractBuffer(pdfBuffer, {});
            
            let text = "";
            data.pages.forEach(page => {
                let lastY = -1;
                page.content.forEach(item => {
                    if (lastY !== -1 && Math.abs(item.y - lastY) > 5) text += "\n";
                    text += item.str + " ";
                    lastY = item.y;
                });
                text += "\n";
            });

            // USER OVERRIDES & REGEX CAPTURES
            let contactMatch = text.match(/CONTACT:\s*(.+)/);
            let companyMatch = text.match(/COMPANY:\s*(.+)/);
            let contact = contactMatch ? contactMatch[1].trim() : "";
            let company = companyMatch ? companyMatch[1].trim() : "";
            let customerName = `${contact} (${company})`.trim();
            if (customerName === "()") customerName = "Unknown Client";

            let setupTimeMatch = text.match(/Set-Up Completed By:\s*(.+)/);
            let pickUpTime = setupTimeMatch ? setupTimeMatch[1].trim() : "N/A";

            let addressMatch = text.match(/ADDRESS:([\s\S]+?)DELIVERY INSTRUCTIONS:/);
            let addressArr = addressMatch ? addressMatch[1].trim().split('\n').map(l=>l.trim()).filter(l=>l) : [];
            let address = addressArr.join(', ').replace(/\s{2,}/g, ' ');

            let instructionsMatch = text.match(/DELIVERY INSTRUCTIONS:([\s\S]+?)(Order Instructions|Order Confirmation|Scheduled Order|Menu Preview)/i);
            let instructions = instructionsMatch ? instructionsMatch[1].trim().replace(/\n/g, ' - ') : "N/A";

            let mappedType = "catering"; // Managed typically becomes catering
            let subTotalNum = 0, taxNum = 0, totalNum = 0;
            let itemsList = [];

            if (o.type && o.type.toLowerCase().includes('group')) {
                mappedType = "meal manager";
                itemsList.push({ Item_Name: "Menu TBD - Group Ordering Not Closed", Item_Amount: 1, Item_Total: 0 });
            } else {
                itemsList.push({ Item_Name: "Finalized Managed Order Items", Item_Amount: 1, Item_Total: 0 });
                // If the user wants specific Managed Prices extracted from PDF later, we can add Regex here!
            }

            // Date YYYY-MM-DD
            let dateObj = new Date(o.day);
            let year = String(dateObj.getFullYear());
            let month = String(dateObj.getMonth() + 1).padStart(2, '0');
            let day = String(dateObj.getDate()).padStart(2, '0');
            let formattedDate = `${year}-${month}-${day}`;

            let orderPayload = {
                Order_ID: order_Id_String,
                Customer_Name: customerName,
                Order_Type: mappedType,
                PickUp_Date: formattedDate,
                PickUp_Time: "",
                Deliver_Time: pickUpTime,
                Deliver_Address: address || "N/A",
                Order_Subtotal: subTotalNum,
                Tax: taxNum,
                Order_Total: totalNum,
                Order_Notes: instructions, 
                Utensils: "Yes",
                platforms: "Cater2.ME",
                Item: itemsList
            };

            const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(order_Id_String);
            const existingSnap = await orderRef.get();
            const existingData = existingSnap.exists ? existingSnap.data() : null;

            await orderRef.set({
                ...orderPayload,
                orderUpdated: admin.firestore.FieldValue.serverTimestamp(),
                isNewlyCreated: !existingData
            }, { merge: true });

            console.log(`📠 Safely vaulted Order ${order_Id_String} [${mappedType.toUpperCase()}] mapped to -> ${pickUpTime}`);
            await new Promise(r => setTimeout(r, 800)); // Respect server quotas
        }
        
        console.log(`\n🎉 Total 100% Native Automated Extraction Complete! Data synchronized!`);
        process.exit(0);
        
    } catch(e) {
        console.error("Critical Failure: ", e);
        process.exit(1);
    }
})();
