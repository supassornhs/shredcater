import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const CATER_COOKIE = process.env.CATER_COOKIE || "";

(async () => {
    console.log("Fetching Cater2.Me JSON API directly...");
    try {
        const response = await fetch("https://dashboard.cater2.me/vendor_app/orders", {
            headers: {
                "Cookie": CATER_COOKIE,
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive"
            }
        });
        
        let jsonRes = await response.text();
        fs.writeFileSync('cater2me_api_dump.json', jsonRes);
        console.log("✅ Successfully captured API response! Length: " + jsonRes.length);
    } catch(e) {
        console.log(e);
    }
})();
