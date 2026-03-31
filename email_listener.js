import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

dotenv.config();

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

const config = {
    imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_APP_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 3000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

async function processForkableEmail(text) {
    console.log("-> Attempting to parse Forkable payload...");
    
    let dateMatch = text.match(/DATE\[?\n\s*\]?\s*(.+?202\d|.+?(?=LOCATION|\n\n))/i) || text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ a-z]*\s+\d{1,2}(?:\s*,\s*202\d)?/i);
    let locationMatch = text.match(/LOCATION\s*\n\s*(.+)/i) || text.match(/LOCATION:\s*(.+)/i) || ["", "Pickup Location"];
    let timeDriverMatch = text.match(/Pickup Time(?:\(s\))?:\s*(.+?)-(?:(?:\s*Driver\s*)(.+))?/i) || text.match(/Pickup Time(?:\(s\))?:\s*(.+)/i);
    let subtotalMatch = text.match(/Sub\s?Total\s*\$([0-9,.]+)/i);
    let titleDateMatch = text.match(/Forkable Pickup\s+([a-zA-Z]+,?\s+[a-zA-Z]+\s+\d{1,2})\s+at\s+([0-9:]+[APM]+)/i);

    let rawDate = dateMatch ? (dateMatch[1] || dateMatch[0]) : (titleDateMatch ? titleDateMatch[1] : new Date().toDateString());
    let cleanDate = new Date(rawDate);
    if(isNaN(cleanDate.getTime()) && rawDate) {
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
        status: "new",
        platforms: "Forkable",
        Order_Notes: "Forkable grouped email order. See email for dietary details.",
        Item: [
            {
                Item_Name: "Forkable Group Meals",
                Item_Amount: 1,
                Item_Total: subtotal
            }
        ],
        isNewlyCreated: true,
        orderUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(orderPayload.Order_ID);
    await orderRef.set(orderPayload, { merge: true });

    console.log(`📠 Synced Email Order ${orderPayload.Order_ID} | Total $${orderPayload.Order_Total} -> Firebase!`);
    return true;
}

async function processDoordashEmail(text) {
    console.log("-> Processing incoming Doordash payload...");
    
    let subjectMatch = text.match(/New Catering Order for (.+) - ([a-zA-Z0-9]+)/i);
    let orderIdFromSub = subjectMatch ? subjectMatch[2] : Math.floor(Math.random() * 100000).toString();

    let dateMatch = text.match(/Drop Off Date\s*([A-Za-z]{3},\s*[A-Za-z]{3}\s*\d{1,2},\s*\d{4})/i) || text.match(/Drop Off Date.*\n\s*(.*)/i); 
    let timeMatch = text.match(/Drop Off Time\s*([0-9:]+\s*[APM]+)/i) || text.match(/Drop Off Time.*\n\s*(.*)/i);
    let valueMatch = text.match(/Order Value\s*\$([0-9,.]+)/i) || text.match(/Order Value.*\n\s*\$([0-9,.]+)/i);
    let locationMatch = text.match(/Location\s*(.*?)(?=\s*Preparation|$|View Order)/is);
    
    let customerRaw = subjectMatch ? subjectMatch[1].trim() : "Doordash Customer";

    let rawDate = dateMatch ? dateMatch[1].trim() : new Date().toDateString();
    let cleanDate = new Date(rawDate);
    if(isNaN(cleanDate.getTime())) cleanDate = new Date();

    let year = cleanDate.getFullYear().toString();
    let month = (cleanDate.getMonth() + 1).toString().padStart(2, '0');
    let day = cleanDate.getDate().toString().padStart(2, '0');
    let formattedDate = `${year}-${month}-${day}`;

    let pickupTime = timeMatch ? timeMatch[1].trim() : "12:00 PM";
    let subtotal = valueMatch ? parseFloat(valueMatch[1].replace(/,/g, '')) : 0;
    let location = locationMatch ? locationMatch[1].replace(/\s+/g, ' ').trim() : "Unknown Location";

    let orderId = `DD-${month}${day}-${orderIdFromSub}`;
    
    let orderPayload = {
        Order_ID: orderId,
        Customer_Name: customerRaw,
        Order_Type: "DOORDASH DRIVEOFF",
        PickUp_Date: formattedDate,
        Order_Confirmation_Date: new Date().toISOString().split('T')[0],
        PickUp_Time: pickupTime,
        Deliver_Time: pickupTime,
        Deliver_Address: location,
        Order_Subtotal: subtotal,
        Tax: 0,
        Order_Total: subtotal,
        Order_Net: subtotal,
        Deliver_Driver: "Doordash Driver",
        Utensils: "Yes",
        status: "new",
        platforms: "Doordash",
        Order_Notes: "Doordash catering order via email.",
        Item: [
            {
                Item_Name: "Doordash Catering Order",
                Item_Amount: 1,
                Item_Total: subtotal
            }
        ],
        isNewlyCreated: true,
        orderUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(orderPayload.Order_ID);
    await orderRef.set(orderPayload, { merge: true });

    console.log(`📠 Synced Email Order ${orderPayload.Order_ID} | Total $${orderPayload.Order_Total} -> Firebase!`);
    return true;
}

async function run() {
    console.log("🚀 Starting Native IMAP Email Listener Component...");

    imaps.connect(config).then(function (connection) {
        return connection.openBox('INBOX').then(function () {
            
            // Search criteria: Unread emails with either Forkable or Doordash in subject
            const searchCriteria = [
                'UNSEEN',
                ['OR', ['SUBJECT', 'Forkable Pickup'], ['OR', ['SUBJECT', 'Doordash'], ['SUBJECT', 'New Catering Order']]]
            ];
            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: true // Marks the email as READ after we sync it so we dont duplicate!
            };

            console.log("📡 Scanning Inbox for unread Forkable/Doordash emails...");
            return connection.search(searchCriteria, fetchOptions).then(async function (messages) {
                if (messages.length === 0) {
                    console.log("✉️ Zero new unread delivery orders found in inbox.");
                } else {
                    console.log(`✉️ Found ${messages.length} new incoming unread order(s)! Processing...`);
                }

                for (let item of messages) {
                    let all = item.parts.find(p => p.which === '');
                    let subjectHeader = item.parts.find(p => p.which === 'HEADER').body.subject[0] || '';
                    let id = item.attributes.uid;
                    
                    try {
                        let parsedMail = await simpleParser(all.body);
                        let bodyText = parsedMail.text || "";
                        let combinedText = subjectHeader + "\n\n" + bodyText;

                        if (subjectHeader.toLowerCase().includes('forkable')) {
                            await processForkableEmail(combinedText);
                        } else if (subjectHeader.toLowerCase().includes('doordash') || subjectHeader.toLowerCase().includes('new catering order')) {
                            await processDoordashEmail(combinedText);
                        }
                    } catch(e) {
                         console.error(`❌ Failed to parse email UID ${id}:`, e);
                    }
                }
                
                connection.end();
            });
        });
    }).catch(console.error);
}

run();
