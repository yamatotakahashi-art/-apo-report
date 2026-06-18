import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
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
          background: "#185fa5",
          color: "#fff",
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontWeight: 600 }}>営業報告・メールジェネレーター</strong>
        <span style={{ marginLeft: "auto", opacity: 0.95 }}>
          {session.user.email}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 6,
            background: role === "staff" ? "#0f6e56" : "rgba(255,255,255,0.18)",
            fontWeight: 600,
          }}
        >
          {roleLabel}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.5)",
              background: "transparent",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ログアウト
          </button>
        </form>
      </header>

      {/* 既存のバニラ版アプリをそのまま読み込む（テンプレ/役割だけサーバ連携） */}
      <iframe
        src="/legacy/index.html"
        title="営業報告・メールジェネレーター"
        style={{ flex: 1, width: "100%", border: "none" }}
      />
    </div>
  );
}
