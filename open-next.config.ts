// OpenNext Cloudflare — worker configuration
// Docs: https://opennext.js.org/cloudflare
//
// The app is fully prerendered (static + hash-routed client views) and its API
// routes are dynamic-by-nature, so no incremental-cache override is required —
// the default config needs no KV namespace and keeps deploys one-command simple.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
