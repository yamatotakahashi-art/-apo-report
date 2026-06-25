import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { upsertTemplate, type TemplateKind } from "@/lib/projects";

const KINDS: TemplateKind[] = ["slack", "email_material", "email_appo"];

// 案件テンプレ（会社標準）の保存：staff のみ
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "staff") return NextResponse.json({ error: "forbidden: staff only" }, { status: 403 });
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const kind = body?.kind as TemplateKind;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  try {
    await upsertTemplate(id, kind, String(body?.subject ?? ""), String(body?.body ?? ""), session.user.email || "unknown");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[projects] template save failed:", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
