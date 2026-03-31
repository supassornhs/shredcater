import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// -- CONFIG --
const inputFile = 'forkable_email.txt';
// ----------------

let db = null;
try {
  let sAcct = './serviceAccountKey.json';
  if (fs.existsSync(sAcct)) {
      const sa = JSON.parse(fs.readFileSync(sAcct, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      db = getFirestore('shredcater'); 
  } else {
      admin.initializeApp({ projectId: 'shredcater2' });
      db = getFirestore('shredcater');
  }
} catch(e) { console.log(e); }

async function run() {
    if (!fs.existsSync(inputFile)) {
        console.error(`❌ Missing ${inputFile}. Please paste your Forkable email text into it and try again.`);
        process.exit(1);
    }
    const text = fs.readFileSync(inputFile, 'utf8');

    // 1. Regex Parsing
    let dateMatch = text.match(/DATE\[?\n\s*\]?\s*(.+?202\d|.+?(?=LOCATION|\n\n))/i) || text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ a-z]*\s+\d{1,2}(?:\s*,\s*202\d)?/i);
    let locationMatch = text.match(/LOCATION\s*\n\s*(.+)/i) || text.match(/LOCATION:\s*(.+)/i) || ["", "Pickup Location"];
    let timeDriverMatch = text.match(/Pickup Time(?:\(s\))?:\s*(.+?)-(?:(?:\s*Driver\s*)(.+))?/i) || text.match(/Pickup Time(?:\(s\))?:\s*(.+)/i);
    let subtotalMatch = text.match(/Sub\s?Total\s*\$([0-9,.]+)/i);
    let titleDateMatch = text.match(/Forkable Pickup\s+([a-zA-Z]+,?\s+[a-zA-Z]+\s+\d{1,2})\s+at\s+([0-9:]+[APM]+)/i);

    let rawDate = dateMatch ? dateMatch[1] || dateMatch[0] : (titleDateMatch ? titleDateMatch[1] : new Date().toDateString());
    let cleanDate = new Date(rawDate);
    if(isNaN(cleanDate.getTime()) && rawDate) {
        // Assume current year if missing
        cleanDate = new Date(`${rawDate} ${new Date().getFullYear()}`);
    }

    let year = cleanDate.getFullYear().toString();
    let month = (cleanDate.getMonth() + 1).toString().padStart(2, '0');
    let day = cleanDate.getDate().toString().padStart(2, '0');
    let formattedDate = `${year}-${month}-${day}`;

    let pickupTime = timeDriverMatch ? timeDriverMatch[1].trim() : (titleDateMatch ? titleDateMatch[2] : "10:00AM");
    let driverName = (timeDriverMatch && timeDriverMatch[2]) ? timeDriverMatch[2].trim() : "Unassigned";
    let subtotal = subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, '')) : 0;
    let location = locationMatch[1].trim();

    // 2. Format
    let orderId = `FRK-${month}${day}-${pickupTime.replace(':','')}`;
    
    let orderPayload = {
        Order_ID: orderId,
        Customer_Name: `Forkable Order`,
        Order_Type: "MEAL MANAGER",
        PickUp_Date: formattedDate,
        Order_Confirmation_Date: new Date().toISOString().split('T')[0],
        PickUp_Time: pickupTime,
        Deliver_Time: pickupTime,
        Deliver_Address: location,
        Order_Subtotal: subtotal,
        Tax: 0,
        Order_Total: subtotal,
        Order_Net: subtotal,
        Deliver_Driver: driverName,
        Utensils: "Yes",
        status: "NEW", // Ensure lowercase for frontend styling if necessary, but standard is NEW
        platforms: "Forkable",
        Order_Notes: "Forkable grouped email order. See email for dietary details.",
        Item: [
            {
                Item_Name: "Forkable Group Meals",
                Item_Amount: 1,
                Item_Total: subtotal
            }
        ],
        isNewlyCreated: true
    };
    
    console.log("============= PARSED FORKABLE ORDER =============");
    console.log(orderPayload);
    console.log("=================================================");
    
    // 3. Save
    const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(orderPayload.Order_ID);
    
    await orderRef.set({
        ...orderPayload,
        status: "new", // enforce lowercase status for the database UI badges
        orderUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`📠 Synced Order ${orderPayload.Order_ID} | Total $${orderPayload.Order_Total} -> Firebase!`);
    console.log(`\n🎉 Forkable Email Processing Complete!`);
    process.exit(0);
}

run().catch(console.error);
