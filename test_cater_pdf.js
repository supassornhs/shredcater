import fs from 'fs';
import dotenv from 'dotenv';
import { PDFExtract } from 'pdf.js-extract';

(async () => {
    dotenv.config();
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();
    
    const configSnap = await db.collection('configurations').doc('cater2me').get();
    let CATER_COOKIE = configSnap.exists ? configSnap.data().cookie : null;

    const res = await fetch("https://vendor.cater2.me/api/vendor/orders?limit=10", { headers: { "Cookie": CATER_COOKIE } });
    const json = await res.json();
    
    // find order 422115311 or first one
    const target = json.find(j => j.id == '422115311') || json[0];
    console.log("ORDER PROPS:", target);

    const pdfUrl = target.pdf_url;
    
    if (pdfUrl) {
      const pdfRes = await fetch(pdfUrl, { headers: { "Cookie": CATER_COOKIE } });
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      const pdfExtractor = new PDFExtract();
      const data = await pdfExtractor.extractBuffer(pdfBuffer, {});
      let text = "";
      data.pages.forEach(page => {
          let lastY = -1;
          page.content.forEach(item => {
              if (lastY !== -1 && Math.abs(item.y - lastY) > 5) text += "\n";
              text += item.str + " ";
              lastY = item.y;
          });
          text += "\n";
      });
      console.log("HEADCOUNT:", text.match(/HEADCOUNT:\s*(\d+)/i)?.[1]);
    }
    process.exit(0);
})();
