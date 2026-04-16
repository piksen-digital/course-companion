import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';
  
  try {
    await adminDb.doc(`artifacts/${appId}/public/data/course_config`).set({
      content: "Demo Course: Introduction to AI. AI is the simulation of human intelligence by machines.",
      lastUpdated: new Date().toISOString(),
      source: 'System Force Start'
    }, { merge: true });

    res.status(200).json({ message: "Database Awake! Your app should now load." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
