import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { id } = context.params;
  
  try {
    // For now, return a simple SVG-based OpenGraph image
    // In production, you'd want to use a more sophisticated image generation library
    
    // Mock post data - replace with real API call
    const mockPost = {
      title: 'Building the future of web development',
      author: 'John Doe',
      score: 42,
      type: 'link',
      domain: 'example.com'
    };

    // Generate SVG OpenGraph image
    const svg = generatePostOGImage(mockPost);
    
    // Convert SVG to PNG would require additional libraries in production
    // For now, return SVG directly (some platforms support SVG OG images)
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable' // Cache for 1 year
      }
    });

  } catch (error) {
    console.error('OG image generation error:', error);
    
    // Return default OG image
    const defaultSvg = generateDefaultOGImage();
    
    return new Response(defaultSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  }
}

function generatePostOGImage(post: any): string {
  const title = truncateText(post.title, 80);
  const typeIndicator = post.type === 'link' ? `🔗 ${post.domain}` : '📝 Self Post';
  
  return `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF7A00;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF5722;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="0" y="0" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradient)"/>
  
  <!-- Content background -->
  <rect x="60" y="60" width="1080" height="510" fill="white" rx="20" filter="url(#shadow)"/>
  
  <!-- Logo and branding -->
  <circle cx="120" cy="140" r="20" fill="#FF7A00"/>
  <text x="160" y="150" font-family="Inter, sans-serif" font-size="24" font-weight="bold" fill="#1F2937">Firehose</text>
  
  <!-- Type indicator -->
  <text x="120" y="200" font-family="Inter, sans-serif" font-size="16" fill="#6B7280">${typeIndicator}</text>
  
  <!-- Post title -->
  <foreignObject x="120" y="240" width="960" height="200">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, sans-serif; font-size: 48px; font-weight: bold; line-height: 1.1; color: #1F2937; word-wrap: break-word;">
      ${escapeHtml(title)}
    </div>
  </foreignObject>
  
  <!-- Author and stats -->
  <text x="120" y="500" font-family="Inter, sans-serif" font-size="18" fill="#6B7280">by ${escapeHtml(post.author)}</text>
  <text x="120" y="530" font-family="Inter, sans-serif" font-size="16" fill="#9CA3AF">${post.score} upvotes</text>
  
  <!-- Firehose branding -->
  <text x="1020" y="530" font-family="Inter, sans-serif" font-size="14" fill="#9CA3AF" text-anchor="end">firehose.space</text>
</svg>`.trim();
}

function generateDefaultOGImage(): string {
  return `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF7A00;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF5722;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="1200" height="630" fill="url(#bgGradient)"/>
  
  <!-- Logo -->
  <circle cx="600" cy="250" r="40" fill="white"/>
  <text x="600" y="265" font-family="Inter, sans-serif" font-size="32" fill="#FF7A00" text-anchor="middle" dominant-baseline="middle">🔥</text>
  
  <!-- Title -->
  <text x="600" y="340" font-family="Inter, sans-serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle">Firehose</text>
  
  <!-- Subtitle -->
  <text x="600" y="390" font-family="Inter, sans-serif" font-size="24" fill="rgba(255,255,255,0.9)" text-anchor="middle">The global feed of links and articles</text>
  
  <!-- URL -->
  <text x="600" y="480" font-family="Inter, sans-serif" font-size="18" fill="rgba(255,255,255,0.8)" text-anchor="middle">firehose.space</text>
</svg>`.trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// TODO: Replace mock data with real API call
/*
async function fetchPostForOG(postId: string) {
  try {
    const response = await fetch(`${process.env.SITE_URL}/api/posts/${postId}`);
    if (!response.ok) throw new Error('Post not found');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch post for OG image:', error);
    return null;
  }
}
*/

// Production considerations:
// 1. Use a proper image generation library like @vercel/og or similar
// 2. Generate PNG/JPG images instead of SVG for better compatibility
// 3. Add caching layer (Cloudflare Images or similar)
// 4. Add image templates for different post types
// 5. Support for user avatars in images
// 6. Add fallback for missing or corrupted data
