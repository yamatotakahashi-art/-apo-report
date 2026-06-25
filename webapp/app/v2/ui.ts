// 新版UIの共通トークン・ヘルパ（モックアップ §3 のデザインシステム準拠）。クライアント安全（DOM参照はcopyTextのみ）。

export const T = {
  ink: "#141a24",
  body: "#1d2330",
  muted: "#687284",
  faint: "#9aa3b2",
  border: "#e4e7ec",
  canvas: "#f7f8fa",
  canvas2: "#eceff3",
  card: "#ffffff",
  accent: "#3a5bd0",
  accentSoft: "#eef2fc",
  apo: "#2f9e6f",
  apoSoft: "#eaf6f0",
  doc: "#c98a2b",
  docSoft: "#fbf2e3",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text: string): boolean {
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
