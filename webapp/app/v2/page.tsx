import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import ReportClient from "./ReportClient";

// 新版（AlphaDrive 目標仕様）の試作。Phase 1＝報告画面のみ。
// 既存の / （ログイン＋iframe）は壊さずに、ここで並行して作る。
export default async function V2Page() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const role = session.user.role || "intern";
  const roleLabel = role === "staff" ? "正社員（テンプレ編集可）" : "インターン（利用のみ）";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          background: "#1b2236",
          color: "#fff",
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontWeight: 700 }}>営業報告ツール</strong>
        <span style={{ padding: "2px 8px", borderRadius: 6, background: "#5558e0", fontWeight: 600, fontSize: 11 }}>新版 試作 (Phase 1)</span>
        <span style={{ marginLeft: "auto", opacity: 0.95 }}>{session.user.email}</span>
        <span style={{ padding: "2px 8px", borderRadius: 6, background: role === "staff" ? "#0f6e56" : "rgba(255,255,255,0.18)", fontWeight: 600 }}>{roleLabel}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12 }}
          >
            ログアウト
          </button>
        </form>
      </header>
      <div style={{ flex: 1, overflow: "auto" }}>
        {role === "staff" ? (
          <ReportClient />
        ) : (
          <div style={{ maxWidth: 520, margin: "60px auto", padding: "32px", textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "#1b2236" }}>新版は準備中です（正社員のみ先行確認）</h2>
            <p style={{ fontSize: 14, lineHeight: 1.8 }}>
              新しい報告画面は現在テスト中で、正社員のみ閲覧できます。<br />
              ふだんの業務はこれまでのツールをそのままご利用ください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
