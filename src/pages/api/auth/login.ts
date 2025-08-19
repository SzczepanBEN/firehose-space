import type { APIContext } from 'astro';

export async function POST(context: APIContext) {
  try {
    let body;
    try {
      body = await context.request.json();
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    const { email } = body || {};
    
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // In dev mode, just simulate sending email
    console.log(`[DEV] Magic link would be sent to: ${email}`);
    
    // For development, we'll just return success
    // In production, this would be handled by the Cloudflare Worker
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Magic link sent to your email (DEV MODE - check console for link)'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Login failed' }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}
