import fs from 'fs';

(async () => {
    let rawCookieTemp = fs.readFileSync('cookie.temp', 'utf8');
    let CATER_COOKIE = rawCookieTemp.split('=')[1].trim(); 
    // Wait, the cookie.temp looks like: CATER_COOKIE_TEMP="cookievalue"
    // I should just use substring
    CATER_COOKIE = rawCookieTemp.substring(rawCookieTemp.indexOf('=') + 1).replace(/^"|"$/g, '').trim();

    console.log("Cookie length:", CATER_COOKIE.length);

    console.log("Fetching new API...");
    const res = await fetch("https://dashboard.cater2.me/vendor_app/orders", { 
        headers: { "Cookie": CATER_COOKIE, "Accept": "application/json" } 
    });
    const listData = await res.json();
    
    // Find valid orders
    let validOrders = [];
    if (listData && listData.dates) {
        listData.dates.forEach(dateObj => {
            if (dateObj.orders && dateObj.orders.length > 0) {
                dateObj.orders.forEach(o => {
                    if (o.guid) {
                       validOrders.push(o);
                    }
                });
            }
        });
    }

    fs.writeFileSync('cater2me_sample.json', JSON.stringify(validOrders, null, 2));
    console.log(`Saved ${validOrders.length} valid orders to cater2me_sample.json (Active Dashboard)`);
    
    console.log("Fetching Legacy Vendor API...");
    const legRes = await fetch("https://vendor.cater2.me/api/vendor/orders?limit=15", {
        headers: { "Cookie": CATER_COOKIE, "Accept": "application/json" }
    });
    const legJson = await legRes.json();
    fs.writeFileSync('cater_legacy.json', JSON.stringify(legJson.slice(0,2), null, 2));
    console.log(`Saved ${legJson.length} valid orders to cater_legacy.json`);

    process.exit(0);
})();
