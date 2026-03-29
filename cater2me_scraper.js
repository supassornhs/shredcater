import fs from 'fs';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { PDFExtract } from 'pdf.js-extract';
import { sendTokenExpiryAlert } from './notify.js';

dotenv.config();

const fallbackCookie = process.env.CATER_COOKIE || "";
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = getFirestore(admin.app(), 'shredcater');
const pdfExtractor = new PDFExtract();

(async () => {
    console.log("\n⚡ Initiating Cater2.Me Hybrid PDF+JSON Scraper Engine...");
    // 1. Fetch cookie from Firebase (dashboard) or fallback to .env
    const configSnap = await db.collection('configurations').doc('cater2me').get();
    const CATER_COOKIE = (configSnap.exists && configSnap.data().cookie) ? configSnap.data().cookie : fallbackCookie;

    if (!CATER_COOKIE) {
        console.error("❌ CATER_COOKIE is missing from Dashboard and .env!");
        process.exit(1);
    }

    try {
        console.log("👉 Validating Active Orders from Vendor Dashboard...");
        const res = await fetch("https://dashboard.cater2.me/vendor_app/orders", {
            headers: { "Cookie": CATER_COOKIE, "Accept": "application/json" }
        });

        if (res.status === 401 || res.status === 403 || res.redirected) {
            console.error("❌ Cater2.me authentication failed! Cookie expired.");
            await sendTokenExpiryAlert(db, admin, 'Cater2.me');
            process.exit(1);
        }
        
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
                               type: o.type, // e.g. "Group Ordering"
                               experience: o.experience, // "Family Style" or "Group Ordering"
                               day: dateObj.day, // "Friday March 20 2026"
                               pdf_url: o.print_order_sheet_path,
                               menu: o.menu,
                               carts_count: o.carts_count
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

            if (o.experience && o.experience.toLowerCase().includes('group')) {
                mappedType = "meal manager";
                itemsList.push({ Item_Name: "Menu TBD - Group Ordering Not Closed", Item_Amount: 1, Item_Total: 0 });
            } else {
                mappedType = "catering";
                
                // Extract precise items from PDF using robust inline iterator
                let lines = text.split('\n');
                for (let j = 0; j < lines.length; j++) {
                    let line = lines[j].trim();
                    let catMatch = /(?:ENTR[ÉeÉE]E|SIDE|SAUCE|DRESSING|APPETIZER|BEVERAGE|SERVING\s*WARE):/i.exec(line);
                    
                    if (catMatch) {
                        let catIndex = catMatch.index;
                        let beforeCat = line.substring(0, catIndex).trim();
                        let qty = 1;
                        
                        let foundNum = beforeCat.match(/(\d+)/);
                        if (foundNum) {
                            qty = parseInt(foundNum[1], 10);
                        } else {
                            // Search backwards up to 3 lines for a standalone number
                            for (let b = 1; b <= 3; b++) {
                                if (j - b >= 0 && /^\d+$/.test(lines[j-b].trim())) {
                                    qty = parseInt(lines[j-b].trim(), 10);
                                    break;
                                }
                            }
                        }
                        
                        // Extract Name
                        let colonIndex = line.indexOf(':', catIndex);
                        let rawName = line.substring(colonIndex + 1).trim();
                        
                        let k = j + 1;
                        while (k < lines.length) {
                            let nextLine = lines[k].trim();
                            if (/(?:ENTR[ÉeÉE]E|SIDE|SAUCE|DRESSING|APPETIZER|BEVERAGE|SERVING\s*WARE):/i.test(nextLine)) break;
                            if (/^\d+\s*of\s*\d+$/i.test(nextLine)) break;
                            if (/^(?:Order Confirmation|\*|Vegetarian|QUESTIONS\?|MENU ON NEXT PAGE|MENU\s*\(\d+\s*ITEMS\)|QTY|PREPARE ALL DISHES|SERVING INSTRUCTIONS|Page|UPDATED AT|ID:|VENDOR:|ORDER DATE|Check-In)/i.test(nextLine)) break;
                            
                            rawName += " " + nextLine;
                            k++;
                        }
                        
                        let cleanName = rawName.replace(/\(\d*\s*Serv\.\)/i, '').replace(/\(\d*$/i, '').replace(/\(\d*\s*S$/i, '').trim();
                        itemsList.push({ Item_Name: cleanName, Item_Amount: qty, Item_Total: 0 });
                    }
                }
                
                // Fallback
                if (itemsList.length === 0) {
                    itemsList.push({ Item_Name: "Finalized Managed Order Items", Item_Amount: 1, Item_Total: 0 });
                }
            }

            // Calculate Status based on SF Time (America/Los_Angeles)
            let nowInSF = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
            let [yStr, mStr, dStr] = o.day.split('-');
            let deliveryDateSF = new Date(Number(yStr), Number(mStr) - 1, Number(dStr)); 
            
            let thresholdSF = new Date(deliveryDateSF.getTime());
            
            if (mappedType === "meal manager") {
                thresholdSF.setDate(thresholdSF.getDate() - 1);
                thresholdSF.setHours(17, 0, 0, 0); // 5 PM the day before
            } else {
                thresholdSF.setDate(thresholdSF.getDate() - 5);
                thresholdSF.setHours(0, 0, 0, 0); // 5 days before midnight
            }
            
            let orderStatus = (nowInSF >= thresholdSF) ? "Finalized" : "New";

            // Extract Native Prices from API
            let preTaxRaw = o.menu && o.menu.pre_tax ? String(o.menu.pre_tax).replace(/[\$,]/g, '') : "0";
            let taxRaw = o.menu && o.menu.vendor_tax ? String(o.menu.vendor_tax).replace(/[\$,]/g, '') : "0";
            let totalRaw = o.menu && o.menu.vendor_final_with_tips ? String(o.menu.vendor_final_with_tips).replace(/[\$,]/g, '') : "0";
            
            subTotalNum = parseFloat(preTaxRaw) || 0;
            taxNum = parseFloat(taxRaw) || 0;
            totalNum = parseFloat(totalRaw) || 0;

            let netNum = 0;
            
            // Extract Headcount from PDF
            let headcountMatch = text.match(/HEADCOUNT:\s*(\d+)/i);
            let headcount = headcountMatch ? parseInt(headcountMatch[1], 10) : 0;
            
            // Fallback to active carts count if PDF headcount is not found (Meal Manager)
            if (headcount === 0 && o.carts_count) {
                headcount = parseInt(o.carts_count, 10);
            }

            // Wait until delivery date passes for Meal Manager to show pricing
            let hasDeliveryPassed = false;
            let nowTime = nowInSF.getTime();
            if (nowTime >= deliveryDateSF.getTime()) {
                hasDeliveryPassed = true; // Wait until delivery date passes.
            }

            if (mappedType === "meal manager" && !hasDeliveryPassed) {
               // Leave blank (0) until delivery date is passed per exact user instruction
               subTotalNum = 0;
               taxNum = 0;
               totalNum = 0;
               netNum = 0;
            } else {
               // Commission calculation: Catering (Always) OR Meal Manager (passed delivery date)
               let commissionRate = 0;
               if (headcount >= 1 && headcount <= 20) commissionRate = 0.15;
               else if (headcount >= 21 && headcount <= 50) commissionRate = 0.20;
               else if (headcount >= 51 && headcount <= 150) commissionRate = 0.25;
               else if (headcount >= 151) commissionRate = 0.30;
               
               let commissionFee = subTotalNum * commissionRate;
               netNum = totalNum - commissionFee;
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
                Order_Net: netNum,
                Order_Notes: instructions, 
                Utensils: "Yes",
                platforms: "Cater2.ME",
                status: orderStatus,
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
