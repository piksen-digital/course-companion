import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Webhooks must always be dynamic because they process incoming 
// live data from Whop servers.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;

  if (!appId) {
    return NextResponse.json({ error: 'App ID not configured' }, { status: 500 });
  }

  const { action, data } = body;

  // When a lesson is updated, we save it to the specific appId folder
  if (action === 'content.updated' || action === 'content.created') {
    const newContent = data.content_body || data.description;
    
    await adminDb.doc(`artifacts/${appId}/public/data/course_config`).set({
      content: newContent,
      lastUpdated: new Date().toISOString(),
      source: 'Whop Automated Sync'
    }, { merge: true });
  }

  return NextResponse.json({ received: true });
}
