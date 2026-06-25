import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import AppShell from "./AppShell";

// 新版（目標仕様）の Phase 1。サイドバー＋報告画面。
// 既存の / （ログイン＋iframe）と配布版 index.html は未変更。staff のみ閲覧可。
export default async function V2Page() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const role = (session.user.role || "intern") as "staff" | "intern";

  if (role !== "staff") {
    return (
      <div style={{ maxWidth: 520, margin: "80px auto", padding: 32, textAlign: "center", color: "#687284", fontFamily: "'Noto Sans JP', sans-serif" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "#141a24" }}>新版は準備中です（正社員のみ先行確認）</h2>
        <p style={{ fontSize: 14, lineHeight: 1.8 }}>
          新しい報告画面は現在テスト中で、正社員のみ閲覧できます。
          <br />
          ふだんの業務はこれまでのツールをそのままご利用ください。
        </p>
      </div>
    );
  }

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return <AppShell email={session.user.email || ""} role={role} signOutAction={doSignOut} />;
}
