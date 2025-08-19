import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const baseUrl = 'https://firehose.space';
  
  const robotsTxt = `
# Welcome to Firehose.space!
# We encourage crawling and indexing of our content

User-agent: *
Allow: /

# Important pages
Allow: /p/
Allow: /u/
Allow: /new
Allow: /top
Allow: /leaderboard

# Auth and admin pages - no need to crawl
Disallow: /login
Disallow: /auth/
Disallow: /api/auth/

# Dynamic API endpoints - crawlers should use sitemap instead
Disallow: /api/

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml

# RSS feeds
Sitemap: ${baseUrl}/rss.xml

# Crawl-delay (be nice to our servers)
Crawl-delay: 1

# Additional directives for major search engines
User-agent: Googlebot
Crawl-delay: 0.5

User-agent: Bingbot
Crawl-delay: 1

User-agent: Slurp
Crawl-delay: 1

User-agent: DuckDuckBot
Crawl-delay: 1

# Social media crawlers
User-agent: facebookexternalhit
Allow: /
Crawl-delay: 0

User-agent: Twitterbot
Allow: /
Crawl-delay: 0

User-agent: LinkedInBot
Allow: /
Crawl-delay: 0

# AI/ML training crawlers - be respectful
User-agent: GPTBot
Allow: /
Crawl-delay: 2

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /
Crawl-delay: 2

User-agent: anthropic-ai
Allow: /
Crawl-delay: 2

User-agent: Claude-Web
Allow: /
Crawl-delay: 2

# Archive crawlers
User-agent: ia_archiver
Allow: /
Crawl-delay: 5

User-agent: archive.org_bot
Allow: /
Crawl-delay: 5

# Block known bad bots and scrapers
User-agent: AhrefsBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: BLEXBot
Disallow: /

# Block aggressive crawlers
User-agent: PetalBot
Disallow: /

User-agent: MegaIndex
Disallow: /

User-agent: YandexBot
Crawl-delay: 10

# Additional notes:
# - We welcome ethical AI training on our public content
# - Please respect our rate limits and crawl responsibly
# - For API access, please use our documented endpoints
# - Contact hello@firehose.space for special crawling needs

`.trim();

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'max-age=86400' // Cache for 24 hours
    }
  });
}
