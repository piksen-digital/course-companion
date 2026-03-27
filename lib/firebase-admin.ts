import * as admin from 'firebase-admin';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // This handles the single-line string you just fixed in Vercel
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// These names MUST match the imports in your /api/auth and /api/webhook routes
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
