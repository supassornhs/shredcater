import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// 1. Initialize Gemini AI (used to automatically read raw emails into exactly the JSON structure we need)
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// 2. Initialize Firebase (re-using the logic from index.js)
const serviceAccountPath = './serviceAccountKey.json';
let db = null;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = getFirestore('shredcater'); // named database
} else {
  admin.initializeApp({ projectId: 'shredcater2' });
  db = getFirestore('shredcater'); // named database
}

/**
 * CONNECTS TO GMAIL VIA IMAP, SEARCHES UNREAD EMAILS, PARSES THEM
 */
async function processEmails() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.error("🚨 Missing EMAIL_USER or EMAIL_APP_PASSWORD in .env file");
    console.log("👉 Go to your Google Account > Security > App Passwords, and generate one.");
    return;
  }

  const config = {
    imap: {
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  try {
    console.log("⏳ Connecting to Gmail IMAP...");
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Search criteria: looking for unread emails
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: [''], markSeen: false }; 

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`📬 Found ${messages.length} unread emails. Processing...`);

    for (const msg of messages) {
      const allParts = imaps.getParts(msg.attributes.struct);
      const rawEmailContent = msg.parts.find(p => p.which === '')?.body;

      if (rawEmailContent) {
        // Parse raw email into a readable object (extract text/html, subject, sender)
        const parsedEmail = await simpleParser(rawEmailContent);
        const textContent = parsedEmail.text || "No text available.";
        const subject = parsedEmail.subject || "No Subject";
        const sender = parsedEmail.from?.value[0]?.address || "Unknown";

        console.log(`\n📧 Evaluating Email: "${subject}" from ${sender}`);

        // IMPORTANT: We only want to process emails that ACTUALLY look like catering orders
        if (subject.toLowerCase().includes("order") || textContent.toLowerCase().includes("catering")) {
            console.log("   Brainstorming extraction via OpenAI...");
            const orderDataArray = await extractOrderData(textContent, subject, sender);

            if (orderDataArray && orderDataArray.length > 0) {
              for (const order of orderDataArray) {
                // Determine platform based on sender or email text
                order.platforms = order.platforms || determinePlatform(sender, textContent);
                console.log(`   ✅ Extracted Order: ${order.Order_ID} ($${order.Order_Total}) from ${order.platforms}`);
                await saveOrderToFirestore(order);
              }
              // If successful, mark as read so we don't process it next time
              await connection.addFlags(msg.attributes.uid, '\\Seen');
            } else {
              console.log("   ⚠️ Could not extract valid catering order data. Skipping.");
            }
        } else {
          console.log("   ⏭️ Skipping: Does not look like a catering order.");
        }
      }
    }

    connection.end();
    console.log("\n✨ Email synchronization complete.");
  } catch (error) {
    console.error("🚨 IMAP Error:", error.message);
  }
}

/**
 * USES AI TO PARSE UNSTRUCTURED EMAIL TEXT INTO OUR JSON FORMAT
 */
async function extractOrderData(emailText, subject, sender) {
  if (!genAI) {
      console.warn("   ⚠️ Missing GEMINI_API_KEY in .env. Skipping AI extraction.");
      return null;
  }

  try {
    const prompt = `
    You are an AI that extracts catering orders from raw email text. 
    Analyze the following email from "${sender}" with subject "${subject}".
    
    If it contains a catering order, extract it and return a strict JSON object. 
    DO NOT return any markdown, text outline, or conversational filler.
    Required format:
    {
      "orders": [
        {
          "Order_ID": "string",
          "PickUp_Date": "YYYY-MM-DD",
          "Customer_Name": "string",
          "Order_Confirm_Date": "string",
          "Order_Type": "string (either 'meal manager' or 'catering')",
          "PickUp_Time": "string",
          "Deliver_Time": "string",
          "Deliver_Address": "string",
          "Deliver_Instruction": "string",
          "Deliver_Driver": "string",
          "Deliver_Partner": "string (Guess from sender or text, e.g. ezCater, ClubFeast)",
          "Order_Subtotal": 0.00,
          "Tax": 0.00,
          "Order_Total": 0.00,
          "Order_Notes": "string",
          "Utensils": "string",
          "Confirmation_Code": "string",
          "Item": [
            { "Item_Name": "string", "Item_Amount": 0, "Item_Price": 0.00, "Item_Customization": "string", "Item_Total": 0.00 }
          ]
        }
      ]
    }
    
    If there is NO valid order, return {"orders": []}.
    
    EMAIL TEXT:
    ${emailText.substring(0, 5000)}
    `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      generationConfig: { responseMimeType: "application/json" } 
    });

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    
    return parsed.orders || [];

  } catch (err) {
    console.error("   🚨 Gemini Extraction Error:", err.message);
    return null;
  }
}

/**
 * HELPER: GUESS PLATFORM FROM SENDER IF AI DOESN'T PROVIDE ONE
 */
function determinePlatform(sender, text) {
    const s = sender.toLowerCase();
    if (s.includes('ezmanage') || s.includes('ezcater')) return 'ezCater';
    if (s.includes('cater2.me')) return 'Cater2.me';
    if (s.includes('clubfeast')) return 'ClubFeast';
    if (s.includes('foodja')) return 'Foodja';
    if (s.includes('tryhungry')) return 'Hungry';
    return 'Direct Email Orders';
}

/**
 * FIRESTORE SAVING LOGIC (Exactly same as index.js)
 */
async function saveOrderToFirestore(order) {
  try {
    let dateStr = order.PickUp_Date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) dateStr = new Date().toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-');

    const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(order.Order_ID || `EMAIL_ORDER_${Date.now()}`);
    
    const existingSnap = await orderRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;

    if (existingData) {
      let isSame = existingData.Order_Total === order.Order_Total && 
                   existingData.Order_Type === order.Order_Type &&
                   existingData.Deliver_Address === order.Deliver_Address &&
                   existingData.Order_Notes === order.Order_Notes &&
                   JSON.stringify(existingData.Item || []) === JSON.stringify(order.Item || []);
      
      if (isSame) {
        return; 
      }
    }

    await orderRef.set({
      ...order,
      PickUp_Date: dateStr,
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (order.Item) {
      const dailyItemsBase = db.collection('daily_items').doc(year).collection('months').doc(month).collection('days').doc(day).collection('items');
      const oldItems = existingData ? (existingData.Item || []) : [];
      
      for (const item of order.Item) {
        const oldItem = oldItems.find(i => i.Item_Name.toLowerCase() === item.Item_Name.toLowerCase());
        const oldAmount = oldItem ? (oldItem.Item_Amount || 0) : 0;
        const diffAmount = (item.Item_Amount || 1) - oldAmount;

        if (diffAmount !== 0) {
          const dishRef = dailyItemsBase.doc(item.Item_Name.replace(/[\/\.]/g, '-')); 
          await dishRef.set({
            Item_Name: item.Item_Name,
            total_quantity: admin.firestore.FieldValue.increment(diffAmount),
            platforms: order.platforms || 'Direct Email Orders'
          }, { merge: true });
        }
      }

      for (const oldItem of oldItems) {
        const stillExists = order.Item.find(i => i.Item_Name.toLowerCase() === oldItem.Item_Name.toLowerCase());
        if (!stillExists) {
           const dishRef = dailyItemsBase.doc(oldItem.Item_Name.replace(/[\/\.]/g, '-')); 
           await dishRef.set({
              total_quantity: admin.firestore.FieldValue.increment(-(oldItem.Item_Amount || 0))
           }, { merge: true });
        }
      }
    }
    console.log(`   📡 Synced [${order.platforms || 'Unknown'}] Email Order #${order.Order_ID} to Firebase. (Updated)`);
  } catch (error) {
    console.error(`❌ Firestore Save Error:`, error.message);
  }
}

// Run the script
processEmails();
