#!/bin/bash

# Initialize D1 database for Firehose.space
# This script creates the database and applies the schema

echo "🚀 Initializing Firehose.space database..."

# Create D1 database
echo "Creating D1 database..."
wrangler d1 create firehose-db

echo "Please update wrangler.toml with the database_id from above output"
echo "Press any key to continue once you've updated the configuration..."
read -n 1 -s

# Apply schema
echo "Applying database schema..."
wrangler d1 execute firehose-db --file=./schema.sql

echo "✅ Database initialization complete!"
echo ""
echo "Next steps:"
echo "1. Update your wrangler.toml with the correct database_id"
echo "2. Create a KV namespace: wrangler kv:namespace create CACHE"
echo "3. Update wrangler.toml with the KV namespace ID"
echo "4. Run 'npm run dev' to start development server"
