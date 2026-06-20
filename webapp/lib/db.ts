import { neon } from "@neondatabase/serverless";

// Cloudflare(Workers/Pages)では環境変数がリクエスト時にのみ参照可能なため、
// モジュール初期化時ではなく「呼ばれた時」に接続を作る（遅延読み）。
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が未設定です（環境変数を確認してください）");
  return neon(url);
}
