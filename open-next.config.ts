// OpenNext Cloudflare — worker configuration
// Docs: https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  // KV-backed ISR cache (the app is fully static/hash-routed, so cache misses
  // are rare — but this keeps any future dynamic page correct and fast).
  incrementalCache: kvIncrementalCache,
});
