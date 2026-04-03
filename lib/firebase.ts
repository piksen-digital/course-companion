import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Parse the JSON string from Vercel environment variables
const getConfig = () => {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse NEXT_PUBLIC_FIREBASE_CONFIG", e);
    return {};
  }
};

const firebaseConfig = getConfig();

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
