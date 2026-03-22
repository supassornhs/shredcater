const fs = require('fs');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    file = dir + '/' + file;
    if (fs.statSync(file).isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('route.ts')) results.push(file);
  });
  return results;
}

const files = walk('./dashboard/dashboard-app/src/app/api');
let patched = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  if (content.includes('shredcater2')) {
      const matchRegex = /if \(!admin\.apps\.length\) \{[\s\S]*?\}\s*\} else \{\s*admin\.initializeApp\(\{[\s\S]*?applicationDefault\(\),[\s\S]*?'shredcater2',[\s\S]*?\}\);\s*\}\s*\}/;
      
      const replaceStr = `if (!admin.apps.length) {
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
  }`;

      let newContent = content.replace(matchRegex, replaceStr);

      if (content !== newContent) {
          fs.writeFileSync(f, newContent);
          patched++;
      } else {
          console.log("Failed to regex match inside: " + f);
      }
  }
});
console.log("Patched " + patched + " files.");
