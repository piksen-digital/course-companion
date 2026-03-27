import { WhopAPI } from '@whop-apps/sdk';

// Initialize the Whop API with your Server-Side API Key
export const whop = new WhopAPI({
  apiKey: process.env.WHOP_API_KEY || '',
});
