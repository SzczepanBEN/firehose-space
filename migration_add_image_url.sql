-- Migration: Add image_url column to posts table
-- Run with: wrangler d1 execute firehose-space --env production --file=migration_add_image_url.sql

ALTER TABLE posts ADD COLUMN image_url TEXT;
