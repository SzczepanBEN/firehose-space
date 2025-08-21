/**
 * Main Cloudflare Worker entry point for Firehose.space API
 * Handles authentication, API routes, and database operations
 */

import { EncryptJWT, jwtDecrypt } from 'jose';
import { nanoid } from 'nanoid';
import { EmailService } from './utils/emailService';

// Types
interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET: string;
  SITE_URL: string;
  TURNSTILE_SECRET_KEY: string;
  STRIPE_SECRET_KEY: string;
  RESEND_API_KEY: string;
}

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  trust_level: number;
  created_at: number;
}

interface Post {
  id: string;
  type: 'link' | 'self';
  title: string;
  url: string | null;
  slug: string;
  domain: string | null;
  normalized_url_hash: string | null;
  author_id: string;
  score: number;
  clicks: number;
  comments_count: number;
  created_at: number;
  hotness: number;
}

// JWT utilities - secret will be set from env in fetch handler
let jwtSecretKey: Uint8Array;

// Email Service for Magic Links
class EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendMagicLink(email: string, magicLink: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Firehose <noreply@firehose.space>',
          to: [email],
          subject: 'Your Magic Link for Firehose.space 🔥',
          html: this.generateMagicLinkEmail(email, magicLink),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Resend API error (${response.status}):`, errorText);
        return false;
      }

      const result = await response.json();
      console.log(`Magic link sent successfully to ${email}. Email ID:`, result.id);
      return true;
    } catch (error) {
      console.error('Failed to send email via Resend:', error);
      return false;
    }
  }

  private generateMagicLinkEmail(email: string, magicLink: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Magic Link for Firehose.space</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 24px; font-weight: bold; color: #EA580C; }
        .button { display: inline-block; background: #EA580C; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🔥 Firehose</div>
    </div>

    <h1>Welcome to Firehose! 🚀</h1>
    
    <p>You requested to sign in to <strong>Firehose.space</strong> using <strong>${email}</strong>.</p>
    
    <p>Click the button below to complete your login:</p>
    
    <div style="text-align: center; margin: 40px 0;">
        <a href="${magicLink}" class="button">Sign In to Firehose</a>
    </div>
    
    <p>Or copy this link: <br><code style="word-break: break-all; background: #f5f5f5; padding: 8px; border-radius: 4px;">${magicLink}</code></p>
    
    <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400E;">
            <strong>⚠️ Security:</strong> This link expires in 15 minutes and can only be used once.
        </p>
    </div>

    <div class="footer">
        <p>Firehose.space - The global feed of links and articles</p>
    </div>
</body>
</html>`;
  }
}

async function createJWT(payload: any): Promise<string> {
  return await new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .encrypt(jwtSecretKey);
}

async function verifyJWT(token: string): Promise<any> {
  try {
    const { payload } = await jwtDecrypt(token, jwtSecretKey);
    return payload;
  } catch {
    return null;
  }
}

// Auth utilities
async function getCurrentUser(request: Request, env: Env): Promise<User | null> {
  let token: string | null = null;

  // Try Authorization header first (for API requests)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // If no Bearer token, try Cookie (for browser requests)
  if (!token) {
    const cookies = request.headers.get('Cookie');
    if (cookies) {
      const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }
  }

  if (!token) return null;

  try {
    const payload = await verifyJWT(token);
    if (!payload?.user_id) return null;

    const user = await env.DB
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(payload.user_id)
      .first<User>();

    return user || null;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Rate limiting
async function checkRateLimit(env: Env, key: string, limit: number, window: number): Promise<boolean> {
  const current = await env.CACHE.get(key);
  const count = current ? parseInt(current) : 0;
  
  if (count >= limit) return false;
  
  await env.CACHE.put(key, (count + 1).toString(), { expirationTtl: window });
  return true;
}

// URL utilities
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking parameters
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'];
    paramsToRemove.forEach(param => parsed.searchParams.delete(param));
    // Remove hash
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function createSlug(title: string, id: string): string {
  const slugBase = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 60);
  
  return `${slugBase}-${id.substring(0, 8)}`;
}

// Hash URL for duplicate detection
async function hashUrl(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizeUrl(url));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// API Routes
const routes = {
  // Auth routes
  'POST /api/auth/login': handleLogin,
  'POST /api/auth/verify': handleVerifyLogin,  // API endpoint for frontend verification
  'GET /api/auth/me': handleGetMe,
  'POST /api/auth/logout': handleLogout,
  
  // Post routes  
  'POST /api/posts/submit': handleSubmitPost,
  'GET /api/posts/rate-limit-status': handleGetRateLimitStatus,
  'GET /api/posts/feed': handleGetFeed,
  'GET /api/posts/:id': handleGetPost,
  'PUT /api/posts/:id': handleEditPost,
  'POST /api/posts/:id/vote': handleVotePost,
  'POST /api/posts/:id/click': handleTrackClick,
  
  // Comment routes
  'GET /api/posts/:id/comments': handleGetComments,
  'POST /api/posts/:id/comments': handleSubmitComment,
  'POST /api/comments/:id/vote': handleVoteComment,
  
  // User routes
  'GET /api/users/:id': handleGetUser,
  'PUT /api/users/me': handleUpdateUserProfile,
  'GET /api/leaderboard': handleGetLeaderboard,
  
  // Moderation routes
  'POST /api/reports': handleSubmitReport,
  
  // Promotion routes
  'POST /api/promotions': handleCreatePromotion,
  
  // OpenGraph image generation
  'GET /api/og/homepage': handleGenerateHomepageOGImage,
  
  // Analytics proxy routes handled dynamically in main handler
  
  // Cron jobs
  'POST /api/cron/update-hotness': handleUpdateHotness,
  'POST /api/cron/update-leaderboard': handleUpdateLeaderboard,
};

// Route handlers

async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { email } = await request.json();
    
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create magic token
    const token = nanoid();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    await env.DB
      .prepare('INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)')
      .bind(email, token, expiresAt)
      .run();

    // Send magic link email
    const magicLink = `${env.SITE_URL}/auth/verify?token=${token}`;
    const emailService = new EmailService(env.RESEND_API_KEY);
    
    const emailSent = await emailService.sendMagicLink(email, magicLink);
    
    if (!emailSent) {
      console.error('Failed to send magic link email to:', email);
      // Don't fail the request, just log the error - token is still valid
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Magic link sent to your email'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Login failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleVerifyLogin(request: Request, env: Env): Promise<Response> {
  try {
    // Parse magic token from request body
    const body = await request.json();
    const token = body.token;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const magicToken = await env.DB
      .prepare('SELECT * FROM magic_tokens WHERE token = ? AND used = FALSE AND expires_at > ?')
      .bind(token, Date.now())
      .first();

    if (!magicToken) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mark token as used
    await env.DB
      .prepare('UPDATE magic_tokens SET used = TRUE WHERE token = ?')
      .bind(token)
      .run();

    // Get or create user
    let user = await env.DB
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(magicToken.email)
      .first<User>();

    if (!user) {
      const userId = nanoid();
      const displayName = magicToken.email.split('@')[0];
      
      await env.DB
        .prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)')
        .bind(userId, magicToken.email, displayName)
        .run();

      user = await env.DB
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(userId)
        .first<User>();

      // TODO: Send welcome email for new users
      // const emailService = new EmailService(env.RESEND_API_KEY);
      // await emailService.sendWelcomeEmail(user.email, user.display_name);
    }

    // Create session JWT
    const sessionToken = await createJWT({ user_id: user.id });

    // API request - return JSON with session JWT
    return new Response(JSON.stringify({ 
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Verify login error:', error);
    return new Response(JSON.stringify({ error: 'Verification failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetMe(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleSubmitPost(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check rate limit (1 post per day per user) - but don't increment yet
  const rateLimitKey = `post_limit:${user.id}`;
  const currentCount = await env.CACHE.get(rateLimitKey);
  const count = currentCount ? parseInt(currentCount) : 0;
  
  if (count >= 1) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. One post per day.' }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { type, title, url, content, image_url } = await request.json();
    
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

    const postId = nanoid();
    const slug = createSlug(title, postId);
    
    let domain = null;
    let normalizedUrlHash = null;
    
    if (type === 'link') {
      domain = getDomain(url);
      normalizedUrlHash = await hashUrl(url);
      
      // Check for duplicates
      const duplicate = await env.DB
        .prepare('SELECT id FROM posts WHERE normalized_url_hash = ?')
        .bind(normalizedUrlHash)
        .first();
        
      if (duplicate) {
        return new Response(JSON.stringify({ error: 'This URL has already been posted' }), { 
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Insert post
    await env.DB
      .prepare(`
        INSERT INTO posts (id, type, title, url, slug, domain, image_url, normalized_url_hash, author_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(postId, type, title, url, slug, domain, image_url, normalizedUrlHash, user.id)
      .run();

    // Insert content for self posts
    if (type === 'self') {
      await env.DB
        .prepare('INSERT INTO post_bodies (post_id, markdown) VALUES (?, ?)')
        .bind(postId, content)
        .run();
    }

    // Only now increment rate limit counter after successful post creation
    await env.CACHE.put(rateLimitKey, (count + 1).toString(), { expirationTtl: 24 * 60 * 60 });

    return new Response(JSON.stringify({ 
      success: true, 
      id: postId,
      slug: slug
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

async function handleGetRateLimitStatus(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Find user's last post from database
    const lastPost = await env.DB
      .prepare('SELECT created_at FROM posts WHERE author_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(user.id)
      .first();

    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const rateLimitWindow = 24 * 60 * 60; // 24 hours in seconds

    let canPost = true;
    let nextPostAt = now; // Can post now
    let timeRemaining = 0;

    if (lastPost) {
      const lastPostTime = lastPost.created_at;
      const nextAllowedTime = lastPostTime + rateLimitWindow;
      
      if (now < nextAllowedTime) {
        // Still within rate limit window
        canPost = false;
        nextPostAt = nextAllowedTime;
        timeRemaining = nextAllowedTime - now;
      }
    }

    return new Response(JSON.stringify({
      can_post: canPost,
      next_post_at: nextPostAt,
      time_remaining: timeRemaining,
      rate_limit: {
        limit: 1,
        window: rateLimitWindow,
        window_hours: 24
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Rate limit status error:', error);
    return new Response(JSON.stringify({ error: 'Failed to check rate limit status' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetFeed(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sort = url.searchParams.get('sort') || 'hot';
    const period = url.searchParams.get('period') || '24h';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Get current user for edit permission checks
    const user = await getCurrentUser(request, env);

    let orderBy = 'p.hotness DESC';
    let whereClause = '';

    if (sort === 'new') {
      orderBy = 'p.created_at DESC';
    } else if (sort === 'top') {
      orderBy = 'p.score DESC';
      
      // Add time-based filtering for top posts
      const now = Date.now();
      let timeFilter = null;
      
      switch (period) {
        case '24h':
          timeFilter = now - (24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeFilter = now - (30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          timeFilter = null;
          break;
        default:
          timeFilter = now - (24 * 60 * 60 * 1000);
      }
      
      if (timeFilter) {
        whereClause = 'WHERE p.created_at > ?';
      }
    }

    const query = `
      SELECT 
        p.*,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        pb.markdown as body_markdown
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN post_bodies pb ON p.id = pb.post_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    let bindParams = [];
    
    // Add time filter parameter if needed
    if (sort === 'top' && whereClause && period !== 'all') {
      const now = Date.now();
      let timeFilter;
      switch (period) {
        case '24h':
          timeFilter = now - (24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeFilter = now - (30 * 24 * 60 * 60 * 1000);
          break;
      }
      bindParams.push(timeFilter);
    }
    
    bindParams.push(limit, offset);

    const posts = await env.DB
      .prepare(query)
      .bind(...bindParams)
      .all();

    // Add edit permissions to each post
    const now = Math.floor(Date.now() / 1000);
    const twoHoursInSeconds = 2 * 60 * 60; // 2 hours
    
    const postsWithMeta = (posts.results || []).map(post => {
      let canEdit = false;
      if (user && post.author_id === user.id) {
        canEdit = (now - post.created_at) <= twoHoursInSeconds;
      }
      
      return {
        ...post,
        can_edit: canEdit,
        is_author: user ? post.author_id === user.id : false
      };
    });

    return new Response(JSON.stringify({
      posts: postsWithMeta,
      pagination: {
        limit,
        offset,
        hasMore: (posts.results?.length || 0) === limit
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get feed error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load feed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Additional handlers would go here...
async function handleGetPost(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  try {
    const postId = params.id;
    const user = await getCurrentUser(request, env);
    
    // Get post with author info and body
    const post = await env.DB
      .prepare(`
        SELECT 
          p.*,
          u.display_name as author_display_name,
          u.avatar_url as author_avatar_url,
          pb.markdown as body_markdown
        FROM posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN post_bodies pb ON p.id = pb.post_id
        WHERE p.id = ? OR p.slug = ?
      `)
      .bind(postId, postId)
      .first();

    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if current user can edit this post (author + within 2h)
    let canEdit = false;
    if (user && post.author_id === user.id) {
      const now = Math.floor(Date.now() / 1000);
      const createdAt = post.created_at;
      const twoHoursInSeconds = 2 * 60 * 60; // 2 hours
      canEdit = (now - createdAt) <= twoHoursInSeconds;
    }

    // Add editability info to post
    const postWithMeta = {
      ...post,
      can_edit: canEdit,
      is_author: user ? post.author_id === user.id : false
    };

    return new Response(JSON.stringify(postWithMeta), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get post error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load post' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleEditPost(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  // Authentication check
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const postId = params.id;
    const { title, content, image_url } = await request.json();
    
    if (!title || title.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the existing post
    const existingPost = await env.DB
      .prepare(`
        SELECT id, type, title, url, author_id, created_at, updated_at 
        FROM posts 
        WHERE id = ? OR slug = ?
      `)
      .bind(postId, postId)
      .first();

    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Post not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is the author
    if (existingPost.author_id !== user.id) {
      return new Response(JSON.stringify({ error: 'You can only edit your own posts' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if post is within 2-hour edit window
    const now = Math.floor(Date.now() / 1000);
    const createdAt = existingPost.created_at;
    const twoHoursInSeconds = 2 * 60 * 60; // 2 hours
    
    if (now - createdAt > twoHoursInSeconds) {
      return new Response(JSON.stringify({ 
        error: 'Posts can only be edited within 2 hours of creation' 
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For self posts, content is required
    if (existingPost.type === 'self' && (!content || content.trim().length === 0)) {
      return new Response(JSON.stringify({ error: 'Content is required for self posts' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the post
    await env.DB
      .prepare(`
        UPDATE posts 
        SET title = ?, image_url = ?, updated_at = unixepoch()
        WHERE id = ?
      `)
      .bind(title.trim(), image_url || null, existingPost.id)
      .run();

    // Update content for self posts
    if (existingPost.type === 'self' && content) {
      await env.DB
        .prepare(`
          UPDATE post_bodies 
          SET markdown = ? 
          WHERE post_id = ?
        `)
        .bind(content.trim(), existingPost.id)
        .run();
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Post updated successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Edit post error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update post' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleVotePost(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { vote_type } = await request.json();
    const postId = params.id;
    
    if (!vote_type || !['up', 'down'].includes(vote_type)) {
      return new Response(JSON.stringify({ error: 'Invalid vote type' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if post exists
    const post = await env.DB
      .prepare('SELECT id FROM posts WHERE id = ?')
      .bind(postId)
      .first();

    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limit for voting (100 votes per hour)
    const rateLimitKey = `vote_limit:${user.id}`;
    const canVote = await checkRateLimit(env, rateLimitKey, 100, 3600);
    
    if (!canVote) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert or update vote (using INSERT OR REPLACE pattern)
    await env.DB
      .prepare(`
        INSERT OR REPLACE INTO votes (user_id, entity_type, entity_id, vote_type) 
        VALUES (?, 'post', ?, ?)
      `)
      .bind(user.id, postId, vote_type)
      .run();

    // Recalculate post score
    const scoreResult = await env.DB
      .prepare(`
        SELECT 
          (SELECT COUNT(*) FROM votes WHERE entity_type = 'post' AND entity_id = ? AND vote_type = 'up') -
          (SELECT COUNT(*) FROM votes WHERE entity_type = 'post' AND entity_id = ? AND vote_type = 'down') as new_score
      `)
      .bind(postId, postId)
      .first();

    const newScore = scoreResult?.new_score || 0;

    // Update post score
    await env.DB
      .prepare('UPDATE posts SET score = ? WHERE id = ?')
      .bind(newScore, postId)
      .run();

    return new Response(JSON.stringify({ 
      success: true,
      new_score: newScore 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Vote post error:', error);
    return new Response(JSON.stringify({ error: 'Failed to vote' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleTrackClick(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  try {
    const postId = params.id;

    // Check if post exists and is a link post
    const post = await env.DB
      .prepare('SELECT type FROM posts WHERE id = ? AND type = "link"')
      .bind(postId)
      .first();

    if (!post) {
      return new Response(JSON.stringify({ error: 'Link post not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Increment click count
    await env.DB
      .prepare('UPDATE posts SET clicks = clicks + 1 WHERE id = ?')
      .bind(postId)
      .run();

    return new Response(JSON.stringify({ 
      success: true 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Track click error:', error);
    return new Response(JSON.stringify({ error: 'Failed to track click' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetComments(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  try {
    const postId = params.id;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sort = url.searchParams.get('sort') || 'best'; // best, new

    // Check if post exists
    const post = await env.DB
      .prepare('SELECT id FROM posts WHERE id = ?')
      .bind(postId)
      .first();

    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let orderBy = 'c.score DESC, c.created_at DESC'; // Best (score + recency)
    if (sort === 'new') orderBy = 'c.created_at DESC';

    // Fetch comments with user info
    const comments = await env.DB
      .prepare(`
        SELECT 
          c.id,
          c.user_id,
          c.body,
          c.score,
          c.created_at,
          u.display_name as user_display_name,
          u.avatar_url as user_avatar_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? AND c.parent_id IS NULL
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `)
      .bind(postId, limit, offset)
      .all();

    return new Response(JSON.stringify({
      comments: comments.results,
      pagination: {
        limit,
        offset,
        hasMore: comments.results?.length === limit
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get comments error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load comments' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleSubmitComment(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { body, parent_id } = await request.json();
    const postId = params.id;
    
    if (!body || body.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Comment body required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (body.length > 10000) {
      return new Response(JSON.stringify({ error: 'Comment too long (max 10,000 characters)' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if post exists
    const post = await env.DB
      .prepare('SELECT id FROM posts WHERE id = ?')
      .bind(postId)
      .first();

    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limit for comments (10 comments per hour)
    const rateLimitKey = `comment_limit:${user.id}`;
    const canComment = await checkRateLimit(env, rateLimitKey, 10, 3600);
    
    if (!canComment) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. 10 comments per hour max.' }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If replying to a comment, check if parent exists
    if (parent_id) {
      const parentComment = await env.DB
        .prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?')
        .bind(parent_id, postId)
        .first();

      if (!parentComment) {
        return new Response(JSON.stringify({ error: 'Parent comment not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const commentId = nanoid();

    // Insert comment
    await env.DB
      .prepare(`
        INSERT INTO comments (id, post_id, user_id, body, parent_id)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(commentId, postId, user.id, body.trim(), parent_id || null)
      .run();

    // Update post comment count
    await env.DB
      .prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?')
      .bind(postId)
      .run();

    // Fetch the created comment with user info
    const newComment = await env.DB
      .prepare(`
        SELECT 
          c.id,
          c.user_id,
          c.body,
          c.parent_id,
          c.score,
          c.created_at,
          u.display_name as user_display_name,
          u.avatar_url as user_avatar_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `)
      .bind(commentId)
      .first();

    return new Response(JSON.stringify({ 
      success: true,
      comment: newComment 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Submit comment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit comment' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleVoteComment(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { vote_type } = await request.json();
    const commentId = params.id;
    
    if (!vote_type || !['up', 'down'].includes(vote_type)) {
      return new Response(JSON.stringify({ error: 'Invalid vote type' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if comment exists
    const comment = await env.DB
      .prepare('SELECT id FROM comments WHERE id = ?')
      .bind(commentId)
      .first();

    if (!comment) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limit for voting (100 votes per hour)
    const rateLimitKey = `vote_limit:${user.id}`;
    const canVote = await checkRateLimit(env, rateLimitKey, 100, 3600);
    
    if (!canVote) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert or update vote
    await env.DB
      .prepare(`
        INSERT OR REPLACE INTO votes (user_id, entity_type, entity_id, vote_type) 
        VALUES (?, 'comment', ?, ?)
      `)
      .bind(user.id, commentId, vote_type)
      .run();

    // Recalculate comment score
    const scoreResult = await env.DB
      .prepare(`
        SELECT 
          (SELECT COUNT(*) FROM votes WHERE entity_type = 'comment' AND entity_id = ? AND vote_type = 'up') -
          (SELECT COUNT(*) FROM votes WHERE entity_type = 'comment' AND entity_id = ? AND vote_type = 'down') as new_score
      `)
      .bind(commentId, commentId)
      .first();

    const newScore = scoreResult?.new_score || 0;

    // Update comment score
    await env.DB
      .prepare('UPDATE comments SET score = ? WHERE id = ?')
      .bind(newScore, commentId)
      .run();

    return new Response(JSON.stringify({ 
      success: true,
      new_score: newScore 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Vote comment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to vote' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpdateUserProfile(request: Request, env: Env): Promise<Response> {
  // Authentication check
  const user = await getCurrentUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { display_name, bio, website_url, avatar_url } = await request.json();
    
    // Validate display name
    if (!display_name || display_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Display name is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (display_name.trim().length > 50) {
      return new Response(JSON.stringify({ error: 'Display name must be 50 characters or less' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate bio
    if (bio && bio.length > 500) {
      return new Response(JSON.stringify({ error: 'Bio must be 500 characters or less' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate website URL
    if (website_url && website_url.trim().length > 0) {
      try {
        new URL(website_url);
      } catch {
        return new Response(JSON.stringify({ error: 'Please provide a valid website URL' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Validate avatar URL
    if (avatar_url && avatar_url.trim().length > 0) {
      try {
        new URL(avatar_url);
      } catch {
        return new Response(JSON.stringify({ error: 'Please provide a valid avatar URL' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Update user profile
    await env.DB
      .prepare(`
        UPDATE users 
        SET display_name = ?, bio = ?, website_url = ?, avatar_url = ?, updated_at = unixepoch()
        WHERE id = ?
      `)
      .bind(
        display_name.trim(), 
        bio ? bio.trim() : null, 
        website_url ? website_url.trim() : null, 
        avatar_url ? avatar_url.trim() : null,
        user.id
      )
      .run();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Profile updated successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetUser(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  try {
    const userId = params.id;
    const currentUser = await getCurrentUser(request, env);

    // Get user basic info
    const user = await env.DB
      .prepare('SELECT id, display_name, avatar_url, bio, website_url, created_at FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user statistics
    const stats = await env.DB
      .prepare(`
        WITH user_stats AS (
          -- Post upvotes
          SELECT 
            u.id,
            COALESCE(post_upvotes.total, 0) as post_upvotes,
            COALESCE(comment_upvotes.total, 0) as comment_upvotes,
            COALESCE(click_stats.total_clicks, 0) as total_clicks,
            COALESCE(post_stats.posts_count, 0) as posts_count,
            COALESCE(comment_stats.comments_count, 0) as comments_count,
            COALESCE(post_upvotes.total, 0) + 
            (0.5 * COALESCE(comment_upvotes.total, 0)) + 
            COALESCE(click_stats.total_clicks, 0) as total_score
          FROM users u
          
          LEFT JOIN (
            SELECT 
              p.author_id,
              COUNT(v.id) as total
            FROM posts p
            LEFT JOIN votes v ON v.entity_type = 'post' AND v.entity_id = p.id AND v.vote_type = 'up'
            WHERE p.author_id = ?
            GROUP BY p.author_id
          ) post_upvotes ON post_upvotes.author_id = u.id
          
          LEFT JOIN (
            SELECT 
              c.user_id,
              COUNT(v.id) as total
            FROM comments c
            LEFT JOIN votes v ON v.entity_type = 'comment' AND v.entity_id = c.id AND v.vote_type = 'up'
            WHERE c.user_id = ?
            GROUP BY c.user_id
          ) comment_upvotes ON comment_upvotes.user_id = u.id
          
          LEFT JOIN (
            SELECT 
              author_id,
              SUM(clicks) as total_clicks
            FROM posts
            WHERE author_id = ? AND type = 'link'
            GROUP BY author_id
          ) click_stats ON click_stats.author_id = u.id
          
          LEFT JOIN (
            SELECT 
              author_id,
              COUNT(*) as posts_count
            FROM posts
            WHERE author_id = ?
            GROUP BY author_id
          ) post_stats ON post_stats.author_id = u.id
          
          LEFT JOIN (
            SELECT 
              user_id,
              COUNT(*) as comments_count
            FROM comments
            WHERE user_id = ?
            GROUP BY user_id
          ) comment_stats ON comment_stats.user_id = u.id
          
          WHERE u.id = ?
        )
        SELECT * FROM user_stats
      `)
      .bind(userId, userId, userId, userId, userId, userId)
      .first();

    // Get user's recent posts
    const recentPosts = await env.DB
      .prepare(`
        SELECT 
          id,
          type,
          title,
          url,
          slug,
          domain,
          score,
          clicks,
          comments_count,
          created_at
        FROM posts 
        WHERE author_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `)
      .bind(userId)
      .all();

    const userProfile = {
      ...user,
      can_edit_profile: currentUser ? currentUser.id === user.id : false,
      stats: stats || {
        post_upvotes: 0,
        comment_upvotes: 0,
        total_clicks: 0,
        posts_count: 0,
        comments_count: 0,
        total_score: 0
      },
      recent_posts: recentPosts.results || []
    };

    return new Response(JSON.stringify(userProfile), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load user profile' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetLeaderboard(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'total';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let timeFilter = '';
    let bindParams = [];

    if (period === 'weekly') {
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      timeFilter = 'AND (p.created_at > ? OR c.created_at > ?)';
      bindParams.push(weekAgo, weekAgo);
    }

    // Complex query to calculate author scores
    // Score = post_upvotes + (0.5 * comment_upvotes) + unique_clicks
    const query = `
      WITH author_stats AS (
        SELECT 
          u.id,
          u.display_name,
          u.avatar_url,
          u.bio,
          u.created_at,
          
          -- Post upvotes
          COALESCE(post_upvotes.total, 0) as post_upvotes,
          
          -- Comment upvotes  
          COALESCE(comment_upvotes.total, 0) as comment_upvotes,
          
          -- Total clicks on user's links
          COALESCE(click_stats.total_clicks, 0) as total_clicks,
          
          -- Post and comment counts
          COALESCE(post_stats.posts_count, 0) as posts_count,
          COALESCE(comment_stats.comments_count, 0) as comments_count,
          
          -- Calculate total score
          COALESCE(post_upvotes.total, 0) + 
          (0.5 * COALESCE(comment_upvotes.total, 0)) + 
          COALESCE(click_stats.total_clicks, 0) as total_score
          
        FROM users u
        
        -- Post upvotes
        LEFT JOIN (
          SELECT 
            p.author_id,
            COUNT(v.id) as total
          FROM posts p
          LEFT JOIN votes v ON v.entity_type = 'post' AND v.entity_id = p.id AND v.vote_type = 'up'
          WHERE 1=1 ${timeFilter ? 'AND p.created_at > ?' : ''}
          GROUP BY p.author_id
        ) post_upvotes ON post_upvotes.author_id = u.id
        
        -- Comment upvotes
        LEFT JOIN (
          SELECT 
            c.user_id,
            COUNT(v.id) as total
          FROM comments c
          LEFT JOIN votes v ON v.entity_type = 'comment' AND v.entity_id = c.id AND v.vote_type = 'up'
          WHERE 1=1 ${timeFilter ? 'AND c.created_at > ?' : ''}
          GROUP BY c.user_id  
        ) comment_upvotes ON comment_upvotes.user_id = u.id
        
        -- Click statistics
        LEFT JOIN (
          SELECT 
            p.author_id,
            SUM(p.clicks) as total_clicks
          FROM posts p
          WHERE p.type = 'link' ${timeFilter ? 'AND p.created_at > ?' : ''}
          GROUP BY p.author_id
        ) click_stats ON click_stats.author_id = u.id
        
        -- Post counts
        LEFT JOIN (
          SELECT 
            author_id,
            COUNT(*) as posts_count
          FROM posts p
          WHERE 1=1 ${timeFilter ? 'AND p.created_at > ?' : ''}
          GROUP BY author_id
        ) post_stats ON post_stats.author_id = u.id
        
        -- Comment counts
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(*) as comments_count
          FROM comments c
          WHERE 1=1 ${timeFilter ? 'AND c.created_at > ?' : ''}
          GROUP BY user_id
        ) comment_stats ON comment_stats.user_id = u.id
      )
      
      SELECT *
      FROM author_stats
      WHERE total_score > 0
      ORDER BY total_score DESC
      LIMIT ? OFFSET ?
    `;

    // Prepare bind parameters based on period
    let finalParams = [];
    
    if (period === 'weekly') {
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      // We need weekAgo for each timeFilter occurrence in the query
      finalParams.push(weekAgo, weekAgo, weekAgo, weekAgo, weekAgo); // 5 occurrences
    }
    
    finalParams.push(limit, offset);

    const authors = await env.DB
      .prepare(query)
      .bind(...finalParams)
      .all();

    return new Response(JSON.stringify({
      authors: authors.results || [],
      pagination: {
        limit,
        offset,
        hasMore: (authors.results?.length || 0) === limit
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load leaderboard' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleSubmitReport(request: Request, env: Env): Promise<Response> {
  // TODO: Implement reporting
  return new Response(JSON.stringify({ error: 'Not implemented yet' }), { status: 501 });
}

async function handleCreatePromotion(request: Request, env: Env): Promise<Response> {
  // TODO: Implement paid promotions
  return new Response(JSON.stringify({ error: 'Not implemented yet' }), { status: 501 });
}

async function handleUpdateHotness(request: Request, env: Env): Promise<Response> {
  try {
    // Update hotness scores for all posts using the algorithm from PRD
    // score = (upvotes + w*comments) / (age_hours + c)^α
    const alpha = 1.5;
    const c = 2;
    const w = 0.2;
    const now = Date.now();

    await env.DB
      .prepare(`
        UPDATE posts 
        SET hotness = (score + ? * comments_count) / POWER((? - created_at) / 3600000.0 + ?, ?)
        WHERE created_at > ?
      `)
      .bind(w, now, c, alpha, now - 7 * 24 * 60 * 60 * 1000) // Only update posts from last 7 days
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update hotness error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update hotness' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpdateLeaderboard(request: Request, env: Env): Promise<Response> {
  // TODO: Implement leaderboard calculation
  return new Response(JSON.stringify({ error: 'Not implemented yet' }), { status: 501 });
}

async function handleGenerateHomepageOGImage(request: Request, env: Env): Promise<Response> {
  try {
    // Create SVG with logo and tagline
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <!-- Background gradient -->
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f0f23;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1a1a3e;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fb923c;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f97316;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="1200" height="630" fill="url(#bgGradient)"/>
        
        <!-- Subtle pattern overlay -->
        <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/>
        </pattern>
        <rect width="1200" height="630" fill="url(#dots)"/>
        
        <!-- Main content container -->
        <g transform="translate(600, 315)">
          <!-- Logo circle -->
          <circle cx="0" cy="-80" r="50" fill="url(#logoGradient)" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
          
          <!-- Fire icon inside logo -->
          <g transform="translate(0, -80)">
            <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" 
                  fill="white" 
                  transform="scale(2.5) translate(-10, -10)"/>
          </g>
          
          <!-- Main title -->
          <text x="0" y="20" 
                text-anchor="middle" 
                font-family="Inter, system-ui, sans-serif" 
                font-size="72" 
                font-weight="700" 
                fill="white">
            Firehose
          </text>
          
          <!-- Subtitle/tagline -->
          <text x="0" y="70" 
                text-anchor="middle" 
                font-family="Inter, system-ui, sans-serif" 
                font-size="32" 
                font-weight="400" 
                fill="rgba(255,255,255,0.9)">
            Open publishing platform
          </text>
          
          <!-- Description -->
          <text x="0" y="110" 
                text-anchor="middle" 
                font-family="Inter, system-ui, sans-serif" 
                font-size="24" 
                font-weight="300" 
                fill="rgba(255,255,255,0.7)">
            No gatekeeping, just pure content flow
          </text>
          
          <!-- Website URL -->
          <text x="0" y="160" 
                text-anchor="middle" 
                font-family="Inter, system-ui, sans-serif" 
                font-size="20" 
                font-weight="500" 
                fill="rgba(251,146,60,0.9)">
            firehose.space
          </text>
        </g>
        
        <!-- Decorative elements -->
        <circle cx="150" cy="150" r="8" fill="rgba(251,146,60,0.6)"/>
        <circle cx="1050" cy="480" r="12" fill="rgba(251,146,60,0.4)"/>
        <circle cx="200" cy="500" r="6" fill="rgba(255,255,255,0.3)"/>
        <circle cx="1000" cy="150" r="10" fill="rgba(255,255,255,0.2)"/>
      </svg>
    `;

    // Return SVG as image
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleAnalyticsProxy(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/analytics', '');
    
    // Build PostHog URL
    const posthogUrl = `https://us.i.posthog.com${path}${url.search}`;
    
    // Forward the request to PostHog
    const response = await fetch(posthogUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('User-Agent') || 'Firehose-Proxy/1.0',
      },
      body: request.method === 'POST' ? await request.text() : undefined,
    });

    // Get response data
    const responseData = await response.text();
    
    // Return proxied response with CORS headers
    return new Response(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Analytics proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function handleAnalyticsStatic(request: Request, env: Env): Promise<Response> {
  try {
    // Proxy PostHog JavaScript library
    const response = await fetch('https://us-assets.i.posthog.com/static/array.js');
    const jsContent = await response.text();
    
    return new Response(jsContent, {
      headers: {
        'Content-Type': 'application/javascript',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });

  } catch (error) {
    console.error('Analytics static proxy error:', error);
    return new Response('console.error("Failed to load PostHog library");', {
      status: 200, // Return 200 to avoid breaking the page
      headers: {
        'Content-Type': 'application/javascript',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// Main Worker handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize JWT secret from environment - hash to exactly 32 bytes for A256GCM
    const secretData = new TextEncoder().encode(env.JWT_SECRET || 'default-secret-change-me');
    const hashBuffer = await crypto.subtle.digest('SHA-256', secretData);
    jwtSecretKey = new Uint8Array(hashBuffer);
    
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.SITE_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle analytics proxy routes dynamically (before normal route matching)
    if (path.startsWith('/api/analytics/')) {
      if (path === '/api/analytics/static/array.js') {
        return handleAnalyticsStatic(request, env);
      } else {
        return handleAnalyticsProxy(request, env);
      }
    }

    // Route matching
    const routeKey = `${method} ${path}`;
    
    // Simple parameter matching for routes with :id
    let handler = routes[routeKey];
    let params = {};
    
    if (!handler) {
      // Try to match parameterized routes
      for (const [route, routeHandler] of Object.entries(routes)) {
        const routeParts = route.split(' ')[1].split('/');
        const pathParts = path.split('/');
        
        if (routeParts.length === pathParts.length) {
          let match = true;
          const routeParams = {};
          
          for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
              routeParams[routeParts[i].slice(1)] = pathParts[i];
            } else if (routeParts[i] !== pathParts[i]) {
              match = false;
              break;
            }
          }
          
          if (match && route.startsWith(method + ' ')) {
            handler = routeHandler;
            params = routeParams;
            break;
          }
        }
      }
    }

    if (handler) {
      try {
        const response = await handler(request, env, params);
        
        // Add CORS headers to the response
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        
        return response;
      } catch (error) {
        console.error('Handler error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },

  // Cron trigger handler
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    try {
      // Update hotness scores every hour
      await handleUpdateHotness(new Request('http://dummy.com'), env);
      
      // Update leaderboard every hour  
      await handleUpdateLeaderboard(new Request('http://dummy.com'), env);
      
      console.log('Cron job completed successfully');
    } catch (error) {
      console.error('Cron job error:', error);
    }
  },
};
