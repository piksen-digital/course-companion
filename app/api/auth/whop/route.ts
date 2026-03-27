import { NextResponse } from 'next/server';
import { WhopAPI } from '@whop-apps/sdk';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    // 1. Extract the Whop token from the headers
    const headers = new Headers(request.headers);
    const whopUserToken = headers.get('x-whop-user-token');

    if (!whopUserToken) {
      return NextResponse.json({ error: 'Missing Whop token' }, { status: 401 });
    }

    // 2. Initialize Whop SDK & Verify Token
    // You'll need WHOP_API_KEY in your Vercel Environment Variables
    const whop = new WhopAPI({ apiKey: process.env.WHOP_API_KEY });
    
    // Validate the token to ensure it wasn't forged
    const validation = await whop.validateToken({ token: whopUserToken });
    
    if (!validation.userId) {
       return NextResponse.json({ error: 'Invalid Whop token' }, { status: 401 });
    }

    // 3. Mint the Firebase Custom Token
    // We use the Whop User ID as the Firebase UID to link the accounts permanently
    const firebaseUid = `whop_${validation.userId}`;
    
    // Optional: Pass custom claims (like admin status if they are the course creator)
    const customToken = await adminAuth.createCustomToken(firebaseUid, {
      whopRole: validation.role || 'customer'
    });

    return NextResponse.json({ customToken });

  } catch (error) {
    console.error('Whop Auth Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
