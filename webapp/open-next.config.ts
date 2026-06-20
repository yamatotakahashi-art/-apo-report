import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext（Cloudflare Workers）でNext.jsを動かすための設定。
// キャッシュ等は最小構成（必要になったらR2/KV等を足せる）。
export default defineCloudflareConfig({});
