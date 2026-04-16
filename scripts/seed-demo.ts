import { adminDb } from '../lib/firebase-admin';

/**
 * DATABASE WAKE-UP SCRIPT
 * This manually injects demo data into the path your app is watching.
 */

const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';

async function wakeUpDatabase() {
  console.log("🚀 Starting Database Wake-up...");

  const demoData = {
    content: `
      Welcome to the AI Course Companion! 
      This is a demo lesson about Artificial Intelligence. 
      AI is a field of computer science that focuses on creating systems capable of performing tasks that typically require human intelligence.
      Key concepts include Machine Learning, Neural Networks, and Natural Language Processing.
    `,
    lastUpdated: new Date().toISOString(),
    source: 'Manual Wake-up Script'
  };

  try {
    // We target the exact path your App.tsx is listening to
    const docRef = adminDb.doc(`artifacts/${appId}/public/data/course_config`);
    
    await docRef.set(demoData, { merge: true });
    
    console.log("✅ Database is AWAKE!");
    console.log(`📍 Path: artifacts/${appId}/public/data/course_config`);
  } catch (error) {
    console.error("❌ Failed to wake up database:", error);
  }
}

wakeUpDatabase();
