const fs = require('fs');
const glob = require('glob');

const files = [
  "src/app/api/stock/route.ts",
  "src/app/api/stock/bulk/route.ts",
  "src/app/api/orders/route.ts",
  "src/app/api/orders/add/route.ts",
  "src/app/api/menu/add/route.ts",
  "src/app/api/menu/[id]/route.ts",
  "src/app/api/menu/route.ts",
  "src/app/api/components/add/route.ts",
  "src/app/api/components/route.ts",
  "src/app/api/components/[id]/route.ts"
];

const newGetDb = `function getDb() {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'shredcater2',
      });
    } else {
      const serviceAccountPath = path.resolve(process.cwd(), '../../serviceAccountKey.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || 'shredcater2',
        });
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: 'shredcater2',
        });
      }
    }
  }
  return getFirestore('shredcater');
}`;

for (const file of files) {
  const filePath = "c:/Users/User/Desktop/ShredCater/dashboard/dashboard-app/" + file;
  if (fs.existsSync(filePath)) {
    const code = fs.readFileSync(filePath, 'utf8');
    const replaced = code.replace(/function getDb\(\) \{[\s\S]*?return getFirestore\('shredcater'\);\n\}/, newGetDb);
    fs.writeFileSync(filePath, replaced);
  }
}
console.log("Patched all getDb instances!");
