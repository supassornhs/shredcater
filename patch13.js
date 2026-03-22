const fs = require('fs');

const files = [
  './dashboard/dashboard-app/src/app/api/components/route.ts',
  './dashboard/dashboard-app/src/app/api/components/[id]/route.ts',
  './dashboard/dashboard-app/src/app/api/components/add/route.ts',
  './dashboard/dashboard-app/src/app/api/menu/route.ts',
  './dashboard/dashboard-app/src/app/api/menu/[id]/route.ts',
  './dashboard/dashboard-app/src/app/api/menu/add/route.ts',
  './dashboard/dashboard-app/src/app/api/orders/[id]/route.ts',
  './dashboard/dashboard-app/src/app/api/orders/add/route.ts',
  './dashboard/dashboard-app/src/app/api/stock/route.ts',
  './dashboard/dashboard-app/src/app/api/stock/bulk/route.ts',
];

const newGetDb = `function getDb() {
  if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(process.cwd(), '../../serviceAccountKey.json');
    if (process.env.FIREBASE_BASE64_KEY || process.env.FIREBASE_SERVICE_ACCOUNT) {
      const keyString = process.env.FIREBASE_BASE64_KEY ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(keyString || '{}')),
        projectId: 'shredcater',
      });
    } else if (fs.existsSync(serviceAccountPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
        projectId: 'shredcater',
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'shredcater',
      });
    }
  }
  return getFirestore('shredcater');
}`;

let patched = 0;
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  
  // replace from function getDb() { ... to   return getFirestore(...); \n}
  let newContent = content.replace(/function getDb\(\) \{[\s\S]*?return getFirestore\([^)]*\);\s*\}/, newGetDb);
  
  if (content !== newContent) {
    fs.writeFileSync(f, newContent);
    patched++;
  } else {
    console.log("Failed to match in: " + f);
  }
});
console.log("Patched " + patched + " files exactly.");
