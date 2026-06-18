import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getAllTemplates, upsertTemplate, resetTemplate } from "@/lib/templates";

// 全ユーザー：会社標準テンプレートを取得
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const templates = await getAllTemplates();
  return NextResponse.json({ templates, role: session.user.role || "intern" });
}

// 正社員(staff)のみ：1ステータス分の会社標準を保存（reset=true で既定に戻す）
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "staff") {
    return NextResponse.json({ error: "forbidden: staff only" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const mailType = body?.mail_type;
  const status = body?.status;
  if (!["meeting", "doc"].includes(mailType) || typeof status !== "string" || !status) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const editor = session.user.email || "unknown";
  if (body?.reset === true) {
    await resetTemplate(mailType, status, editor);
  } else {
    await upsertTemplate(mailType, status, String(body?.subject ?? ""), String(body?.body ?? ""), editor);
  }
  return NextResponse.json({ ok: true });
}
