import { neon } from "@neondatabase/serverless";

// Neon serverless ドライバ（fetchベースなので Edge / Node どちらでも動作）
if (!process.env.DATABASE_URL) {
  // 起動時に気づけるように明示（ビルド時は評価されない）
  console.warn("[db] DATABASE_URL が未設定です。.env.local を確認してください。");
}

export const sql = neon(process.env.DATABASE_URL || "");
