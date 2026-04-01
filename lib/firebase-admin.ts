import * as admin from 'firebase-admin';

/**
 * FULL JSON INITIALIZATION
 * This approach takes the entire Service Account JSON from Firebase 
 * and parses it in one go, avoiding common multi-variable mapping errors.
 */

const initAdmin = () => {
  if (admin.apps.length > 0) return;

  try {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!rawJson) {
      console.warn("⚠️ Missing FIREBASE_SERVICE_ACCOUNT in Vercel.");
      return;
    }

    // Parse the full JSON string
    const serviceAccount = JSON.parse(rawJson);

    // Fix the private key formatting within the object
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin successfully initialized using Full JSON.");
  } catch (error: any) {
    // This CATCH prevents the "Application Error" crash on your live site.
    console.error("❌ Firebase Admin Initialization Failed:", error.message);
  }
};

initAdmin();

// Export with fallback to prevent crashes if init failed
export const adminDb = admin.apps.length ? admin.firestore() : (null as any);
export const adminAuth = admin.apps.length ? admin.auth() : (null as any);

export default admin;
