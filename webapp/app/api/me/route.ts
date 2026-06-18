import { auth } from "@/auth";
import { NextResponse } from "next/server";

// ログイン中ユーザーの情報（役割）と、任意のSlack/GAS集中設定を返す。
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let webhooks: unknown = undefined;
  if (process.env.SLACK_WEBHOOKS) {
    try {
      webhooks = JSON.parse(process.env.SLACK_WEBHOOKS);
    } catch {
      webhooks = undefined;
    }
  }

  return NextResponse.json({
    email: session.user.email,
    name: session.user.name,
    role: session.user.role || "intern",
    gasUrl: process.env.GAS_URL || null,
    webhooks: webhooks ?? null,
  });
}
