import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  try {
    const url = new URL(context.request.url);
    const sort = url.searchParams.get('sort') || 'hot';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Mock posts data for development
    const mockPosts = [
      {
        id: '1',
        type: 'self',
        title: 'Welcome to Firehose.space Development Mode!',
        slug: 'welcome-to-firehose-dev-mode-1',
        author_display_name: 'Dev Team',
        author_avatar_url: null,
        score: 42,
        comments_count: 8,
        created_at: Date.now() - 3600000,
        hotness: 0.9
      },
      {
        id: '2',
        type: 'link',
        title: 'Building Modern Web Apps with Astro and Cloudflare',
        url: 'https://blog.cloudflare.com/astro-integration',
        domain: 'blog.cloudflare.com',
        slug: 'building-modern-web-apps-astro-2',
        author_display_name: 'John Developer',
        author_avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        score: 28,
        comments_count: 5,
        created_at: Date.now() - 7200000,
        hotness: 0.6
      },
      {
        id: '3',
        type: 'self',
        title: 'How to Set Up Authentication in Your SaaS',
        slug: 'how-to-setup-auth-saas-3',
        author_display_name: 'Jane Smith',
        author_avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b37c?w=150',
        score: 35,
        comments_count: 12,
        created_at: Date.now() - 14400000,
        hotness: 0.4
      }
    ];

    // Sort mock data based on sort parameter
    let sortedPosts = [...mockPosts];
    
    switch (sort) {
      case 'new':
        sortedPosts.sort((a, b) => b.created_at - a.created_at);
        break;
      case 'top':
        sortedPosts.sort((a, b) => b.score - a.score);
        break;
      case 'hot':
      default:
        sortedPosts.sort((a, b) => b.hotness - a.hotness);
        break;
    }

    // Apply pagination
    const paginatedPosts = sortedPosts.slice(offset, offset + limit);

    return new Response(JSON.stringify({
      posts: paginatedPosts,
      pagination: {
        limit,
        offset,
        hasMore: paginatedPosts.length === limit && offset + limit < sortedPosts.length
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Feed error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load feed' }), { 
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
