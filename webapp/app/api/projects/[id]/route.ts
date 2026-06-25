import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getProject, updateProjectBasic, setCc, setMentions, setMembers } from "@/lib/projects";

// 詳細：ログイン済み全員
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ project, role: session.user.role || "intern" });
  } catch (e) {
    console.error("[projects] detail failed:", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

// 基本設定＋CC/メンション/メンバーの保存：staff のみ
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
  const arr = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  try {
    await updateProjectBasic(id, {
      name: String(body?.name ?? "").trim() || "(無題)",
      description: String(body?.description ?? ""),
      slack_channel: String(body?.slack_channel ?? ""),
      archived: !!body?.archived,
    });
    await setCc(id, arr(body?.cc));
    await setMentions(id, arr(body?.mentions));
    await setMembers(id, arr(body?.members));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[projects] update failed:", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
