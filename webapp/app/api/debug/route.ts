import { NextResponse } from "next/server";

// 一時的な診断用エンドポイント。
// 環境変数が「実行時(ランタイム)」に届いているかを、true/false だけで返す（値は出さない）。
// 原因切り分けが済んだら削除する。
export async function GET() {
  const keys = [
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "DATABASE_URL",
    "ALLOWED_EMAIL_DOMAINS",
    "ADMIN_EMAILS",
  ];
  const has: Record<string, boolean> = {};
  for (const k of keys) has[k] = !!process.env[k];
  return NextResponse.json({ ok: true, runtimeReceivesEnv: has });
}
