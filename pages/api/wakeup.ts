import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';
  
  try {
    if (!adminDb) {
      return NextResponse.json({ error: "Admin SDK not initialized" }, { status: 500 });
    }

    // Path must be EVEN: 6 segments total
    const docPath = `artifacts/${appId}/public/data/course_config/main`;
    
    await adminDb.doc(docPath).set({
      content: "Demo Course Data: Welcome to the Neural Link! This application uses Gemini 2.5 and Firebase to provide an immersive tutor experience.",
      lastUpdated: new Date().toISOString(),
      source: 'System Force Wakeup'
    }, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: "Neural Link Established!", 
      path: docPath 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
