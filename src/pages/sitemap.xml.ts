import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const baseUrl = 'https://firehose.space';
  const currentDate = new Date().toISOString();
  
  try {
    // Static pages with their priorities and change frequencies
    const staticPages = [
      { url: '', priority: 1.0, changefreq: 'hourly', lastmod: currentDate },
      { url: '/new', priority: 0.9, changefreq: 'hourly', lastmod: currentDate },
      { url: '/top', priority: 0.9, changefreq: 'daily', lastmod: currentDate },
      { url: '/leaderboard', priority: 0.8, changefreq: 'daily', lastmod: currentDate },
      { url: '/submit', priority: 0.7, changefreq: 'weekly', lastmod: currentDate },
      { url: '/login', priority: 0.3, changefreq: 'monthly', lastmod: currentDate },
      { url: '/about', priority: 0.5, changefreq: 'monthly', lastmod: currentDate },
      { url: '/guidelines', priority: 0.5, changefreq: 'monthly', lastmod: currentDate },
      { url: '/api', priority: 0.4, changefreq: 'monthly', lastmod: currentDate },
      { url: '/terms', priority: 0.3, changefreq: 'yearly', lastmod: currentDate },
      { url: '/privacy', priority: 0.3, changefreq: 'yearly', lastmod: currentDate }
    ];

    // Mock dynamic content - replace with real API calls
    const mockPosts = [
      {
        slug: 'building-the-future-of-web-development-post1',
        created_at: Date.now() - 3600000,
        score: 42
      },
      {
        slug: 'my-thoughts-on-the-current-state-of-ai-post2', 
        created_at: Date.now() - 7200000,
        score: 28
      }
    ];

    const mockUsers = [
      { id: 'user1', updated_at: Date.now() - 86400000 },
      { id: 'user2', updated_at: Date.now() - 172800000 }
    ];

    // Calculate priority based on post score and age
    function getPostPriority(score: number, ageMs: number): number {
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const scoreFactor = Math.min(score / 100, 1); // Normalize score to 0-1
      const ageFactor = Math.max(0, (30 - ageDays) / 30); // Newer posts get higher priority
      return Math.max(0.1, Math.min(0.9, 0.5 + (scoreFactor * 0.3) + (ageFactor * 0.1)));
    }

    function getChangeFreq(ageMs: number): string {
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 1) return 'hourly';
      if (ageDays < 7) return 'daily'; 
      if (ageDays < 30) return 'weekly';
      return 'monthly';
    }

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  
  <!-- Static Pages -->
  ${staticPages.map(page => `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')}
  
  <!-- Dynamic Content: Posts -->
  ${mockPosts.map(post => {
    const ageMs = Date.now() - post.created_at;
    return `
  <url>
    <loc>${baseUrl}/p/${post.slug}</loc>
    <lastmod>${new Date(post.created_at).toISOString()}</lastmod>
    <changefreq>${getChangeFreq(ageMs)}</changefreq>
    <priority>${getPostPriority(post.score, ageMs)}</priority>
  </url>`;
  }).join('')}
  
  <!-- User Profiles -->
  ${mockUsers.map(user => `
  <url>
    <loc>${baseUrl}/u/${user.id}</loc>
    <lastmod>${new Date(user.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.4</priority>
  </url>`).join('')}
  
  <!-- RSS Feed -->
  <url>
    <loc>${baseUrl}/rss.xml</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.6</priority>
  </url>
  
</urlset>`.trim();

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    
    // Return basic sitemap with just static pages
    const basicSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/new</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/top</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

    return new Response(basicSitemap, {
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }
}

// TODO: Replace mock data with real API calls
/*
async function fetchPostsForSitemap(): Promise<Array<{slug: string, created_at: number, score: number}>> {
  try {
    const response = await fetch(`${process.env.SITE_URL}/api/posts/sitemap`);
    if (!response.ok) throw new Error('Failed to fetch posts');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch posts for sitemap:', error);
    return [];
  }
}

async function fetchUsersForSitemap(): Promise<Array<{id: string, updated_at: number}>> {
  try {
    const response = await fetch(`${process.env.SITE_URL}/api/users/sitemap`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch users for sitemap:', error);
    return [];
  }
}
*/
