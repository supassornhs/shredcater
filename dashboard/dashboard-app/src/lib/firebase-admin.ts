import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(process.cwd(), '../../serviceAccountKey.json');
    try {
      if (process.env.FIREBASE_BASE64_KEY || process.env.FIREBASE_SERVICE_ACCOUNT) {
        const keyString = process.env.FIREBASE_BASE64_KEY 
          ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') 
          : process.env.FIREBASE_SERVICE_ACCOUNT;
        
        const serviceAccount = JSON.parse(keyString || '{}');
        const projectId = serviceAccount.project_id || 'shredcater2';
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
        });
        console.log(`✅ Dashboard API: Initialized using Environment Variables (${projectId})`);
      } else if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        const projectId = serviceAccount.project_id || 'shredcater2';
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
        });
        console.log(`✅ Dashboard API: Initialized using serviceAccountKey.json (${projectId})`);
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: 'shredcater2',
        });
        console.log('⚠️ Dashboard API: Initialized using applicationDefault() (shredcater2)');
      }
    } catch (err: any) {
      console.error('🚨 Dashboard API: Firebase Init Error:', err.message);
      // Fallback if the above initialization throws (so it doesn't crash the server start completely)
      if (!admin.apps.length) {
         admin.initializeApp({
           projectId: 'shredcater2',
         });
      }
    }
  }
}

export function getDb() {
  initFirebaseAdmin();
  try {
    return getFirestore('shredcater'); // named database
  } catch(e) {
    return getFirestore(); // fallback to default database if named doesn't exist
  }
}

export default admin;
