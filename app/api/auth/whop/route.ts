import { NextResponse } from 'next/server';
import { WhopAPI } from '@whop-apps/sdk';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const headers = new Headers(request.headers);
    const whopUserToken = headers.get('x-whop-user-token');
    
    // We must pull the App ID here to "tag" the user's session
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;

    if (!whopUserToken) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    if (!appId) return NextResponse.json({ error: 'Missing App ID Config' }, { status: 500 });

    const whop = new WhopAPI({ apiKey: process.env.WHOP_API_KEY });
    const validation = await whop.validateToken({ token: whopUserToken });
    
    if (!validation.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Identify if the user is the creator/admin
    const isCreator = validation.access_level === 'admin' || validation.role === 'admin';
    const roleString = isCreator ? 'admin' : 'customer';

    const firebaseUid = `whop_${validation.userId}`;
    
    // INJECT CUSTOM CLAIMS: 
    // We add 'appId' here so Firestore rules can verify the user is 
    // accessing the correct 'artifacts/{appId}/...' path.
    const customToken = await adminAuth.createCustomToken(firebaseUid, {
      whopRole: roleString,
      appId: appId 
    });

    return NextResponse.json({ customToken });

  } catch (error) {
    console.error('Whop Auth Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
