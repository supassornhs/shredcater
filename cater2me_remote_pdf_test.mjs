import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const CATER_COOKIE = process.env.CATER_COOKIE || "";

(async () => {
    try {
        console.log("Fetching PDF remotely...");
        const res = await fetch("https://dashboard.cater2.me/orders/757fa5a7-c3cb-4217-8210-63c7fe0678e0/print/order_sheet", {
            headers: { "Cookie": CATER_COOKIE, "Accept": "*/*" }
        });
        const buff = await res.arrayBuffer();
        fs.writeFileSync('remote_test.pdf', Buffer.from(buff));
        console.log("Saved remote_test.pdf: " + buff.byteLength + " bytes");
    } catch(e) { console.log(e); }
})();
