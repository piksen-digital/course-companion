import * as admin from 'firebase-admin';

/**
 * SANITIZED INITIALIZATION
 * This version handles the "warning triangle" issues by stripping 
 * hidden whitespace, newlines, and Vercel's formatting artifacts.
 */

const initAdmin = () => {
  if (admin.apps.length > 0) return;

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!raw) {
      console.warn("⚠️ Missing FIREBASE_SERVICE_ACCOUNT in Vercel.");
      return;
    }

    // SANITIZATION STEP:
    // 1. Remove all actual newlines (the "enter-like" symbols in Vercel)
    // 2. Trim whitespace from both ends
    const sanitized = raw.replace(/[\r\n]+/g, "").trim();

    const serviceAccount = JSON.parse(sanitized);

    // Fix the private key internal formatting
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\n/g, '\n') // Turn literal "\n" into real newlines
        .replace(/^"|"$/g, ''); // Remove accidental double quotes
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin successfully initialized after sanitization.");
  } catch (err: any) {
    // This prevents the "Application Error" crash
    console.error("❌ Firebase init failed:", err.message);
  }
};

initAdmin();

export const adminDb = admin.apps.length ? admin.firestore() : (null as any);
export const adminAuth = admin.apps.length ? admin.auth() : (null as any);

export default admin;
