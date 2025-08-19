import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  try {
    // In a real implementation, we'd fetch from the API
    // For now, we'll create a basic RSS structure that can be expanded
    
    const baseUrl = 'https://firehose.space';
    
    // Mock posts data - replace with API call
    const mockPosts = [
      {
        id: '1',
        title: 'Building the future of web development',
        slug: 'building-the-future-of-web-development-post1',
        description: 'Exploring the latest trends and technologies shaping how we build for the web.',
        author_display_name: 'John Doe',
        created_at: Date.now() - 3600000,
        type: 'link',
        url: 'https://example.com/article'
      },
      {
        id: '2',
        title: 'My thoughts on the current state of AI',
        slug: 'my-thoughts-on-the-current-state-of-ai-post2',
        description: 'A deep dive into where AI technology stands today and where it\'s heading.',
        author_display_name: 'Jane Smith',
        created_at: Date.now() - 7200000,
        type: 'self',
        url: null
      }
    ];

    return rss({
      title: 'Firehose.space',
      description: 'The global feed of links and articles. No gatekeeping, just pure content flow.',
      site: baseUrl,
      xmlns: {
        atom: 'http://www.w3.org/2005/Atom'
      },
      customData: `
        <language>en-US</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
        <managingEditor>hello@firehose.space (Firehose Team)</managingEditor>
        <webMaster>hello@firehose.space (Firehose Team)</webMaster>
        <category>Technology</category>
        <category>Programming</category>
        <category>Startups</category>
        <ttl>60</ttl>
      `,
      items: mockPosts.map((post) => ({
        title: post.title,
        pubDate: new Date(post.created_at),
        description: post.description,
        author: `hello@firehose.space (${post.author_display_name})`,
        link: `${baseUrl}/p/${post.slug}`,
        guid: `${baseUrl}/p/${post.slug}`,
        categories: post.type === 'self' ? ['Self Post'] : ['Link Post'],
        customData: `
          <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">${post.author_display_name}</dc:creator>
          <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/">
            <![CDATA[
              <p>Posted by <strong>${post.author_display_name}</strong> on Firehose.space</p>
              ${post.type === 'link' ? 
                `<p><a href="${post.url}" target="_blank" rel="noopener">Read the full article →</a></p>` : 
                `<p><a href="${baseUrl}/p/${post.slug}">Read the full post →</a></p>`
              }
            ]]>
          </content:encoded>
        `
      }))
    });
  } catch (error) {
    console.error('RSS generation error:', error);
    
    // Return basic RSS even if data fetching fails
    return rss({
      title: 'Firehose.space',
      description: 'The global feed of links and articles.',
      site: 'https://firehose.space',
      items: []
    });
  }
}

// TODO: Replace mock data with real API call
// Example implementation:
/*
async function fetchRecentPosts(): Promise<Post[]> {
  try {
    const response = await fetch(`${process.env.SITE_URL}/api/posts/feed?sort=new&limit=50`);
    if (!response.ok) throw new Error('Failed to fetch posts');
    const data = await response.json();
    return data.posts;
  } catch (error) {
    console.error('Failed to fetch posts for RSS:', error);
    return [];
  }
}
*/
