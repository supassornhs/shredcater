import FirecrawlApp from '@mendable/firecrawl-js';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Initialize Firecrawl App
const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

// ==========================================
// FIREBASE ADMIN INITIALIZATION
// ==========================================
const serviceAccountPath = './serviceAccountKey.json';
let db = null;

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = getFirestore('shredcater'); // named database
  console.log('✅ Firebase initialized using serviceAccountKey.json.');
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'shredcater2'
    });
    db = getFirestore('shredcater'); // named database
    console.log('✅ Firebase initialized (Database: shredcater).');
  } catch (err) {
    console.error('🚨 Firebase Init Error:', err.message);
    console.warn('⚠️  Could not initialize Firebase.');
    console.warn('   To fix this, either:');
    console.warn('   1. Place "serviceAccountKey.json" in this folder.');
    console.warn('   2. Run: gcloud auth application-default login');
  }
}

/**
 * SCRAPE AND SAVE LOGIC
 */
async function scrapeCateringPlatform(target) {
  const { url, headers, platform, actions } = target;
  try {
    console.log(`\n⏳ Starting Firecrawl structured scrape for: ${url} (${platform})`);
    
    const schema = {
      type: "object",
      properties: {
        orders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              Order_ID: { type: "string" },
              PickUp_Date: { type: "string", description: "Date of the pickup/order in YYYY-MM-DD format" },
              platforms: { type: "string" },
              Customer_Name: { type: "string" },
              Order_Confirm_Date: { type: "string" },
              Order_Type: { type: "string", description: "Either 'meal manager' or 'catering'." },
              PickUp_Time: { type: "string" },
              Deliver_Time: { type: "string" },
              Deliver_Address: { type: "string" },
              Deliver_Instruction: { type: "string" },
              Deliver_Driver: { type: "string" },
              Deliver_Partner: { type: "string" },
              Order_Subtotal: { type: "number" },
              Tax: { type: "number" },
              Order_Total: { type: "number" },
              Order_Notes: { type: "string" },
              Utensils: { type: "string" },
              Confirmation_Code: { type: "string" },
              Item: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    Item_Name: { type: "string" },
                    Item_Amount: { type: "number" },
                    Item_Price: { type: "number" },
                    Item_Customization: { type: "string" },
                    Item_Total: { type: "number" }
                  }
                }
              }
            },
            required: ["Order_ID", "PickUp_Date"]
          }
        }
      }
    };

    // Call firecrawl to scrape and extract JSON with headers and actions
    const scrapeResult = await app.scrape(url, {
      formats: [
        {
          type: 'json',
          schema: schema,
          prompt: target.prompt || "Extract active catering orders including order ID, date, delivery location, type, order notes, and item amounts."
        }
      ],
      headers: headers || {},
      actions: actions || []
    });
    
    if (scrapeResult.success === false && !scrapeResult.json) {
      console.error(`🚨 Firecrawl Scrape Failed for ${platform}:`, JSON.stringify(scrapeResult.error || scrapeResult, null, 2));
      return;
    }

    const data = scrapeResult.json || (scrapeResult.data && scrapeResult.data.json);

    if (!data || !data.orders || data.orders.length === 0) {
      console.warn(`⚠️ No orders found or structured data failed for ${url}.`);
      return;
    }

    console.log(`✅ Extracted ${data.orders.length} orders from ${platform}`);

    if (db) {
      for (const order of data.orders) {
        order.platforms = platform;
        await saveOrderToFirestore(order);
      }
    }

  } catch (err) {
    console.error(`🚨 Error processing ${url}:`, err.message);
  }
}

/**
 * FIRESTORE HIERARCHY LOGIC
 */
async function saveOrderToFirestore(order) {
  try {
    let dateStr = order.PickUp_Date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const d = new Date(dateStr);
        dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    }
    const [year, month, day] = dateStr.split('-');

    const orderRef = db.collection('orders').doc(year).collection('months').doc(month).collection('days').doc(day).collection('entries').doc(order.Order_ID || `ORDER_${Date.now()}`);
    
    const existingSnap = await orderRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;

    if (existingData) {
      let isSame = existingData.Order_Total === order.Order_Total && 
                   existingData.Order_Type === order.Order_Type &&
                   existingData.Deliver_Address === order.Deliver_Address &&
                   existingData.Order_Notes === order.Order_Notes &&
                   JSON.stringify(existingData.Item || []) === JSON.stringify(order.Item || []);
      
      if (isSame) {
        return; // No changes, do nothing.
      }
    }

    await orderRef.set({
      ...order,
      PickUp_Date: dateStr,
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const oldTotal = existingData ? (existingData.Order_Total || 0) : 0;
    const newTotal = order.Order_Total || 0;
    const diffTotal = newTotal - oldTotal;
    const isNewOrder = !existingData;

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
            platforms: order.platforms || 'Unknown'
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

    const analyticsRef = db.collection('analytics');
    if (diffTotal !== 0 || isNewOrder) {
      await analyticsRef.doc('daily').collection('history').doc(dateStr).set({
        total_sales: admin.firestore.FieldValue.increment(diffTotal),
        order_count: admin.firestore.FieldValue.increment(isNewOrder ? 1 : 0)
      }, { merge: true });
    }

    if (order.platforms && diffTotal !== 0) {
      await analyticsRef.doc('platform_totals').set({
        [order.platforms]: admin.firestore.FieldValue.increment(diffTotal)
      }, { merge: true });
    }

    console.log(`📡 Synced [${order.platforms || 'Unknown'}] Order #${order.Order_ID} to Firebase. (Updated)`);
  } catch (error) {
    console.error(`❌ Firestore Save Error:`, error.message);
  }
}

const targetSites = [
  {
    url: 'https://restaurant.clubfeast.com/?tab=open',
    platform: 'ClubFeast',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyZXN0YXVyYW50X2lkIjozOTA0LCJzY29wZSI6InVzZXIiLCJlbnYiOiJwcm9kdWN0aW9uIiwiaXNzdWVkX2F0IjoiMjAyNi0wMy0wNSAxODoyMTo0MyAtMDgwMCIsImlzc3VlZF9mb3IiOiJwYWRwYWRAaG9seXNocmVkLmNvIiwic2Vzc2lvbl9pZCI6MjA2NTI0fQ.i-qsogjZvWH4lxKdlLhVzQm9M81X831Y2sm2X3U9PLI',
      'Cookie': 'token=eyJhbGciOiJIUzI1NiJ9.eyJyZXN0YXVyYW50X2lkIjozOTA0LCJzY29wZSI6InVzZXIiLCJlbnYiOiJwcm9kdWN0aW9uIiwiaXNzdWVkX2F0IjoiMjAyNi0wMy0wNSAxODoyMTo0MyAtMDgwMCIsImlzc3VlZF9mb3IiOiJwYWRwYWRAaG9seXNocmVkLmNvIiwic2Vzc2lvbl9pZCI6MjA2NTI0fQ.i-qsogjZvWH4lxKdlLhVzQm9M81X831Y2sm2X3U9PLI'
    },
    prompt: "Scan active ClubFeast orders. CRITICAL: For 'order_id', you MUST extract the actual alphanumeric order tracking code (e.g. #HTB-L260317-P5RW). DO NOT mistake the ClubFeast team member's name (e.g. Krizhel Ann Canque) for the Order ID!"
  },
  {
    url: 'https://vendor.cater2.me/',
    platform: 'Cater2.me',
    headers: {
      'Authorization': 'Basic YzJtZToxNzY0c3RhZ2U=',
      'Cookie': '_gcl_aw=GCL.1767839890.Cj0KCQiApfjKBhC0ARIsAMiR_IutqiweAgaUUarfl196rIinXdWEx4wWRla5Fh4sb-7WycUcRJNxFwgaAttnEALw_wcB; _gcl_gs=2.1.k1$i1767839888$u140241910; cc_consent_cc-modal-user-location={"country":"United States","countryCode":"US","region":"CA","regionName":"California","city":"San Francisco","timezone":"America/Los_Angeles"}; __hstc=142297069.d10e94e9fd6391722e474294134182f7.1773681165682.1773681165682.1773681165682.1; hubspotutk=d10e94e9fd6391722e474294134182f7; _fbp=fb.1.1773681183176.197818603802727681; remember_user_token=eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaGJDRnNHYVFPWDZRRkpJallrTW1Fa01UQWtNRXhVTWxsUFRVNUJhMFF6VDJkUGRFUXdjeTVrVDBoSGRUbHBWM001UTB4cGRucFhkVVIzYlZReUJqb0dSVlJKSWhjeE56Y3pPRFUzT1RJNUxqWXhNRFl5TlRNR093QkciLCJleHAiOiIyMDI2LTA0LTAxVDE4OjE4OjQ5LjYxMFoiLCJwdXIiOiJjb29raWUucmVtZW1iZXJfdXNlcl90b2tlbiJ9fQ%3D%3D--c7e4be6c4dde9b2cc201aa5c96b509b6eb5d0b58; XSRF-TOKEN=QVVLPA9JcciNDM28Z6RCTatr0D3NiiOxn3TUD0o-wauMqtLtQGaKSRlIe8wfslxVHBD3MCA3KV8GIpMWMYZxJQ; _cater2me_session=BwKtVyz%2BDFmOkNRz%2FJYB5qGJ99SeLmjVJLj7UTbZu33H0YpLaREWA2YmO%2F5ct2JAcRio%2BowRkVu%2B2lXIMbfuxgN9eliyuCfXARQX0LBw5xR5abJP0AZ1SqSqe36vN%2BSO9%2B4rYZ6U7QFYkyAJ98Ej%2BZRuEbbL6NtrZsvQasEeHSdt5nJ5lfDNcF4avdGnY3H0n8x9v9c9jiqv7qSzdvNnrxbVHrJqImwjksWNc%2BN4YpwuDL9zfJc2z%2FuH%2FJdYOjBH66bxAIE0Y6PalHEUesTydluLtij77vgaoGgQS20Y3lLOWmA27rAyuvxDUcdnByTzXBbZ01FwL91zNh1Y7H4g8vKAMMaU7D%2BD0Zl6PLWkn2AqfPa%2B1BTpc1Z5kSf1PL0d%2BKR%2FyEb6HvFJMGY91qQ4ThSxcGF%2FxpqR%2BzR%2BmnZPj%2Fv%2BO5eQyhKmIfIb8DD%2BO6x73ZkbIjgzFq5s1M8oVrztjFh9urAtC28WfPx0Z18%3D--iVTGOc%2BGBW88SRNf--S3vta1%2Ff0pWSPnjTpj09iw%3D%3D'
    },
    actions: [
      { type: 'wait', milliseconds: 10000 }
    ],
    prompt: "Scan the Cater2.me dashboard for active catering orders. Look specifically for tables or lists indicating 'Upcoming' or 'Active'. Extract the Order ID (e.g. #CT-XXXX), date, delivery location, type (meal manager or catering), order notes, and exact item amounts."
  },
  {
    url: 'https://ezmanage.ezcater.com/orders',
    platform: 'ezCater',
    actions: [
      { type: 'wait', milliseconds: 5000 },
      { type: 'write', selector: 'input[type="email"], input[name="email"]', text: "Supassorn@holyshred.co" },
      { type: 'write', selector: 'input[type="password"], input[name="password"]', text: "Supassorn_2493" },
      { type: 'click', selector: 'button[type="submit"], input[type="submit"], button:has-text("Log"), button:has-text("Sign")' },
      { type: 'wait', milliseconds: 15000 },
      { type: 'click', selector: 'a[href*="/orders/"], tr:nth-of-type(1)' },
      { type: 'wait', milliseconds: 5000 }
    ],
    prompt: "Scan the ezCater order page. Look for an order formatted like XXX-XXX characters. Extract the data exactly as follows: year/month/date from 'Order on [Date] at [Time]'. orderID as the XXX-XXX name. platforms='ezcater'. type is usually catering. confirmation_code from 'confirmation code'. deliveryname from 'delivery to'. deliverylocation from 'delivery to' address. deliverytime from 'customer requested delivery time'. handofftime from 'Order on [Date] at [Time]'. deliverypartner from 'partner' under delivery to. items is the name of the dish, amount under Qty column, itemnotes in 'view more details'."
  },
  {
    url: 'https://foodja.com/restaurant-portal/',
    platform: 'Foodja',
    actions: [
      { type: 'wait', milliseconds: 5000 },
      { type: 'write', selector: 'input[type="email"], input[name="email"]', text: "Supassorn@holyshred.co" },
      { type: 'write', selector: 'input[type="password"], input[name="password"]', text: "Supassorn_2493" },
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'wait', milliseconds: 15000 }
    ],
    prompt: "Scan the Foodja restaurant portal. Look for the 'Active Orders' or 'Upcoming Deliveries' list. Extract the real order ID (not employee notes). Pull the delivery date, full delivery location, order type, order notes, and every item along with its numerical amount."
  },
  {
    url: 'https://chefs.tryhungry.com/',
    platform: 'Hungry',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3Njg5NzQ4OTgsImlzcyI6ImFwaS50cnlodW5ncnkuY29tIiwic3ViIjoiZWNhMWFiOGItY2Y2NS00MGIwLWJkY2UtMzY0NWIzYzMwYTRkIiwicGVybWlzc2lvbnMiOnsiOSI6WyJjaGVmIl19LCJjcmVhdGVkQXQiOiIwMDAxLTAxLTAxVDAwOjAwOjAwWiIsImVtYWlsIjoicGFkcGFkQGhvbHlzaHJlZC5jbyIsInVzZXJUeXBlIjoxLCJpc0NvbmZpcm1lZCI6ZmFsc2UsImlzVGVzdFVzZXIiOmZhbHNlLCJjdXJyZW50SFEiOjl9.PaW1Psj9m8s22PYtxWEc28D_YUp3ZsmurpBDl22s-ErdRXhU56AEr_KCQR5sm5_HM7CUqwcdW8zARGBadlHGr8GOrENGywzddwpYKIMoXSQGnVPWgGGeyPVui0XsJzHPxt4_EuSbjPivxogBhzZKgE_suUusF8CvhURfERLFPmw',
      'Cookie': '_ga=GA1.2.979107790.1767839873; _hp2_id.3656056008=%7B%22userId%22%3A%228390301026595877%22%2C%22pageviewId%22%3A%225717850826771988%22%2C%22sessionId%22%3A%225852076562965247%22%2C%22identity%22%3Anull%2C%22trackerVersion%22%3A%224.0%22%7D; _hjSessionUser_3024029=eyJpZCI6ImFiNzc1MWJkLWIxZGUtNWJiZi1hZGQwLTk3ODE1MzlhYzc3MCIsImNyZWF0ZWQiOjE3Njg5NzQ2NzAxODMsImV4aXN0aW5nIjp0cnVlfQ==; ph_phc_8jmQjrSRqekv34itLOSnW3q9nh2G0tziwe3suR1csWR_posthog=%7B%22distinct_id%22%3A%22019bdf1b-451b-7043-97f3-8fb79ae25f05%22%2C%22%24sesid%22%3A%5B1768974884197%2C%22019bdf1b-451a-75dc-a240-73a70608cc0f%22%2C1768974664986%5D%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22https%3A%2F%2Fwww.google.com%2F%22%2C%22u%22%3A%22https%3A%2F%2Ftryhungry.com%2Flogin%22%7D%7D; _gid=GA1.2.295133937.1773851250; _gat_UA-107378588-1=1'
    },
    actions: [
      { type: 'wait', milliseconds: 5000 }
    ],
    prompt: "Scan the Hungry chefs dashboard for scheduled catering orders. Look for the confirmed upcoming delivery timeline. Extract the definitive order ID, exact date in YYYY-MM-DD, delivery location, order type, any special order notes, and the detailed list of item amounts required."
  }
];

async function run() {
  console.log("🚀 Starting Authenticated Catering Data Sync...");
  for (const site of targetSites) {
    await scrapeCateringPlatform(site);
  }
  console.log("\n✨ All tasks finished.");
}

run();
