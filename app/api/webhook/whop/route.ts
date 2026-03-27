import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  const body = await req.json();
  const signature = req.headers.get('x-whop-signature');

  // Verify Whop Webhook Signature (Security)
  // if (!verifyWhopSignature(body, signature)) return new Response('Unauthorized', { status: 401 });

  const { action, data } = body;
  const appId = process.env.WHOP_APP_ID;

  if (action === 'content.updated' || action === 'content.created') {
    // Extract text from the Whop lesson
    const newContent = data.content_body || data.description;
    
    await adminDb.doc(`artifacts/${appId}/public/data/course_config`).set({
      content: newContent,
      lastUpdated: new Date().toISOString(),
      source: 'Whop Automated Sync'
    }, { merge: true });
  }

  return NextResponse.json({ received: true });
}
2. Leaderboard LogicAdd this to your Firestore Security Rules to allow students to post scores but not delete others:match /public/data/leaderboard {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.resource.data.score <= 100;
}
