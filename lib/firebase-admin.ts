import * as admin from 'firebase-admin';

const initAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  try {
    const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!base64Json) {
      // During build, Vercel might not have this key. 
      // We log but don't crash the whole process yet.
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT missing during initialization");
      return null;
    }

    const jsonString = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(jsonString);
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    console.error("❌ Firebase Init Failed:", error.message);
    return null;
  }
};

// Initialize
initAdmin();

// Export initialized services
export const adminDb = admin.apps.length ? admin.firestore() : null!;
export const adminAuth = admin.apps.length ? admin.auth() : null!;
export default admin;
