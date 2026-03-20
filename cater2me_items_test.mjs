import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const CATER_COOKIE = process.env.CATER_COOKIE || "";

(async () => {
    console.log("Fetching Cater2.Me Individual Order JSON API directly...");
    try {
        const response = await fetch("https://dashboard.cater2.me/vendor_app/orders/757fa5a7-c3cb-4217-8210-63c7fe0678e0", {
            headers: {
                "Cookie": CATER_COOKIE,
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive"
            }
        });
        
        let jsonRes = await response.text();
        fs.writeFileSync('cater2me_items_dump.json', jsonRes);
        console.log("✅ Successfully captured API response! Length: " + jsonRes.length);
    } catch(e) {
        console.log(e);
    }
})();
