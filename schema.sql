-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  website_url TEXT,
  trust_level INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Posts table  
CREATE TABLE posts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type TEXT NOT NULL CHECK (type IN ('link', 'self')),
  title TEXT NOT NULL,
  url TEXT, -- NULL for self posts
  slug TEXT NOT NULL,
  domain TEXT, -- extracted from URL for link posts
  normalized_url_hash TEXT, -- for duplicate detection
  author_id TEXT NOT NULL REFERENCES users(id),
  score INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  hotness REAL DEFAULT 0.0
);

-- Post bodies for self posts (markdown content)
CREATE TABLE post_bodies (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Votes table (for posts and comments)
CREATE TABLE votes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post', 'comment')),
  entity_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  UNIQUE(user_id, entity_type, entity_id)
);

-- Comments table
CREATE TABLE comments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  parent_id TEXT REFERENCES comments(id), -- NULL for top-level comments
  score INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Promotions table
CREATE TABLE promotions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'expired', 'cancelled')) DEFAULT 'pending',
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Reports table
CREATE TABLE reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post', 'comment', 'user')),
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  reporter_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')) DEFAULT 'pending',
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- User sessions (for magic link auth)
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Magic link tokens (temporary, for login)
CREATE TABLE magic_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_hotness ON posts(hotness DESC);
CREATE INDEX idx_posts_score ON posts(score DESC);
CREATE INDEX idx_posts_domain ON posts(domain);
CREATE INDEX idx_posts_normalized_url_hash ON posts(normalized_url_hash);
CREATE UNIQUE INDEX idx_posts_slug ON posts(slug);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

CREATE INDEX idx_votes_entity ON votes(entity_type, entity_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);

CREATE INDEX idx_promotions_active ON promotions(status, starts_at, ends_at);
CREATE INDEX idx_reports_status ON reports(status, created_at);
