import puppeteer from 'puppeteer';
import fs from 'fs';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

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
    const ordersData = await page.evaluate(async () => {
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
        
        return res.json();
    });

    const orderPayload = ordersData[0]?.data?.me?.catererAccount?.orders?.edges || [];
    console.log(`\n📦 EzCater Extracted ${orderPayload.length} Orders from History!`);

    let synced = 0;
    for (const edge of orderPayload) {
        const orderInfo = edge.node;
        const total = orderInfo.catererCart?.totals?.catererTotalDue || 0;
        const dbOrderId = `EZC${orderInfo.orderNumber}`;
        const rawDate = new Date(orderInfo.event?.timestamp || orderInfo.submittedAt);
        const contactName = orderInfo.event?.contact?.name || "Unknown";
        
        // Zero pad components
        const yr = rawDate.getFullYear().toString();
        const mo = (rawDate.getMonth() + 1).toString().padStart(2, '0');
        const dy = rawDate.getDate().toString().padStart(2, '0');
        const formattedDate = `${yr}-${mo}-${dy}`;
        
        const localTimeStr = rawDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

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
