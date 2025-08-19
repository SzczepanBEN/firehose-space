import type { APIContext } from 'astro';

export async function POST(context: APIContext) {
  try {
    // Check authentication
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await context.request.json();
    const { type, title, url, content } = body;
    
    if (!title || !type || !['link', 'self'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid post data' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (type === 'link' && !url) {
      return new Response(JSON.stringify({ error: 'URL required for link posts' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (type === 'self' && !content) {
      return new Response(JSON.stringify({ error: 'Content required for self posts' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // In dev mode, just simulate creating a post
    const postId = 'dev-post-' + Date.now();
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 60) + '-' + postId.substring(0, 8);

    console.log('[DEV] Post would be created:', { type, title, url, content, slug });

    return new Response(JSON.stringify({ 
      success: true, 
      id: postId,
      slug: slug,
      message: 'Post created successfully in DEV mode!'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Submit post error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit post' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
