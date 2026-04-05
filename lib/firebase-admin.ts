import * as admin from 'firebase-admin';

const initAdmin = () => {
  if (admin.apps.length > 0) return;

  try {
    const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!base64Json) return;

    // Decodes the Base64 string back into the original JSON
    const jsonString = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(jsonString);

    // Fix internal private key formatting just in case
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin Initialized via Base64");
  } catch (error: any) {
    console.error("❌ Firebase Init Failed:", error.message);
  }
};

initAdmin();
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
