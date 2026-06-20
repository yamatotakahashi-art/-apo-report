import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 既存のバニラ版アプリは public/legacy/ から配信し、iframe で読み込む
};

export default nextConfig;

// `next dev` 時にCloudflareのbindings/環境変数を使えるようにする（本番ビルドには影響なし）
initOpenNextCloudflareForDev();
