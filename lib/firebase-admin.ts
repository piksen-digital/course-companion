import * as admin from 'firebase-admin';

/**
 * DEFENSIVE INITIALIZATION
 * This prevents the "Application Error" crash by catching 
 * Firebase errors and logging them to Vercel instead of the browser.
 */

const initAdmin = () => {
  if (admin.apps.length > 0) return;

  try {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!rawKey || !clientEmail || !projectId) {
      console.warn("⚠️ Firebase Admin Environment Variables are incomplete.");
      return;
    }

    // Replace literal "\n" strings with real newline characters
    // and trim any accidental surrounding quotes.
    const cleanKey = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: cleanKey,
      }),
    });
    
    console.log("✅ Firebase Admin successfully initialized.");
  } catch (error: any) {
    // This CATCH prevents the server-side crash (Application Error)
    console.error("❌ Firebase Admin Initialization Failed:", error.message);
  }
};

initAdmin();

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

export default admin;
