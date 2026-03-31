import puppeteer from 'puppeteer';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    const rawCookie = process.env.CATER_COOKIE_TEMP;
    if (!rawCookie) { console.log('No cookie!'); process.exit(1); }

    const cookies = rawCookie.split(';').map(pair => {
        const [name, ...rest] = pair.trim().split('=');
        return { name, value: rest.join('='), domain: '.cater2.me' };
    });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setCookie(...cookies);

    console.log("Navigating to vendor dashboard...");
    await page.goto('https://dashboard.cater2.me/vendor_app/orders', { waitUntil: 'networkidle2' });
    
    // Screenshot to see what the user sees
    await page.screenshot({ path: 'cater_dashboard.png' });
    
    // Evaluate to find out if "Detailed Pricing" exists on any element!
    const elements = await page.evaluate(() => {
        let textArr = [];
        document.querySelectorAll('*').forEach(el => {
            if (el.innerText && el.innerText.includes('Total') && el.innerText.includes('Detailed Pricing')) {
                textArr.push(el.innerHTML);
            }
        });
        return textArr;
    });

    fs.writeFileSync('cater_html.txt', elements.join('\n---\n'));
    console.log("Found Detailed Pricing containers: " + elements.length);

    await browser.close();
    process.exit(0);
})();
