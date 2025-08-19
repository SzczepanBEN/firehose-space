import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  try {
    const authHeader = context.request.headers.get('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    
    // In dev mode, simulate authentication
    // For simplicity, we'll accept any token as valid
    if (token && token.length > 0) {
      // Return mock user data
      const mockUser = {
        id: 'dev-user-1',
        email: 'dev@example.com',
        display_name: 'Dev User',
        avatar_url: null
      };

      return new Response(JSON.stringify(mockUser), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid token' }), { 
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Auth check error:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}
