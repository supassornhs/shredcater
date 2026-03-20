import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const CATER_COOKIE = process.env.CATER_COOKIE || "";

(async () => {
    let endpoints = [
        "https://dashboard.cater2.me/vendor_app/past_orders",
        "https://dashboard.cater2.me/vendor_app/order_history",
        "https://dashboard.cater2.me/vendor_app/orders/past",
        "https://dashboard.cater2.me/vendor_app/orders?type=past"
    ];
    
    for (let ep of endpoints) {
        console.log("Testing: " + ep);
        try {
            const response = await fetch(ep, {
                headers: {
                    "Cookie": CATER_COOKIE,
                    "Accept": "*/*"
                }
            });
            console.log("Status: " + response.status);
            if (response.status === 200) {
                let jsonRes = await response.text();
                console.log("Length: " + jsonRes.length);
                if (jsonRes.length > 100) {
                    fs.writeFileSync('cater2me_past_api.json', jsonRes);
                    console.log("Found past orders API!");
                }
            }
        } catch(e) {}
    }
})();
