"use client";

import { useEffect, useMemo, useState } from "react";
import { T, copyText } from "./ui";
import {
  parseInput,
  renderMail,
  STATUS_LABEL,
  STATUS_ORDER,
  outcomeToMailType,
  type Outcome,
  type Status,
  type ParsedRecord,
  type MailFormValues,
} from "@/lib/report/engine";
import { getTemplate } from "@/lib/report/templates";

// ===== Phase 1：案件は固定サンプル（Phase 2 で Neon の案件設定に置き換え） =====
interface SampleProject {
  id: string;
  name: string;
  channel: string;
  mentions: string[];
  serviceName: string;
  serviceUrl: string;
  meetingUrl: string;
  cc: string[];
  docs: string[];
}
const PROJECTS: SampleProject[] = [
  {
    id: "sample",
    name: "サンプル案件（AD研修）",
    channel: "#sales-sample",
    mentions: ["@山田", "@鈴木"],
    serviceName: "AD研修サービス",
    serviceUrl: "https://example.co.jp/ad",
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    cc: ["manager@marchon.co.jp", "client@example.co.jp"],
    docs: ["サービス概要.pdf", "料金表.pdf"],
  },
  { id: "none", name: "（メンションなし）", channel: "", mentions: [], serviceName: "", serviceUrl: "", meetingUrl: "", cc: [], docs: [] },
];

const NEXT_APPO = ["前日にリマインドをお送りします", "当日朝にご連絡いたします", "開催前にメールでご案内します"];
const NEXT_DOC = ["お電話にてご状況を伺えればと存じます。", "来週中に改めてご連絡いたします。", "ご不明点があればご返信ください。"];

const FORM_KEY = "apoReport2_personal";

// ===== 日付ヘルパ（クリック時のみ実行＝SSRに影響しない） =====
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function tomorrowAt(h: number, m: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return fmt(d);
}
function nextMondayAt(h: number, m: number): string {
  const d = new Date();
  const add = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(h, m, 0, 0);
  return fmt(d);
}

function buildSlack(
  rec: ParsedRecord,
  outcome: Outcome,
  status: Status,
  project: SampleProject,
  reporter: string,
  extra: { meetingAt: string; docs: string; nextContact: string },
): string {
  const heading = outcome === "material" ? "【資料請求報告】" : "【アポ獲得報告】";
  const L: string[] = [];
  if (project.mentions.length) L.push(project.mentions.join(" "));
  L.push(`${heading}（${rec.facility || "（未検出）"}）`);
  if (reporter.trim()) L.push("担当: " + reporter.trim());
  if (rec.dept) L.push("事業部: " + rec.dept);
  L.push("ご担当: " + (rec.person || "ご担当者様"));
  if (rec.phone) L.push("電話: " + rec.phone);
  L.push("状況: " + (STATUS_LABEL[status] || status) + (rec.statusAuto ? "（自動判定）" : ""));
  if (outcome === "appointment") {
    if (extra.meetingAt) L.push("面談日時: " + extra.meetingAt);
  } else if (extra.docs) {
    L.push("送付資料: " + extra.docs);
  }
  if (extra.nextContact) L.push("次回連絡: " + extra.nextContact);
  if (rec.note) L.push("メモ: " + rec.note);
  if (rec.warnings.length) L.push("⚠ 要確認: " + rec.warnings.join(" / "));
  return L.join("\n");
}

// ===== 小物 =====
function Badge({ kind }: { kind: "auto" | "pick" }) {
  const auto = kind === "auto";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 5,
        color: auto ? "#1f6f55" : T.accent,
        background: auto ? T.apoSoft : T.accentSoft,
      }}
    >
      {auto ? "自動入力" : "選択するだけ"}
    </span>
  );
}

export default function ReportScreen() {
  const [outcome, setOutcome] = useState<Outcome>("appointment");
  const [projectId, setProjectId] = useState("sample");
  const [text, setText] = useState("");
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [idx, setIdx] = useState(0);
  const [statusManual, setStatusManual] = useState<Status | null>(null);
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingUrlOverride, setMeetingUrlOverride] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nextContact, setNextContact] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [deptOverride, setDeptOverride] = useState<string | null>(null);
  const [sig, setSig] = useState({ intro: "", block: "" });
  const [reporter, setReporter] = useState("");
  const [personalOpen, setPersonalOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [toast, setToast] = useState("");

  const project = PROJECTS.find((p) => p.id === projectId) || PROJECTS[0];
  const mailType = outcomeToMailType(outcome);
  const rec = records[idx] as ParsedRecord | undefined;
  const status: Status = statusManual ?? ((rec?.status || "visit") as Status);

  // 個人設定（ブラウザ内のみ）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORM_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.sig) setSig(o.sig);
        if (typeof o.reporter === "string") setReporter(o.reporter);
      }
      const rp = localStorage.getItem("alphadrive_reporter_name");
      if (rp && !reporter) setReporter(rp);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({ sig, reporter }));
    } catch {}
  }, [sig, reporter]);

  function doParse() {
    const recs = parseInput(text, outcome);
    setRecords(recs);
    setIdx(0);
    setStatusManual(null);
    setDeptOverride(null);
  }
  function clearAll() {
    setText("");
    setRecords([]);
    setStatusManual(null);
  }
  function updateRec(field: keyof ParsedRecord, value: string) {
    setRecords((prev) => prev.map((r, j) => (j === idx ? { ...r, [field]: value } : r)));
  }
  function toggleDoc(d: string) {
    setSelectedDocs((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  const form: MailFormValues = useMemo(
    () => ({
      serviceName: project.serviceName,
      serviceUrl: project.serviceUrl,
      datetime: meetingAt,
      link: meetingUrlOverride ?? project.meetingUrl,
      content: "",
      docs: selectedDocs.join(","),
      nextstep: nextContact,
      dept: deptOverride ?? "",
    }),
    [project, meetingAt, meetingUrlOverride, selectedDocs, nextContact, deptOverride],
  );

  const mail = useMemo(() => {
    if (!rec) return null;
    return renderMail(rec, mailType, status, getTemplate(mailType, status), form, sig);
  }, [rec, mailType, status, form, sig]);

  const slack = useMemo(
    () => (rec ? buildSlack(rec, outcome, status, project, reporter, { meetingAt, docs: selectedDocs.join("、"), nextContact }) : ""),
    [rec, outcome, status, project, reporter, meetingAt, selectedDocs, nextContact],
  );

  // 解析前のプレースホルダ（テンプレ構造を{タグ}付きで見せる）
  const placeholderMail = getTemplate(mailType, status);

  async function doCopy(kind: string, value: string, undoMsg?: string) {
    const ok = await copyText(value);
    setCopied(ok ? kind : "");
    setTimeout(() => setCopied(""), 1600);
    if (ok && undoMsg) {
      setToast(undoMsg);
      setTimeout(() => setToast(""), 6000);
    }
  }

  // ===== style helpers =====
  const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 18, marginBottom: 16 };
  const label: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.muted, marginBottom: 8 };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    border: `1px solid ${T.border}`,
    borderRadius: 9,
    fontSize: 14,
    fontFamily: "inherit",
    color: T.body,
    boxSizing: "border-box",
  };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: "7px 13px",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    border: active ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
    background: active ? T.accentSoft : T.card,
    color: active ? T.accent : T.muted,
  });

  const accent = outcome === "appointment" ? T.apo : T.doc;
  const accentSoft = outcome === "appointment" ? T.apoSoft : T.docSoft;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* ===== ヘッダ ===== */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 28px",
          background: T.card,
          borderBottom: `1px solid ${T.border}`,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: T.ink }}>新規報告</h1>
        <div style={{ position: "relative" }}>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSelectedDocs([]);
              setMeetingUrlOverride(null);
            }}
            style={{ ...input, width: "auto", paddingRight: 30, appearance: "none", cursor: "pointer", fontSize: 13 }}
          >
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                案件: {p.name}
              </option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: 12, color: T.apo, display: "flex", alignItems: "center", gap: 5 }}>✓ 下書き自動保存</span>
        <button
          onClick={() => {
            setToast("👤 上長に確認を依頼しました（任意・送信は止めません）");
            setTimeout(() => setToast(""), 5000);
          }}
          style={{
            marginLeft: "auto",
            padding: "8px 14px",
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.body,
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          👤 上長に確認を依頼
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, flex: 1 }}>
        {/* ===== 左：入力 ===== */}
        <div style={{ padding: "22px 28px", borderRight: `1px solid ${T.border}` }}>
          <div style={{ ...card, background: accentSoft, borderColor: "transparent", display: "flex", gap: 10, fontSize: 13, color: T.body, lineHeight: 1.6 }}>
            <span>💡</span>
            <div>手入力は最小限。<b>貼り付け＋ワンタップ選択</b>で報告文とメールが自動で出来上がります。</div>
          </div>

          {/* 区分トグル */}
          <div style={{ ...label }}>成果区分（この2種のみ）</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            {(["appointment", "material"] as Outcome[]).map((o) => {
              const on = outcome === o;
              const col = o === "appointment" ? T.apo : T.doc;
              const soft = o === "appointment" ? T.apoSoft : T.docSoft;
              return (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  style={{
                    padding: 15,
                    borderRadius: 11,
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    border: on ? `1.5px solid ${col}` : `1px solid ${T.border}`,
                    background: on ? soft : T.card,
                    color: on ? col : T.muted,
                  }}
                >
                  {o === "appointment" ? "⭐ アポ獲得" : "📄 資料請求"}
                </button>
              );
            })}
          </div>

          {/* ペースト→解析 */}
          <div style={{ ...label }}>スプレッドシート行を貼り付け（1行でも複数行でもOK）</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                doParse();
              }
            }}
            placeholder="株式会社○○商事  03-1234-5678  東京都渋谷区…  tanaka@example.co.jp  田中部長  5/20 14時に訪問希望"
            style={{
              width: "100%",
              height: 86,
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: T.ink,
              color: "#e6e8ee",
              fontFamily: T.mono,
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 10, margin: "10px 0 18px" }}>
            <button
              onClick={doParse}
              style={{ padding: "9px 16px", background: T.accent, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
            >
              ⚡ 解析する
            </button>
            <button onClick={clearAll} style={{ padding: "9px 16px", background: T.card, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>
              クリア
            </button>
            {records.length > 1 && <span style={{ alignSelf: "center", fontSize: 13, color: T.muted }}>{records.length}件検出</span>}
          </div>

          {/* 複数件セレクタ */}
          {records.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {records.map((r, i) => (
                <button key={i} onClick={() => setIdx(i)} style={chip(i === idx)}>
                  {i + 1}: {(r.facility || "（未検出）").slice(0, 8)}
                </button>
              ))}
            </div>
          )}

          {/* 検出結果カード */}
          {rec && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>検出結果</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1f6f55", background: T.apoSoft, borderRadius: 5, padding: "2px 8px" }}>
                  ✓ {[rec.facility, rec.phone, rec.mail, rec.person].filter(Boolean).length}項目を検出
                </span>
                <Badge kind="auto" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  ["facility", "会社・施設名"],
                  ["phone", "電話"],
                  ["mail", "メール"],
                  ["person", "担当者"],
                ] as [keyof ParsedRecord, string][]).map(([f, lab]) => (
                  <div key={f}>
                    <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>{lab}</div>
                    <input value={(rec[f] as string) || ""} onChange={(e) => updateRec(f, e.target.value)} placeholder="（未検出・入力可）" style={{ ...input, padding: "7px 10px", fontSize: 13 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 区分で出し分け */}
          {rec && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: accent, marginBottom: 14 }}>
                {outcome === "appointment" ? "アポ獲得の項目" : "資料請求の項目"}
              </div>

              {outcome === "appointment" ? (
                <>
                  <div style={label}>面談日時 <Badge kind="pick" /></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {[
                      { l: "明日 14:00", g: () => tomorrowAt(14, 0) },
                      { l: "明日 10:00", g: () => tomorrowAt(10, 0) },
                      { l: "来週月 10:00", g: () => nextMondayAt(10, 0) },
                    ].map((c) => (
                      <button key={c.l} onClick={() => { setMeetingAt(c.g()); setShowDatePicker(false); }} style={chip(meetingAt === c.g())}>
                        {c.l}
                      </button>
                    ))}
                    <button onClick={() => setShowDatePicker((v) => !v)} style={chip(showDatePicker)}>📅 指定</button>
                  </div>
                  {showDatePicker && (
                    <input
                      type="datetime-local"
                      onChange={(e) => setMeetingAt(e.target.value.replace("T", " "))}
                      style={{ ...input, marginBottom: 8 }}
                    />
                  )}
                  {meetingAt && <div style={{ fontSize: 13, color: T.body, marginBottom: 16 }}>選択中: <b>{meetingAt}</b></div>}

                  <div style={label}>面談リンク <Badge kind="auto" /></div>
                  <input
                    value={meetingUrlOverride ?? project.meetingUrl}
                    onChange={(e) => setMeetingUrlOverride(e.target.value)}
                    placeholder="案件設定から自動（編集可）"
                    style={{ ...input, marginBottom: 16, fontFamily: T.mono, fontSize: 13 }}
                  />
                </>
              ) : (
                <>
                  <div style={label}>送付資料 <Badge kind="pick" /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {project.docs.length === 0 && <span style={{ fontSize: 12, color: T.faint }}>この案件に登録資料がありません（Phase 2で案件に登録）</span>}
                    {project.docs.map((d) => (
                      <label key={d} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.body, cursor: "pointer" }}>
                        <input type="checkbox" checked={selectedDocs.includes(d)} onChange={() => toggleDoc(d)} />
                        📎 {d}
                      </label>
                    ))}
                  </div>

                  <div style={label}>宛名 / 事業部 <Badge kind="auto" /></div>
                  <input
                    value={deptOverride ?? rec.dept ?? ""}
                    onChange={(e) => setDeptOverride(e.target.value)}
                    placeholder="検出値から自動補完（編集可）"
                    style={{ ...input, marginBottom: 16 }}
                  />
                </>
              )}

              {/* 次回連絡 定型文 */}
              <div style={label}>次回連絡打診 <Badge kind="pick" /></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: nextContact ? 8 : 0 }}>
                {(outcome === "appointment" ? NEXT_APPO : NEXT_DOC).map((p) => (
                  <button key={p} onClick={() => setNextContact(p)} style={chip(nextContact === p)}>
                    {p.length > 18 ? p.slice(0, 18) + "…" : p}
                  </button>
                ))}
              </div>
              {nextContact && <input value={nextContact} onChange={(e) => setNextContact(e.target.value)} style={{ ...input, marginTop: 8 }} />}

              {/* 文面パターン（状況・自動判定） */}
              <div style={{ ...label, marginTop: 16 }}>メール文面パターン（架電メモから自動判定・変更可） {rec.statusAuto && <span style={{ fontSize: 11 }}>🤖</span>}</div>
              <select value={status} onChange={(e) => setStatusManual(e.target.value as Status)} style={{ ...input, appearance: "none", cursor: "pointer" }}>
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 個人設定（折りたたみ） */}
          <div style={card}>
            <button
              onClick={() => setPersonalOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: "inherit", padding: 0 }}
            >
              <span style={{ transform: personalOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
              個人設定（名乗り・署名・報告者名）
            </button>
            {personalOpen && (
              <div style={{ marginTop: 14 }}>
                <div style={label}>報告者名（Slack報告用）</div>
                <input value={reporter} onChange={(e) => setReporter(e.target.value)} style={{ ...input, marginBottom: 14 }} />
                <div style={label}>名乗り（メール冒頭）</div>
                <input value={sig.intro} onChange={(e) => setSig({ ...sig, intro: e.target.value })} placeholder="株式会社○○の△△と申します。" style={{ ...input, marginBottom: 14 }} />
                <div style={label}>署名</div>
                <textarea value={sig.block} onChange={(e) => setSig({ ...sig, block: e.target.value })} style={{ ...input, height: 76, resize: "vertical" }} />
              </div>
            )}
          </div>
        </div>

        {/* ===== 右：プレビュー ===== */}
        <div style={{ padding: "22px 28px", background: T.canvas2 }}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>プレビュー（入力に合わせてリアルタイム生成）</div>

          {/* Slack */}
          <div style={{ ...card, marginBottom: 16, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, color: T.muted }}>💬 {project.channel || "#（案件未設定）"}</span>
              <button
                onClick={() => doCopy("slack", slack, "Slack報告をコピーしました（60秒以内なら取り消せます）")}
                disabled={!rec}
                style={{ padding: "6px 13px", background: rec ? T.accent : T.border, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: rec ? "pointer" : "default" }}
              >
                {copied === "slack" ? "✓ コピー済" : "📋 コピー"}
              </button>
            </div>
            <pre style={{ margin: 0, padding: 16, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: T.mono, color: rec ? T.body : T.faint }}>
              {rec ? slack : "{mentions}\n【アポ獲得報告】（{会社名}）\n担当: {報告者}\nご担当: {担当者} 様\n状況: {自動判定}\n…解析するとここに整形済みの報告文が出ます"}
            </pre>
          </div>

          {/* メール */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, color: T.muted }}>✉️ メール下書き</span>
              <button
                onClick={() => mail && doCopy("mail", "件名：" + mail.subject.trim() + "\n\n" + mail.body)}
                disabled={!rec}
                style={{ padding: "6px 13px", background: rec ? T.accent : T.border, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: rec ? "pointer" : "default" }}
              >
                {copied === "mail" ? "✓ コピー済" : "📋 本文をコピー"}
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "4px 10px", fontSize: 13, marginBottom: 12 }}>
                <span style={{ color: T.faint }}>宛先</span>
                <span style={{ color: T.body }}>{rec?.mail || "（未検出）"}</span>
                <span style={{ color: T.faint }}>CC</span>
                <span style={{ color: T.body }}>{project.cc.join(", ") || "—"}</span>
                <span style={{ color: T.faint }}>件名</span>
                <span style={{ color: T.body, fontWeight: 600 }}>{rec && mail ? mail.subject.trim() : placeholderMail.subject}</span>
              </div>
              <pre style={{ margin: 0, borderTop: `1px solid ${T.border}`, paddingTop: 12, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit", color: rec ? "#374151" : T.faint }}>
                {rec && mail ? mail.body : placeholderMail.body}
              </pre>
            </div>
          </div>

          <p style={{ fontSize: 12, color: T.muted, marginTop: 14, lineHeight: 1.7 }}>
            🔒 自動投稿はしません。コピーして本人が送信します（顧客データはこのブラウザ内のみで処理）。
          </p>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            background: T.ink,
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 8px 24px rgba(20,26,36,0.25)",
            zIndex: 50,
          }}
        >
          <span>{toast}</span>
          <button onClick={() => setToast("")} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
            取消
          </button>
        </div>
      )}
    </div>
  );
}
