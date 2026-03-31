import puppeteer from 'puppeteer';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore('shredcater');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const configSnap = await db.collection('configurations').doc('clubfeast').get();
  const FIREBASE_COOKIE = configSnap.exists ? configSnap.data().cookie : null;

  if (FIREBASE_COOKIE && FIREBASE_COOKIE.startsWith("Bearer ")) {
      await page.setExtraHTTPHeaders({ 'Authorization': FIREBASE_COOKIE });
  } else if (FIREBASE_COOKIE && FIREBASE_COOKIE.length > 10) {
      const parsedCookies = FIREBASE_COOKIE.split(';').map(c => {
          const parts = c.trim().split('=');
          return { name: parts[0], value: parts.slice(1).join('='), domain: 'restaurant.clubfeast.com' }
      });
      await page.setCookie(...parsedCookies);
  }

  // Go to OPEN tab
  await page.goto('https://restaurant.clubfeast.com/?tab=open', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 6000));
  
  const getVisibleLinks = () => {
    let links = [];
    function collectLinks(root) {
      root.querySelectorAll('a').forEach(a => {
        if (a.href && (a.href.includes('/orders/') || a.href.includes('/packages/'))) {
           // check visibility
           const style = window.getComputedStyle(a);
           if (style.display !== 'none' && style.visibility !== 'hidden' && a.offsetWidth > 0) {
              links.push(a.href);
           }
        }
      });
      root.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) collectLinks(el.shadowRoot);
      });
    }
    collectLinks(document);
    return links;
  };

  const openLinks = await page.evaluate(getVisibleLinks);
  console.log("OPEN LINKS FOUND:", openLinks);

  // Click Finalized tab instead of page.goto
  await page.evaluate(() => {
     let clicked = false;
     document.querySelectorAll('*').forEach(el => {
       if (el.shadowRoot) {
          el.shadowRoot.querySelectorAll('a, button, div, span').forEach(x => {
            if (x.innerText && x.innerText.includes('Finalized') && !clicked) {
              x.click(); clicked = true;
            }
          });
       }
     });
     if (!clicked) {
         // fallback click based on href
         document.querySelectorAll('a[href*="tab=finalized"]').forEach(x => x.click());
     }
  });

  await new Promise(r => setTimeout(r, 6000));
  const finalizedLinks = await page.evaluate(getVisibleLinks);
  console.log("FINALIZED LINKS FOUND:", finalizedLinks);

  await browser.close();
  process.exit(0);
})();
