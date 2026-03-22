import puppeteer from 'puppeteer';
import fs from 'fs';
import readline from 'readline';

import dotenv from 'dotenv';
dotenv.config();

// ==========================================
// 🔑 PASTE YOUR AUTHENTICATION TOKENS HERE
// ==========================================
const CLUBFEAST_COOKIE = process.env.CLUBFEAST_COOKIE || "token=...";
const CLUBFEAST_AUTH = process.env.CLUBFEAST_AUTH || "Bearer ...";
// ==========================================

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = './serviceAccountKey.json';
let db = null;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = getFirestore('shredcater'); 
} else {
  admin.initializeApp({ projectId: 'shredcater2' });
  db = getFirestore('shredcater'); 
}

const AUTH_FILE = './clubfeast_auth.json';

(async () => {
  console.log("🚀 Launching Chrome to scrape ClubFeast...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Prevent GUI popups
    defaultViewport: null
  }); 
  const page = await browser.newPage();

  console.log("📡 Fetching your synchronized Cookie from Firebase...");
  const configSnap = await db.collection('configurations').doc('clubfeast').get();
  const FIREBASE_COOKIE = configSnap.exists ? configSnap.data().cookie : null;

  // Inject Custom Authorization Header (ONLY if provided natively by user)
  if (CLUBFEAST_AUTH && CLUBFEAST_AUTH !== "Bearer ...") {
      await page.setExtraHTTPHeaders({
        'Authorization': CLUBFEAST_AUTH
      });
  }

  // Inject User-Provided Cookie/Token from Dashboard UI dynamically
  if (FIREBASE_COOKIE && FIREBASE_COOKIE.startsWith("Bearer ")) {
      await page.setExtraHTTPHeaders({
        'Authorization': FIREBASE_COOKIE
      });
      console.log("🔑 Authenticating natively via Bearer Authorization Header from Dashboard!");
  } else if (FIREBASE_COOKIE && FIREBASE_COOKIE.length > 10) {
      const parsedCookies = FIREBASE_COOKIE.split(';').map(c => {
          const parts = c.trim().split('=');
          return {
              name: parts[0],
              value: parts.slice(1).join('='),
              domain: 'restaurant.clubfeast.com'
          }
      });
      await page.setCookie(...parsedCookies);
      console.log("🍪 Loaded custom Dashboard Cookie natively from Firebase!");
  } else if (CLUBFEAST_COOKIE && CLUBFEAST_COOKIE !== "token=...") {
      const parsedCookies = CLUBFEAST_COOKIE.split(';').map(c => {
          const parts = c.trim().split('=');
          return {
              name: parts[0],
              value: parts.slice(1).join('='),
              domain: 'restaurant.clubfeast.com'
          }
      });
      await page.setCookie(...parsedCookies);
      console.log("🍪 Loaded custom Session Cookie from the script block!");
  } else if (fs.existsSync(AUTH_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      await page.setCookie(...cookies);
      console.log("🍪 Loaded saved session cookies!");
  }

  console.log("Navigating to ClubFeast...");
  await page.goto('https://restaurant.clubfeast.com/?tab=open', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 6000));
  let bodyText = await page.evaluate(() => document.body.innerText);

  if (bodyText.includes('Sign in') || bodyText.includes('Verification Code') || bodyText.includes('Authentication Code')) {
      console.log("\n❌ FATAL ERROR: The Cookie you provided in your Dashboard is missing or expired.");
      console.log("👉 Please go to your Dashboard > Platform Connections, click 'Update Cookie Token', and paste a fresh token!");
      await browser.close();
      return;
  }

  console.log("\n🔍 Logging in successful! Preparing deep-link Order Extraction...");

  let orderLinks = new Set();

  await new Promise(r => setTimeout(r, 5000));
  
  // 1. Scan CURRENT dashboard for Order Links
  console.log("👉 Scanning the Active Dashboard for Order Routing Links...");
  let currentLinks = await page.evaluate(() => {
     let links = [];
     document.querySelectorAll('a').forEach(a => {
         if (a.href && (a.href.includes('/orders/') || a.href.includes('/packages/'))) {
             links.push(a.href);
         }
     });
     return links;
  });
  currentLinks.forEach(l => orderLinks.add(l));
  console.log(`✅ Found ${currentLinks.length} active order routes.`);

  // 2. Historical crawling section removed per user request (focusing only on new ones!)

  let finalLinks = Array.from(orderLinks);
  console.log(`\n🎯 Mission Pipeline initialized! Scraping ${finalLinks.length} independent Order Pages...`);

  let extractedOrders = [];

  for (let i = 0; i < finalLinks.length; i++) {
      let route = finalLinks[i];
      console.log(`[${i+1}/${finalLinks.length}] Navigating into ${route}...`);
      await page.goto(route, { waitUntil: 'networkidle2' });
      
      try {
          await page.waitForFunction(() => document.body.innerText.includes('Order Total') || document.body.innerText.includes('Subtotal'), { timeout: 9000 });
      } catch (e) {}
      await new Promise(r => setTimeout(r, 4000));
      
      const debugDump = await page.evaluate(() => document.body.innerText);

      const orderData = await page.evaluate(() => {
          let textObject = document.body.innerText || "";
          
          const idMatch = textObject.match(/(#[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)/) || textObject.match(/([A-Z0-9]{3}-L\d{6}-[A-Z0-9]{4})/);
          
          let urlId = null;
          try { urlId = window.location.href.split('/orders/')[1].split('?')[0]; } catch(e){}
          
          let orderId = idMatch ? idMatch[1].replace('#', '') : (urlId ? urlId.replace('#', '') : null);

          if (!orderId) return null;

          // Attempt to locate names (Heuristic: usually top block above the ID)
          let elements = Array.from(document.querySelectorAll('div, span, h1, h2, h3, h4, h5, p'));
          let customerName = "";
          for (let el of elements) {
              if (el.innerText && el.innerText.includes('Order:') && el.innerText.includes(orderId)) {
                  let maybeName = el.parentElement?.innerText.split('\n')[0] || "";
                  if (maybeName && !maybeName.includes('#') && !maybeName.includes('Club')) customerName = maybeName;
                  break;
              }
          }

          // Search for Delivery Data
          const timeMatch = textObject.match(/(?:Pick up|Estimated).*?at (\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
          const pickUpTime = timeMatch ? timeMatch[1] : "N/A";

          let orderSubtotal = 0, tax = 0, orderTotal = 0;
          let docPrices = Array.from(textObject.matchAll(/\$(\d+\.\d{2})/g)).map(m => Number(m[1]));
          
          if (docPrices.length >= 3 && textObject.match(/Order Total|Total:/i)) {
              orderTotal = docPrices[docPrices.length - 1] || 0;
              tax = docPrices[docPrices.length - 2] || 0;
              orderSubtotal = docPrices[docPrices.length - 3] || 0;
          } else if (docPrices.length > 0 && textObject.match(/Order Total|Total:/i)) {
              orderTotal = docPrices[docPrices.length - 1] || 0;
          }

          let formattedDate = 'YYYY-MM-DD';
          const dateMatch = textObject.match(/[A-Z][a-z]+day,\s[A-Z][a-z]+\s\d{1,2}(st|nd|rd|th)?,\s20\d{2}/) || textObject.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
          if (dateMatch) {
              try {
                  const dObj = new Date(dateMatch[0].replace(/(st|nd|rd|th)/, ''));
                  if (!isNaN(dObj.getTime())) {
                       const y = dObj.getFullYear();
                       const m = String(dObj.getMonth() + 1).padStart(2, '0');
                       const d = String(dObj.getDate()).padStart(2, '0');
                       formattedDate = `${y}-${m}-${d}`;
                  }
              } catch(e) {}
          }
          
          if (formattedDate === 'YYYY-MM-DD' && orderId && orderId.includes('-L')) {
              try {
                  let dStr = orderId.split('-L')[1].substring(0, 6);
                  if (dStr.length === 6 && !isNaN(dStr)) {
                      formattedDate = `20${dStr.substring(0,2)}-${dStr.substring(2,4)}-${dStr.substring(4,6)}`;
                  }
              } catch(e) {}
          }
          
          if (formattedDate === 'YYYY-MM-DD') {
              let urlDateMatch = window.location.href.match(/date=(\d{4}-\d{2}-\d{2})/);
              if (urlDateMatch) formattedDate = urlDateMatch[1];
          }

          const utensils = textObject.toLowerCase().includes('utensils') ? 'Yes' : 'No';

          const items = [];
          const lines = textObject.split('\n').map(l => l.trim()).filter(l => l);
          let currentItem = null;
          
          for (let line of lines) {
              if (line.match(/Subtotal:|Tax Amount|Order Total|Download Labels/i)) {
                  break;
              }
              const qtyMatch = line.match(/^(\d+)\s*x\s*(.*)$/);
              if (qtyMatch) {
                  if (currentItem) items.push(currentItem);
                  
                  let rawName = qtyMatch[2].trim();
                  // Strip the "(1 piece)" or "(4 pieces)" suffix to standardize names
                  let cleanName = rawName.replace(/\s*\(\d+\s*pieces?\)/i, '').trim();

                  // Additional standardization
                  cleanName = cleanName.replace(/\bw\//gi, 'With ');
                  cleanName = cleanName.replace(/\s*\(GF\)/gi, '');
                  cleanName = cleanName.replace(/\s+/g, ' ').trim();
                  cleanName = cleanName.replace(/\bwith\b/gi, 'With');

                  currentItem = {
                      Item_Amount: parseInt(qtyMatch[1], 10),
                      Item_Name: cleanName,
                      Item_Total: 0
                  };
              } else if (currentItem && line.match(/^\$(\d+\.\d{2})/)) {

                  currentItem.Item_Total = parseFloat(line.replace('$', ''));
              }
          }
          if (currentItem) items.push(currentItem);

          let mathematicalSubtotal = items.reduce((sum, item) => sum + item.Item_Total, 0);
          if (orderSubtotal < mathematicalSubtotal || orderSubtotal === 0) {
              orderSubtotal = mathematicalSubtotal;
              tax = Number((mathematicalSubtotal * 0.0863).toFixed(2));
              orderTotal = Number((mathematicalSubtotal + tax).toFixed(2));
          }

          return {
             Order_ID: orderId,
             PickUp_Date: formattedDate,
             PickUp_Time: pickUpTime,
             Order_Subtotal: orderSubtotal,
             Tax: tax,
             Order_Total: orderTotal,
             Utensils: utensils,
             Customer_Name: customerName, 
             Order_Type: "meal manager",
             platforms: "ClubFeast",
             Item: items
          };
      });

      if (orderData) {
          extractedOrders.push(orderData);
          console.log(`   └─ Successfully parsed ${orderData.Order_ID} (${orderData.Item.length} unique items)`);
      } else {
          console.log("   └─ Failed to isolate order frame. Skipping.");
      }
  }

  console.log("\n✅ Total mathematical array size: " + extractedOrders.length + " isolated ClubFeast orders!");

  // SAVE TO FIREBASE
  for (const order of extractedOrders) {
     if (!order.Order_ID || !order.PickUp_Date) continue;

     try {
        let dateStr = order.PickUp_Date;
        const [year, month, day] = dateStr.split('-');
        
        order.Order_ID = order.Order_ID.trim();

        const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(order.Order_ID);
        
        const existingSnap = await orderRef.get();
        const existingData = existingSnap.exists ? existingSnap.data() : null;

        await orderRef.set({
          ...order,
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
                platforms: "ClubFeast"
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
        
        console.log(`📡 Synced ClubFeast Order ${order.Order_ID} to Firebase. (Updated)`);
     } catch (err) {
        console.error(`❌ Firestore Save Error for ${order.Order_ID}:`, err.message);
     }
  }

  console.log("\n🎯 ClubFeast Scrape Mission Accomplished!");

  console.log("Closing browser in 5 seconds...");
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();

})();
