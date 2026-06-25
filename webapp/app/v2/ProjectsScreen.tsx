"use client";

import { useEffect, useState } from "react";
import { T } from "./ui";

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  slack_channel: string;
  archived: boolean;
  appo: number;
  material: number;
}
type Kind = "slack" | "email_material" | "email_appo";
interface Detail {
  id: string;
  name: string;
  description: string;
  slack_channel: string;
  service_name: string;
  service_url: string;
  meeting_url: string;
  archived: boolean;
  members: string[];
  cc: string[];
  mentions: string[];
  docs: string[];
  templates: Record<Kind, { subject: string; body: string }>;
}
type Tab = "basic" | "slack" | "email" | "docs" | "members";

const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 18, marginBottom: 16 };
const label: React.CSSProperties = { display: "block", fontSize: 13, color: T.muted, marginBottom: 6 };
const input: React.CSSProperties = { width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 14, fontFamily: "inherit", color: T.body, boxSizing: "border-box" };
const linesToArr = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function ProjectsScreen({ role }: { role: "staff" | "intern" }) {
  const isStaff = role === "staff";
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [err, setErr] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadList() {
    setErr("");
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("一覧の取得に失敗しました（" + res.status + "）");
      const j = await res.json();
      setRows(j.projects);
    } catch (e: any) {
      setErr(e.message || "読み込みエラー");
      setRows([]);
    }
  }
  useEffect(() => {
    loadList();
  }, []);

  async function createNew() {
    const name = prompt("新しい案件名");
    if (!name) return;
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (res.ok) {
      const j = await res.json();
      await loadList();
      setEditingId(j.id);
    } else {
      alert("作成に失敗しました（正社員のみ作成できます）");
    }
  }

  if (editingId) return <ProjectEdit id={editingId} isStaff={isStaff} onBack={() => { setEditingId(null); loadList(); }} />;

  const list = (rows || []).filter((r) => r.archived === showArchived);

  return (
    <div style={{ padding: "22px 28px" }}>
      <header style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: T.ink }}>案件管理</h1>
        {isStaff && (
          <button onClick={createNew} style={{ marginLeft: "auto", padding: "9px 16px", background: T.accent, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
            ＋ 新規案件
          </button>
        )}
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[false, true].map((a) => (
          <button
            key={String(a)}
            onClick={() => setShowArchived(a)}
            style={{ padding: "8px 16px", borderRadius: 8, fontSize: 14, fontFamily: "inherit", cursor: "pointer", border: "none", background: showArchived === a ? T.ink : "transparent", color: showArchived === a ? "#fff" : T.muted, fontWeight: showArchived === a ? 700 : 400 }}
          >
            {a ? "アーカイブ" : "アクティブ"}（{(rows || []).filter((r) => r.archived === a).length}）
          </button>
        ))}
      </div>

      {err && <div style={{ ...card, color: "#b4341f", background: "#fdecea", borderColor: "#f5c6cb" }}>{err}</div>}
      {rows === null && <div style={{ color: T.muted, fontSize: 14 }}>読み込み中…</div>}
      {rows && list.length === 0 && !err && <div style={{ color: T.muted, fontSize: 14, padding: "30px 0", textAlign: "center" }}>案件がありません。{isStaff && "「＋新規案件」から追加できます。"}</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((r) => (
          <div key={r.id} onClick={() => setEditingId(r.id)} style={{ ...card, marginBottom: 0, cursor: "pointer", display: "grid", gridTemplateColumns: "2fr 1.3fr 1.2fr auto", gap: 14, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.ink }}>{r.name}</div>
              {r.description && <div style={{ fontSize: 12, color: T.faint, marginTop: 3 }}>{r.description}</div>}
            </div>
            <div style={{ color: T.accent, fontSize: 13, fontFamily: T.mono }}>{r.slack_channel || "—"}</div>
            <div style={{ fontSize: 13, color: T.muted }}>
              今月 <b style={{ color: T.ink }}>{r.appo + r.material}</b>件<span style={{ color: T.faint }}>（アポ{r.appo}／資料{r.material}）</span>
            </div>
            <div style={{ color: T.accent, fontSize: 13 }}>{isStaff ? "編集" : "表示"} →</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectEdit({ id, isStaff, onBack }: { id: string; isStaff: boolean; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("basic");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((j) => j.project && setD(j.project))
      .catch(() => {});
  }, [id]);

  if (!d) return <div style={{ padding: "30px 28px", color: T.muted }}>読み込み中…</div>;

  const set = (patch: Partial<Detail>) => setD({ ...d, ...patch });
  const setTpl = (k: Kind, p: Partial<{ subject: string; body: string }>) => setD({ ...d, templates: { ...d.templates, [k]: { ...d.templates[k], ...p } } });

  async function saveAll() {
    if (!isStaff || !d) return;
    setSaving(true);
    setSaved("");
    try {
      const r1 = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: d.name, description: d.description, slack_channel: d.slack_channel, service_name: d.service_name, service_url: d.service_url, meeting_url: d.meeting_url, archived: d.archived, cc: d.cc, mentions: d.mentions, members: d.members, docs: d.docs }),
      });
      if (!r1.ok) throw new Error();
      for (const k of ["slack", "email_material", "email_appo"] as Kind[]) {
        const t = d.templates[k];
        if (t.subject || t.body) {
          await fetch(`/api/projects/${id}/templates`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: k, subject: t.subject, body: t.body }) });
        }
      }
      setSaved("✓ 保存しました");
      setTimeout(() => setSaved(""), 2000);
    } catch {
      setSaved("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const TABS: [Tab, string][] = [["basic", "基本"], ["slack", "Slack"], ["email", "メールテンプレ"], ["docs", "資料"], ["members", "メンバー"]];
  const ro = !isStaff;

  const listEditor = (val: string[], on: (a: string[]) => void, ph: string) => (
    <textarea value={val.join("\n")} onChange={(e) => on(linesToArr(e.target.value))} disabled={ro} placeholder={ph} style={{ ...input, height: 92, resize: "vertical", fontFamily: T.mono, fontSize: 13 }} />
  );

  return (
    <div style={{ padding: "22px 28px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: 0 }}>← 案件管理</button>
        <span style={{ color: T.faint }}>/</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>{d.name || "(無題)"}</span>
        {!isStaff && <span style={{ fontSize: 12, color: T.muted, background: T.canvas2, borderRadius: 6, padding: "3px 8px" }}>閲覧のみ（編集は正社員）</span>}
        {isStaff && (
          <button onClick={saveAll} disabled={saving} style={{ marginLeft: "auto", padding: "9px 18px", background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "保存中…" : "保存"}
          </button>
        )}
        {saved && <span style={{ fontSize: 13, color: saved.startsWith("✓") ? T.apo : "#b4341f" }}>{saved}</span>}
      </header>

      <div style={{ display: "flex", gap: 24, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
        {TABS.map(([k, lab]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "10px 0", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${T.accent}` : "2px solid transparent", color: tab === k ? T.accent : T.muted, fontWeight: tab === k ? 700 : 400, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>
            {lab}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 760 }}>
        {tab === "basic" && (
          <div style={card}>
            <label style={label}>案件名</label>
            <input value={d.name} onChange={(e) => set({ name: e.target.value })} disabled={ro} style={{ ...input, marginBottom: 14 }} />
            <label style={label}>説明</label>
            <input value={d.description} onChange={(e) => set({ description: e.target.value })} disabled={ro} style={{ ...input, marginBottom: 14 }} />
            <label style={label}>Slack チャンネル</label>
            <input value={d.slack_channel} onChange={(e) => set({ slack_channel: e.target.value })} disabled={ro} placeholder="#sales-xxxx" style={{ ...input, marginBottom: 14, fontFamily: T.mono }} />
            <label style={label}>サービス名（報告メールの差し込み用）</label>
            <input value={d.service_name} onChange={(e) => set({ service_name: e.target.value })} disabled={ro} placeholder="AD研修サービス" style={{ ...input, marginBottom: 14 }} />
            <label style={label}>サービスURL</label>
            <input value={d.service_url} onChange={(e) => set({ service_url: e.target.value })} disabled={ro} placeholder="https://…" style={{ ...input, marginBottom: 14, fontFamily: T.mono }} />
            <label style={label}>面談リンク（アポ報告で自動入力）</label>
            <input value={d.meeting_url} onChange={(e) => set({ meeting_url: e.target.value })} disabled={ro} placeholder="https://meet.google.com/…" style={{ ...input, marginBottom: 14, fontFamily: T.mono }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: T.body, cursor: ro ? "default" : "pointer" }}>
              <input type="checkbox" checked={d.archived} onChange={(e) => set({ archived: e.target.checked })} disabled={ro} />
              アーカイブ（一覧の「アーカイブ」に移動）
            </label>
          </div>
        )}

        {tab === "slack" && (
          <div style={card}>
            <label style={label}>メンション対象（1行に1つ・@表記）</label>
            {listEditor(d.mentions, (a) => set({ mentions: a }), "@山田\n@鈴木")}
            <label style={{ ...label, marginTop: 16 }}>Slack 投稿テンプレ（差し込みタグ可。空なら既定の整形文を使用）</label>
            <textarea value={d.templates.slack.body} onChange={(e) => setTpl("slack", { body: e.target.value })} disabled={ro} placeholder={"{mentions}\n【{outcome_label}】（{company_name}）\nご担当: {recipient_name} 様\n…"} style={{ ...input, height: 150, resize: "vertical", fontFamily: T.mono, fontSize: 13 }} />
          </div>
        )}

        {tab === "email" && (
          <div style={card}>
            <label style={label}>固定 CC（1行に1つ・社内＋依頼主/発注元。エンド顧客は入れない）</label>
            {listEditor(d.cc, (a) => set({ cc: a }), "manager@marchon.co.jp\nclient@example.co.jp")}
            {(["email_material", "email_appo"] as Kind[]).map((k) => (
              <div key={k} style={{ marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginBottom: 10 }}>{k === "email_material" ? "📄 資料送付用テンプレ" : "⭐ アポお礼用テンプレ"}</div>
                <label style={label}>件名</label>
                <input value={d.templates[k].subject} onChange={(e) => setTpl(k, { subject: e.target.value })} disabled={ro} style={{ ...input, marginBottom: 10 }} />
                <label style={label}>本文（差し込みタグ：{"{宛名}{名乗り}{日時}{送付資料}{次回連絡}{署名}"} 等）</label>
                <textarea value={d.templates[k].body} onChange={(e) => setTpl(k, { body: e.target.value })} disabled={ro} style={{ ...input, height: 150, resize: "vertical", fontFamily: T.mono, fontSize: 13 }} />
              </div>
            ))}
          </div>
        )}

        {tab === "docs" && (
          <div style={card}>
            <label style={label}>送付資料リスト（1行に1つ）。報告画面の「資料請求」でチェック選択できます。</label>
            {listEditor(d.docs, (a) => set({ docs: a }), "サービス概要.pdf\n料金表.pdf\n導入事例.pdf")}
          </div>
        )}

        {tab === "members" && (
          <div style={card}>
            <label style={label}>メンバー（1行に1メール）</label>
            {listEditor(d.members, (a) => set({ members: a }), "yamada@marchon.co.jp\nsuzuki@marchon.co.jp")}
            <p style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>※ ここは案件の表示メンバーです。staff/intern の権限は別管理（設定で対応予定）。</p>
          </div>
        )}
      </div>
    </div>
  );
}
