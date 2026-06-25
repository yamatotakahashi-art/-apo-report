import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/projects";

// 一覧：ログイン済み全員
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects, role: session.user.role || "intern" });
  } catch (e) {
    console.error("[projects] list failed:", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

// 新規作成：staff のみ
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "staff") return NextResponse.json({ error: "forbidden: staff only" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const id = await createProject(name, String(body?.description ?? ""), String(body?.slack_channel ?? ""));
  return NextResponse.json({ id });
}
