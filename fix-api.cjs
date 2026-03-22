const fs = require('fs');
const path = require('path');

const dir = 'dashboard/dashboard-app/src/app/api';

function walk(d) {
  let results = [];
  const list = fs.readdirSync(d);
  list.forEach(file => {
    const filePath = path.join(d, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('route.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(dir);

files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  let original = text;
  
  // Replace imports
  text = text.replace(/import admin from 'firebase-admin';\r?\nimport \{ getFirestore \} from 'firebase-admin\/firestore';\r?\n(?:import fs from 'fs';\r?\nimport path from 'path';\r?\n)?/, "import { getDb } from '@/lib/firebase-admin';\n");
  
  // Remove getDb function
  text = text.replace(/function getDb\(\) \{[\s\S]*?return getFirestore\([^)]*\);[^\n]*\n\}/, '');
  
  // Remove use of admin for timestamp in API routes, we need to import admin from our library if it's used
  if (text.includes('admin.firestore.FieldValue.serverTimestamp()')) {
    if (!text.includes("import admin from '@/lib/firebase-admin';")) {
      text = text.replace("import { getDb } from '@/lib/firebase-admin';\n", "import admin, { getDb } from '@/lib/firebase-admin';\n");
    }
  }

  // Double check admin initialization doesn't use admin if not imported
  if (original !== text) {
    fs.writeFileSync(f, text, 'utf8');
    console.log('Fixed:', f);
  }
});
