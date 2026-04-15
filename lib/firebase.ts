import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * CLIENT-SIDE FIREBASE INITIALIZATION (BASE64)
 * This prevents Vercel from mangling the JSON configuration.
 */

const getClientConfig = () => {
  const base64 = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  
  if (!base64) {
    console.error("❌ NEXT_PUBLIC_FIREBASE_CONFIG is missing in Environment Variables");
    return {};
  }
  
  try {
    // 1. Clean the base64 string of any accidental whitespace/newlines
    const cleanedBase64 = base64.trim().replace(/\s/g, '');
    
    // 2. Decode the Base64 string
    const jsonString = window.atob(cleanedBase64);
    
    // 3. Parse into an object
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("❌ Failed to decode/parse Frontend Firebase Config.");
    console.error("Error details:", e);
    return {};
  }
};

const firebaseConfig = getClientConfig();

// Initialize Firebase only if we have a valid config
const app = (getApps().length > 0) 
  ? getApp() 
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
