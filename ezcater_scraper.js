import puppeteer from 'puppeteer';
import fs from 'fs';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { sendTokenExpiryAlert } from './notify.js';

const serviceAccountPath = './serviceAccountKey.json';
let db = null;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = getFirestore('shredcater'); 
} else {
  console.log("No service account!");
  process.exit(1);
}

(async () => {
    console.log("🚀 Launching Stealth Chromium for EzCater Sandbox...");
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();

    console.log("📡 Fetching your Cookie from Firebase Dashboard...");
    const configSnap = await db.collection('configurations').doc('ezcater').get();
    const EZ_COOKIE = configSnap.exists ? configSnap.data().cookie : null;

    if (!EZ_COOKIE) {
        console.error("❌ ezCater Cookie is missing from Dashboard! Please paste it in the UI.");
        await browser.close();
        process.exit(1);
    }

    // Inject the cookie dynamically to bypass login
    const parsedCookies = EZ_COOKIE.split(';').map(c => {
        const parts = c.trim().split('=');
        return { name: parts[0], value: parts.slice(1).join('='), domain: '.ezcater.com' };
    }).filter(c => c.name.length > 0);

    await page.setCookie(...parsedCookies);
    console.log("🔑 Injected Cookie Session. Navigating to EzManage Core...");

    // Go to an empty page or basic UI to execute the fetch in context
    await page.goto("https://ezmanage.ezcater.com/orders", { waitUntil: 'domcontentloaded' });

    console.log("📡 Accessing EzManage GraphQL...");
    let ordersData;
    try {
        ordersData = await page.evaluate(async () => {
        const query = `query OrdersQuery($sourceTypes: [OrderSource], $startDate: DateTime, $endDate: DateTime, $catererId: ID, $personalStoreGroupId: ID, $limit: Int!, $offset: Int, $orderByField: CatererOrderSortField!, $orderByDirection: SortDirection!, $searchString: String, $filter: OrderStateFilterEnum, $marketingTypes: [Marketing!]) {\n  me {\n    id\n    catererAccount {\n      id\n      orders(\n        sourceTypes: $sourceTypes\n        startDate: $startDate\n        endDate: $endDate\n        catererId: $catererId\n        personalStoreGroupId: $personalStoreGroupId\n        offset: $offset\n        orderBy: {field: $orderByField, direction: $orderByDirection}\n        limit: $limit\n        searchString: $searchString\n        filter: $filter\n        marketingTypes: $marketingTypes\n      ) {\n        edges {\n          catererWorkflowState {\n            status\n            paymentStatus {\n              displayText\n            }\n          }\n          node {\n            id\n            orderNumber\n            submittedAt\n            event {\n              deliveryTime\n              orderType\n              timestamp\n              contact {\n                name\n              }\n            }\n            catererCart {\n              totals {\n                catererTotalDue\n              }\n            }\n            orderCustomer {\n              firstName\n              lastName\n            }\n            orderSourceType\n          }\n        }\n      }\n    }\n  }\n}`;
        
        const variables = {
            "catererId": null,
            "personalStoreGroupId": null,
            "limit": 10,
            "offset": 0,
            "orderByDirection": "DESC",
            "orderByField": "EVENT_AT",
            "sourceTypes": ["MARKETPLACE", "EZ_ORDERING", "DIRECT_ENTRY", "CLUB_SODA"]
            // Omit filter completely to allow all statuses (past + upcoming)
        };

        const res = await fetch("https://ezmanage-api.ezcater.com/graphql", {
            method: "POST",
            credentials: "include", // EXTREMELY IMPORTANT: THIS ATTACHES THE EZCATER LOGGED-IN COOKIE
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify([{
                operationName: "OrdersQuery",
                variables: variables,
                query: query
            }])
        });
        
        if (res.status === 401 || res.status === 403 || res.redirected || !res.ok) {
             return { error: 'auth_failed' };
        }

        return res.json();
    });
    } catch (e) {
        ordersData = { error: 'auth_failed' };
    }

    if (!ordersData || ordersData.error === 'auth_failed' || ordersData.error) {
        console.error("❌ ezCater authentication failed! Cookie expired.");
        await db.collection('configurations').doc('ezcater').set({
            error: "Token expired or invalid",
            last_failed: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await sendTokenExpiryAlert(db, admin, 'ezCater');
        await browser.close();
        process.exit(1);
    }

    // Auth succeeded, clear any existing errors globally
    await db.collection('configurations').doc('ezcater').set({
        error: admin.firestore.FieldValue.delete(),
        last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const orderPayload = ordersData[0]?.data?.me?.catererAccount?.orders?.edges || [];
    console.log(`\n📦 EzCater Extracted ${orderPayload.length} Orders from History!`);

    let synced = 0;
    for (const edge of orderPayload) {
        const orderInfo = edge.node;
        const total = orderInfo.catererCart?.totals?.catererTotalDue || 0;
        const dbOrderId = `EZC${orderInfo.orderNumber}`;
        const timestampIso = orderInfo.event?.timestamp || orderInfo.submittedAt;
        const rawDate = new Date(timestampIso);
        const contactName = orderInfo.event?.contact?.name || "Unknown";
        
        // Lock timezone directly to America/Los_Angeles so GitHub Actions doesn't drift dates
        const sfDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(rawDate);
        const [yr, mo, dy] = sfDateStr.split('-');
        const formattedDate = `${yr}-${mo}-${dy}`;
        
        const localTimeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true }).format(rawDate);

        const targetDoc = db.collection('orders').doc(yr)
                            .collection('months').doc(mo)
                            .collection('days').doc(dy)
                            .collection('entries').doc(dbOrderId);

        await targetDoc.set({
            Order_ID: dbOrderId,
            originalId: orderInfo.orderNumber,
            originalDate: formattedDate,
            source: 'ezcater',
            platforms: 'ezCater',
            PickUp_Date: formattedDate,
            PickUp_Time: localTimeStr,
            Customer_Name: contactName,
            Event_Name: contactName,
            Contact_Name: contactName,
            Total: total,
            Subtotal: total, // We don't have tax/tip breakdown natively yet
            status: edge.catererWorkflowState?.status || "unknown"
        }, { merge: true });
        
        console.log(`   ✅ Synced EzCater Order ${dbOrderId} ($${total}) for ${formattedDate}`);
        synced++;
    }

    console.log(`\n🎉 Success! Push-synced ${synced} orders to Firebase!`);
    await browser.close();
})();
