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
  if (content.includes("if (fs.existsSync(serviceAccountPath)) {") && !content.includes("FIREBASE_BASE64_KEY")) {
      
    let matchStr = "if (fs.existsSync(serviceAccountPath)) {";
    
    let replaceStr = `if (process.env.FIREBASE_BASE64_KEY || process.env.FIREBASE_SERVICE_ACCOUNT) {
      const keyString = process.env.FIREBASE_BASE64_KEY ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;
      const serviceAccount = JSON.parse(keyString || '{}');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'shredcater',
      });
    } else if (fs.existsSync(serviceAccountPath)) {`;
    
    let newContent = content.replace(matchStr, replaceStr);
    newContent = newContent.replace(/'shredcater2'/g, "'shredcater'");

    if (content !== newContent) {
        fs.writeFileSync(f, newContent);
        patched++;
    }
  }
});
console.log("Patched " + patched + " files.");
