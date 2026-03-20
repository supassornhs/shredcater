import fs from 'fs';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import puppeteer from 'puppeteer';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore(admin.app(), 'shredcater');

(async () => {
    let hungryCookie = "";
    try {
        const doc = await db.collection('configurations').doc('hungry').get();
        if (doc.exists && doc.data().cookie) {
            hungryCookie = doc.data().cookie;
            console.log("Found Hungry Cookie in Firebase!");
        } else {
            console.log("No hungry config found. Using .env fallback.");
        }
    } catch(e) { console.error(e); }

    if (!hungryCookie) process.exit(1);

    console.log("🚀 Launching Chrome to inspect Hungry...");
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] }); 
    const page = await browser.newPage();

    let cookies = [];
    if (hungryCookie.includes('=')) {
        cookies = hungryCookie.split(';').map(c => {
           let [name, ...val] = c.split('=');
           return { name: name.trim(), value: val.join('=') || "", domain: ".tryhungry.com" };
        }).filter(c => c.name);
        await page.setCookie(...cookies);
        console.log("Injected " + cookies.length + " Cookies dynamically!");
    } else {
        await page.setExtraHTTPHeaders({ 'Authorization': hungryCookie });
    }
  
    page.on('response', async (response) => {
        if (response.url().includes('api') || response.url().includes('order') || response.url().includes('schedule')) {
            try {
                let text = await response.text();
                // Avoid binary files
                if (text.startsWith('{') || text.startsWith('[')) {
                    fs.writeFileSync(`hungry_api_${response.url().replace(/[^a-zA-Z0-9]/g, '_').slice(-30)}.json`, text);
                    console.log(`📥 Intercepted Network JSON: ${response.url()}`);
                }
            } catch(e) {}
        }
    });

    console.log("Navigating to Hungry...");
    await page.goto("https://chefs.tryhungry.com/", { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 6000));
  
    const bodyText = await page.evaluate(() => document.body.innerText);
    const htmlText = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('hungry_list_dump.txt', bodyText);
    fs.writeFileSync('hungry_list_html.txt', htmlText);
    
    console.log("✅ Successfully captured live HTML/DOM into hungry_list_dump.txt!");
    await browser.close();
    process.exit(0);
})();
