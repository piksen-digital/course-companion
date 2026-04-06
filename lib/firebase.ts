import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * BASE64 FRONTEND DECODER
 * This ensures Vercel cannot mangle your API keys.
 */

const getClientConfig = () => {
  const base64 = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!base64) {
    console.error("❌ NEXT_PUBLIC_FIREBASE_CONFIG is missing!");
    return {};
  }
  
  try {
    // atob() is the browser's way to decode Base64
    const jsonString = window.atob(base64);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("❌ Failed to decode/parse Frontend Firebase Config:", e);
    return {};
  }
};

const firebaseConfig = getClientConfig();

// Initialize
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
