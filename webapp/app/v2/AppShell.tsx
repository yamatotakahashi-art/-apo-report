"use client";

import { useState } from "react";
import { T } from "./ui";
import ReportScreen from "./ReportScreen";
import ProjectsScreen from "./ProjectsScreen";

type Screen = "report" | "projects" | "history" | "settings";
const NAV: { key: Screen; icon: string; label: string }[] = [
  { key: "report", icon: "📮", label: "報告" },
  { key: "projects", icon: "📁", label: "案件" },
  { key: "history", icon: "📋", label: "履歴" },
  { key: "settings", icon: "⚙️", label: "設定" },
];

export default function AppShell({
  email,
  role,
  signOutAction,
}: {
  email: string;
  role: "staff" | "intern";
  signOutAction: () => Promise<void>;
}) {
  const [screen, setScreen] = useState<Screen>("report");
  const roleLabel = role === "staff" ? "正社員" : "インターン";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.canvas, color: T.body }}>
      {/* ===== サイドバー ===== */}
      <aside
        style={{
          width: 232,
          flex: "none",
          background: T.ink,
          color: "#cdd3de",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 18px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              flex: "none",
              borderRadius: 9,
              background: T.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            営
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>営業報告ツール</div>
            <span
              style={{
                display: "inline-block",
                marginTop: 3,
                fontSize: 10,
                color: "#fff",
                background: T.accent,
                borderRadius: 5,
                padding: "1px 6px",
              }}
            >
              Phase 1
            </span>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 10px" }}>
          {NAV.map((n) => {
            const active = screen === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setScreen(n.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderLeft: active ? `3px solid ${T.accent}` : "3px solid transparent",
                  borderRadius: active ? "0 8px 8px 0" : 8,
                  fontSize: 14,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  color: active ? "#fff" : "#cdd3de",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", padding: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 12, color: "#cdd3de", wordBreak: "break-all", marginBottom: 8 }}>{email}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                background: role === "staff" ? "#1f6f55" : "rgba(255,255,255,0.16)",
                borderRadius: 5,
                padding: "2px 8px",
              }}
            >
              {roleLabel}
            </span>
            <form action={signOutAction} style={{ marginLeft: "auto" }}>
              <button
                type="submit"
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "transparent",
                  color: "#cdd3de",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ===== コンテンツ ===== */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {screen === "report" ? (
          <ReportScreen />
        ) : screen === "projects" ? (
          <ProjectsScreen role={role} />
        ) : (
          <div style={{ padding: "60px 40px", maxWidth: 640, margin: "0 auto", textAlign: "center", color: T.muted }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{NAV.find((n) => n.key === screen)?.icon}</div>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, color: T.ink }}>{NAV.find((n) => n.key === screen)?.label}画面</h2>
            <p style={{ fontSize: 14, lineHeight: 1.8 }}>
              この画面は Phase 3 で実装予定です。
              <br />
              （履歴・設定）
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
