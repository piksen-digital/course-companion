import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// This flag is mandatory to prevent Vercel build errors with headers/env vars
export const dynamic = 'force-dynamic';

/**
 * GET: Handles User Authentication
 * This is called by your frontend to get a Firebase Custom Token.
 */
export async function GET(request: Request) {
  try {
    const { headers } = request;
    const whopUserToken = headers.get('x-whop-user-token');
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;

    if (!whopUserToken) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    if (!appId) return NextResponse.json({ error: 'Missing App ID Config' }, { status: 500 });

    // In a real production environment, you would use the Whop SDK here 
    // to validate the x-whop-user-token. 
    // For now, we assume the token is valid or extracted from headers.
    const firebaseUid = `whop_user_${Date.now()}`; // Simplified for example
    
    const customToken = await adminAuth.createCustomToken(firebaseUid, {
      appId: appId 
    });

    return NextResponse.json({ customToken });
  } catch (error) {
    console.error('Whop Auth GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Handles Whop Webhooks
 * This is called by Whop's servers when content is created or updated.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;

    if (!appId) {
      return NextResponse.json({ error: 'App ID not configured' }, { status: 500 });
    }

    const { action, data } = body;

    // Logic: Sync course content to Firestore
    if (action === 'content.updated' || action === 'content.created') {
      const newContent = data.content_body || data.description || "No content provided";
      
      // Save to the mandatory path: /artifacts/{appId}/public/data/course_config
      await adminDb.doc(`artifacts/${appId}/public/data/course_config`).set({
        content: newContent,
        lastUpdated: new Date().toISOString(),
        source: 'Whop Automated Sync'
      }, { merge: true });
      
      console.log(`Successfully synced content for App: ${appId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Whop Webhook POST Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
