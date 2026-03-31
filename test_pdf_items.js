import fs from 'fs';
import dotenv from 'dotenv';
import { PDFExtract } from 'pdf.js-extract';

dotenv.config();

(async () => {
    const rawCookie = process.env.CATER_COOKIE_TEMP;
    let CATER_COOKIE = rawCookie;
    if (rawCookie && rawCookie.includes('=')) {
        CATER_COOKIE = rawCookie.substring(rawCookie.indexOf('=') + 1).replace(/^"|"$/g, '').trim();
    }
    
    // Hardcoded known order string URL
    const pdfUrl = "https://dashboard.cater2.me/orders/a7aab384-e26f-4f45-8d61-612818553652/print/order_sheet";
    const pdfRes = await fetch(pdfUrl, { headers: { "Cookie": CATER_COOKIE, "Accept": "*/*" } });
    if (!pdfRes.ok) { console.log('Fetch PDF failed', pdfRes.status); process.exit(1); }
    
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfExtractor = new PDFExtract();
    const data = await pdfExtractor.extractBuffer(pdfBuffer, {});
    
    let text = "";
    data.pages.forEach(page => {
        let lastY = -1;
        page.content.forEach(item => {
            if (lastY !== -1 && Math.abs(item.y - lastY) > 5) text += "\n";
            else text += " ";
            text += item.str.trim();
            lastY = item.y;
        });
        text += "\n";
    });
    
    fs.writeFileSync('cater_pdf_dump.txt', text);
    console.log("Dumped PDF text successfully");
    process.exit(0);
})();
