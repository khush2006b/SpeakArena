#!/bin/sh
# Redis initialization script for Docker / Production environments.
# 
# This script ensures that Redis is configured with the 'allkeys-lru' eviction policy.
# This is critical for SpeakArena, as Redis is used for Rate Limiting and Session 
# tracking. If memory fills up, we must evict old rate limit keys rather than 
# crashing the server with OOM errors (the default 'noeviction' behavior).

echo "Configuring Redis eviction policy..."

# Wait for Redis to be ready
until redis-cli ping | grep -q "PONG"; do
  echo "Waiting for Redis to start..."
  sleep 1
done

# Set the maxmemory policy to evict the least recently used keys
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Set a sensible max memory limit (e.g., 256MB) to ensure eviction triggers
# before host memory is exhausted. Adjust this based on your server instance size.
redis-cli CONFIG SET maxmemory 256mb

echo "✅ Redis configured successfully with allkeys-lru (256MB limit)."
