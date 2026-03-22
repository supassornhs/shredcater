import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_BASE64_KEY || process.env.FIREBASE_SERVICE_ACCOUNT) {
        const keyString = process.env.FIREBASE_BASE64_KEY 
          ? Buffer.from(process.env.FIREBASE_BASE64_KEY, 'base64').toString('utf8') 
          : process.env.FIREBASE_SERVICE_ACCOUNT;
        
        const serviceAccount = JSON.parse(keyString || '{}');
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: 'shredcater',
        });
        console.log('✅ Dashboard API: Initialized using Environment Variables');
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: 'shredcater',
        });
        console.log('✅ Dashboard API: Initialized using applicationDefault()');
      }
    } catch (err: any) {
      console.error('🚨 Dashboard API: Firebase Init Error:', err.message);
    }
  }
}

export function getDb() {
  initFirebaseAdmin();
  return getFirestore('shredcater');
}

export default admin;
