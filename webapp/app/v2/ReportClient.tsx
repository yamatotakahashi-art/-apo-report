"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseInput,
  renderMail,
  STATUS_ORDER,
  STATUS_LABEL,
  outcomeToMailType,
  type Outcome,
  type Status,
  type ParsedRecord,
  type MailFormValues,
  type Signature,
} from "@/lib/report/engine";
import { getTemplate } from "@/lib/report/templates";

const C = {
  ink: "#1b2236",
  accent: "#5558e0",
  line: "#e6e8ec",
  soft: "#6b7280",
  bg: "#f4f5f7",
  field: "#d7dae1",
};

const FORM_KEY = "apoReport2_form";
const SIG_KEY = "apoReport2_sig";
const REP_KEY = "alphadrive_reporter_name"; // 既存版と共有

function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback(text));
  }
  return Promise.resolve(fallback(text));
}
function fallback(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function buildSlackReport(r: ParsedRecord, outcome: Outcome, status: Status, reporter: string): string {
  const heading = outcome === "material" ? "【資料請求報告】" : "【アポ獲得報告】";
  const L: string[] = [heading];
  L.push("施設・会社：" + (r.facility || "（未検出）"));
  if (r.dept) L.push("事業部：" + r.dept);
  L.push("ご担当：" + (r.person || "ご担当者様"));
  if (r.phone) L.push("電話：" + r.phone);
  if (r.address) L.push("住所：" + r.address);
  L.push("状況：" + (STATUS_LABEL[status] || status) + (r.statusAuto ? "（自動判定）" : ""));
  if (r.schedule) L.push((outcome === "material" ? "送付：" : "日程：") + r.schedule);
  if (r.mail) L.push("メール：" + r.mail);
  if (r.note) L.push("メモ：" + r.note);
  if (reporter.trim()) L.push("報告者：" + reporter.trim());
  if (r.warnings.length) L.push("⚠ 要確認：" + r.warnings.join(" / "));
  return L.join("\n");
}

export default function ReportClient() {
  const [outcome, setOutcome] = useState<Outcome>("appointment");
  const [text, setText] = useState("");
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>("visit");
  const [reporter, setReporter] = useState("");
  const [form, setForm] = useState<MailFormValues>({});
  const [sig, setSig] = useState<Signature>({ intro: "", block: "" });
  const [copied, setCopied] = useState<string>("");

  // 個人設定の読み込み（ブラウザ内のみ）
  useEffect(() => {
    try {
      const f = localStorage.getItem(FORM_KEY);
      if (f) setForm(JSON.parse(f));
      const s = localStorage.getItem(SIG_KEY);
      if (s) setSig(JSON.parse(s));
      const rp = localStorage.getItem(REP_KEY);
      if (rp) setReporter(rp);
    } catch {
      /* localStorage 不可でも動作継続 */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);
  useEffect(() => {
    try {
      localStorage.setItem(SIG_KEY, JSON.stringify(sig));
    } catch {}
  }, [sig]);
  useEffect(() => {
    try {
      localStorage.setItem(REP_KEY, reporter);
    } catch {}
  }, [reporter]);

  const mailType = outcomeToMailType(outcome);
  const rec = records[idx];

  // レコード切替・解析時、自動判定された状況を選択に反映
  useEffect(() => {
    if (rec && rec.statusAuto && rec.status) setStatus(rec.status as Status);
  }, [idx, records]); // eslint-disable-line react-hooks/exhaustive-deps

  function doParse() {
    const recs = parseInput(text, outcome);
    setRecords(recs);
    setIdx(0);
    if (recs[0] && recs[0].statusAuto && recs[0].status) setStatus(recs[0].status as Status);
  }

  function changeStatus(st: Status) {
    setStatus(st);
    setRecords((prev) => prev.map((r, j) => (j === idx ? { ...r, status: st, statusAuto: false } : r)));
  }

  const mail = useMemo(() => {
    if (!rec) return null;
    const tpl = getTemplate(mailType, status);
    return renderMail(rec, mailType, status, tpl, form, sig);
  }, [rec, mailType, status, form, sig]);

  const slack = useMemo(() => (rec ? buildSlackReport(rec, outcome, status, reporter) : ""), [rec, outcome, status, reporter]);

  async function doCopy(kind: string, value: string) {
    const ok = await copyText(value);
    setCopied(ok ? kind : "");
    setTimeout(() => setCopied(""), 1500);
  }

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, color: C.soft, margin: "0 0 6px" };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${C.field}`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    marginBottom: 14,
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, background: C.bg, minHeight: "100%" }}>
      {/* LEFT: 入力 */}
      <div style={{ padding: "24px 28px", borderRight: `1px solid ${C.line}`, background: "#fff" }}>
        <h2 style={{ margin: "0 0 18px", fontSize: 18, color: C.ink }}>新規報告</h2>

        {/* outcome */}
        <label style={labelStyle}>成果区分</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          {(["appointment", "material"] as Outcome[]).map((o) => {
            const active = outcome === o;
            return (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: active ? `1px solid ${C.accent}` : `1px solid ${C.field}`,
                  background: active ? C.accent : "#fff",
                  color: active ? "#fff" : "#374151",
                }}
              >
                {o === "appointment" ? "⭐ アポ獲得" : "📨 資料請求"}
              </button>
            );
          })}
        </div>

        {/* paste */}
        <label style={labelStyle}>スプレッドシート行を貼り付け（1件でも複数件でもOK）</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              doParse();
            }
          }}
          placeholder="株式会社○○商事  03-1234-5678  東京都渋谷区…  tanaka@example.co.jp  田中部長  …"
          style={{ ...inputStyle, height: 90, resize: "vertical", lineHeight: 1.6, marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <button
            onClick={doParse}
            style={{ padding: "10px 18px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
          >
            解析（⌘/Ctrl+Enter）
          </button>
          <button
            onClick={() => {
              setText("");
              setRecords([]);
            }}
            style={{ padding: "10px 18px", background: "#fff", color: C.soft, border: `1px solid ${C.field}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}
          >
            クリア
          </button>
          {records.length > 0 && (
            <span style={{ alignSelf: "center", fontSize: 13, color: C.soft }}>
              {records.length}件検出
            </span>
          )}
        </div>

        {/* 複数件のときの選択 */}
        {records.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {records.map((r, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  fontSize: 12,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: i === idx ? `1px solid ${C.accent}` : `1px solid ${C.field}`,
                  background: i === idx ? "#eef0fb" : "#fff",
                  color: i === idx ? C.accent : C.soft,
                }}
                title={r.facility || `件 ${i + 1}`}
              >
                {i + 1}: {(r.facility || "（未検出）").slice(0, 10)}
              </button>
            ))}
          </div>
        )}

        {/* status */}
        <label style={labelStyle}>状況区分（メール文面が切り替わります）{rec?.statusAuto ? " 🤖自動判定" : ""}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {STATUS_ORDER.map((st) => {
            const active = status === st;
            return (
              <button
                key={st}
                onClick={() => changeStatus(st)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 16,
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: active ? `1px solid ${C.accent}` : `1px solid ${C.field}`,
                  background: active ? C.accent : "#fff",
                  color: active ? "#fff" : C.soft,
                }}
              >
                {STATUS_LABEL[st]}
              </button>
            );
          })}
        </div>

        {/* mail form */}
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 14 }}>メール差し込み項目</div>
          <label style={labelStyle}>サービス名</label>
          <input style={inputStyle} value={form.serviceName || ""} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
          <label style={labelStyle}>サービスURL</label>
          <input style={inputStyle} value={form.serviceUrl || ""} onChange={(e) => setForm({ ...form, serviceUrl: e.target.value })} />
          {outcome === "appointment" ? (
            <>
              <label style={labelStyle}>日時</label>
              <input style={inputStyle} value={form.datetime || ""} onChange={(e) => setForm({ ...form, datetime: e.target.value })} placeholder="2026-07-01 14:00" />
              <label style={labelStyle}>面談内容</label>
              <input style={inputStyle} value={form.content || ""} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              <label style={labelStyle}>ミーティングURL（オンライン時）</label>
              <input style={inputStyle} value={form.link || ""} onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </>
          ) : (
            <>
              <label style={labelStyle}>送付資料（カンマ/読点区切り）</label>
              <input style={inputStyle} value={form.docs || ""} onChange={(e) => setForm({ ...form, docs: e.target.value })} placeholder="サービス概要.pdf, 料金表.pdf" />
              <label style={labelStyle}>次回連絡</label>
              <input style={inputStyle} value={form.nextstep || ""} onChange={(e) => setForm({ ...form, nextstep: e.target.value })} />
            </>
          )}
          <label style={labelStyle}>名乗り（メール冒頭）</label>
          <input style={inputStyle} value={sig.intro} onChange={(e) => setSig({ ...sig, intro: e.target.value })} placeholder="株式会社○○の△△と申します。" />
          <label style={labelStyle}>署名</label>
          <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={sig.block} onChange={(e) => setSig({ ...sig, block: e.target.value })} />
          <label style={labelStyle}>報告者名（Slack報告用）</label>
          <input style={inputStyle} value={reporter} onChange={(e) => setReporter(e.target.value)} />
        </div>
      </div>

      {/* RIGHT: プレビュー */}
      <div style={{ padding: "24px 28px" }}>
        <div style={{ fontSize: 13, color: C.soft, marginBottom: 14 }}>プレビュー（コピーして送信）</div>

        {!rec && <div style={{ color: C.soft, fontSize: 14, padding: "40px 0", textAlign: "center" }}>左に貼り付けて「解析」を押すと、ここに報告文とメールが出ます。</div>}

        {rec && (
          <>
            {/* Slack 報告 */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", marginBottom: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.line}`, fontSize: 13, color: C.soft }}>
                <span># Slack 報告文</span>
                <button onClick={() => doCopy("slack", slack)} style={{ padding: "5px 12px", background: copied === "slack" ? "#16a34a" : C.ink, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
                  {copied === "slack" ? "✓ コピー済" : "コピー"}
                </button>
              </div>
              <pre style={{ margin: 0, padding: 14, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit", color: C.ink }}>{slack}</pre>
            </div>

            {/* メール */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.line}`, fontSize: 13, color: C.soft }}>
                <span>✉️ メール下書き</span>
                <button
                  onClick={() => mail && doCopy("mail", "件名：" + mail.subject.trim() + "\n\n" + mail.body)}
                  style={{ padding: "5px 12px", background: copied === "mail" ? "#16a34a" : C.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
                >
                  {copied === "mail" ? "✓ コピー済" : "件名＋本文をコピー"}
                </button>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 13, color: C.soft, marginBottom: 4 }}>件名</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12 }}>{mail?.subject.trim()}</div>
                <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                  <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "#374151" }}>{mail?.body}</pre>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: C.soft, marginTop: 14, lineHeight: 1.6 }}>
              ※ 顧客データはこのブラウザ内だけで処理しています（サーバ・外部に送信しません）。送信は内容をコピーしてご自身のSlack/メールから行ってください。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
