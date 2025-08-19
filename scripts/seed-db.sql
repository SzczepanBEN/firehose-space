-- Seed data for Firehose.space development

-- Insert sample users
INSERT INTO users (id, email, display_name, bio, avatar_url) VALUES 
('user1', 'john@example.com', 'John Doe', 'Full-stack developer passionate about web technologies', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'),
('user2', 'jane@example.com', 'Jane Smith', 'AI researcher and tech entrepreneur', 'https://images.unsplash.com/photo-1494790108755-2616b612b37c?w=150'),
('user3', 'alex@example.com', 'Alex Chen', 'Product designer with a love for clean interfaces', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
('user4', 'sarah@example.com', 'Sarah Wilson', 'DevOps engineer and open source contributor', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150');

-- Insert sample link posts
INSERT INTO posts (id, type, title, url, slug, domain, normalized_url_hash, author_id, score, comments_count, created_at, hotness) VALUES 
('post1', 'link', 'The Future of Web Development: What to Expect in 2024', 'https://example.com/web-dev-2024', 'the-future-of-web-development-what-to-expect-in-2024-post1', 'example.com', 'hash1', 'user1', 42, 8, unixepoch() - 3600, 0.85),
('post2', 'link', 'Building Scalable APIs with Cloudflare Workers', 'https://blog.cloudflare.com/workers-api', 'building-scalable-apis-with-cloudflare-workers-post2', 'blog.cloudflare.com', 'hash2', 'user2', 28, 5, unixepoch() - 7200, 0.62),
('post3', 'link', 'Open Source Sustainability: A Developer Perspective', 'https://github.com/sustainability', 'open-source-sustainability-a-developer-perspective-post3', 'github.com', 'hash3', 'user4', 35, 12, unixepoch() - 14400, 0.45);

-- Insert sample self posts
INSERT INTO posts (id, type, title, url, slug, domain, normalized_url_hash, author_id, score, comments_count, created_at, hotness) VALUES 
('post4', 'self', 'My Journey Building a SaaS: Lessons Learned', NULL, 'my-journey-building-a-saas-lessons-learned-post4', NULL, NULL, 'user1', 67, 23, unixepoch() - 1800, 0.92),
('post5', 'self', 'The Art of Clean Code: Best Practices for Modern Development', NULL, 'the-art-of-clean-code-best-practices-for-modern-post5', NULL, NULL, 'user3', 19, 7, unixepoch() - 10800, 0.38);

-- Insert sample post bodies for self posts
INSERT INTO post_bodies (post_id, markdown) VALUES 
('post4', '# My Journey Building a SaaS: Lessons Learned

Over the past two years, I''ve been working on building a SaaS product from the ground up. Here are the key lessons I''ve learned along the way:

## 1. Start with the Problem, Not the Solution

The biggest mistake I made early on was falling in love with a technical solution before properly understanding the problem. I spent months building features that nobody actually wanted.

**Key takeaway:** Talk to potential customers extensively before writing a single line of code.

## 2. MVP is Truly Minimal

My first "MVP" had way too many features. It took me 6 months to build what should have been a 2-week project.

- Focus on one core workflow
- Cut everything that''s not absolutely essential
- You can always add features later

## 3. Infrastructure Matters

I initially chose a complex microservices architecture because it seemed "more scalable." This was a mistake for an early-stage product.

**What worked better:**
- Monolithic architecture initially
- Cloudflare stack for simplicity
- Focus on product-market fit first, optimize later

## 4. Customer Feedback is Gold

The features customers actually use vs. what they say they want are often completely different.

## Conclusion

Building a SaaS is hard, but incredibly rewarding. The key is to stay focused on solving real problems for real people.'),

('post5', '# The Art of Clean Code: Best Practices for Modern Development

Clean code is not just about making your code look pretty—it''s about making it maintainable, readable, and scalable. Here are my top principles:

## 1. Functions Should Do One Thing

```javascript
// Bad
function processUserData(user) {
  // validate user
  if (!user.email) throw new Error("No email");
  
  // save to database
  database.save(user);
  
  // send email
  emailService.send(user.email, "Welcome!");
  
  // log analytics
  analytics.track("user_created", user.id);
}

// Good
function validateUser(user) {
  if (!user.email) throw new Error("No email");
}

function saveUser(user) {
  return database.save(user);
}

function sendWelcomeEmail(user) {
  return emailService.send(user.email, "Welcome!");
}

function trackUserCreation(userId) {
  return analytics.track("user_created", userId);
}
```

## 2. Use Meaningful Names

Variable and function names should clearly express intent:

```javascript
// Bad
const d = new Date();
const u = users.filter(x => x.active);

// Good  
const currentDate = new Date();
const activeUsers = users.filter(user => user.isActive);
```

## 3. Keep Comments Minimal

Good code should be self-documenting. Comments should explain **why**, not **what**:

```javascript
// Bad
// Increment i by 1
i++;

// Good
// Retry failed requests up to 3 times to handle temporary network issues
const MAX_RETRIES = 3;
```

## 4. Consistent Formatting

Use automated tools like Prettier and ESLint. Your team should never argue about formatting.

## 5. Error Handling

Always handle errors gracefully and provide meaningful error messages.

Remember: Code is written once but read many times. Make it count!');

-- Insert sample comments
INSERT INTO comments (id, post_id, user_id, body, score, created_at) VALUES 
('comment1', 'post1', 'user2', 'Great article! I especially agree with your point about WebAssembly becoming more mainstream.', 5, unixepoch() - 3000),
('comment2', 'post1', 'user3', 'Thanks for sharing this. Do you think server-side rendering will make a comeback?', 3, unixepoch() - 2800),
('comment3', 'post4', 'user2', 'This resonates with me so much. I made the exact same MVP mistake on my first project.', 8, unixepoch() - 1200),
('comment4', 'post4', 'user3', 'What tools did you use for customer feedback collection?', 2, unixepoch() - 1000),
('comment5', 'post4', 'user1', '@user3 I used a combination of Intercom for in-app feedback and regular customer calls. Nothing beats direct conversation!', 4, unixepoch() - 800),
('comment6', 'post5', 'user4', 'Love the code examples! The function decomposition example really drives the point home.', 6, unixepoch() - 600);

-- Insert sample votes
INSERT INTO votes (user_id, entity_type, entity_id, vote_type) VALUES 
-- Post votes
('user2', 'post', 'post1', 'up'),
('user3', 'post', 'post1', 'up'),
('user4', 'post', 'post1', 'up'),
('user1', 'post', 'post2', 'up'),
('user3', 'post', 'post2', 'up'),
('user2', 'post', 'post4', 'up'),
('user3', 'post', 'post4', 'up'),
('user4', 'post', 'post4', 'up'),
-- Comment votes
('user1', 'comment', 'comment1', 'up'),
('user3', 'comment', 'comment3', 'up'),
('user2', 'comment', 'comment6', 'up');

-- Update post scores based on votes (this would normally be done by triggers or cron jobs)
UPDATE posts SET score = (
  SELECT COUNT(*) FROM votes 
  WHERE entity_type = 'post' AND entity_id = posts.id AND vote_type = 'up'
) - (
  SELECT COUNT(*) FROM votes 
  WHERE entity_type = 'post' AND entity_id = posts.id AND vote_type = 'down'
);

-- Update comment scores
UPDATE comments SET score = (
  SELECT COUNT(*) FROM votes 
  WHERE entity_type = 'comment' AND entity_id = comments.id AND vote_type = 'up'
) - (
  SELECT COUNT(*) FROM votes 
  WHERE entity_type = 'comment' AND entity_id = comments.id AND vote_type = 'down'
);
