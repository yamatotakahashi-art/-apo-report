import { sql } from "./db";
import defaults from "./defaultTemplates.json";

export type MailType = "meeting" | "doc";
export type TemplateMap = Record<string, Record<string, { subject: string; body: string }>>;

const DEFAULTS = defaults as TemplateMap;

// DBの内容を { meeting:{visit:{subject,body},...}, doc:{...} } 形に整形。
// DBに無いステータスは同梱デフォルトで補完するので、常に全件そろう。
export async function getAllTemplates(): Promise<TemplateMap> {
  const out: TemplateMap = {};
  try {
    const rows = (await sql`
      select mail_type, status, subject, body from templates
    `) as { mail_type: string; status: string; subject: string; body: string }[];
    for (const r of rows) {
      (out[r.mail_type] ||= {})[r.status] = { subject: r.subject, body: r.body };
    }
  } catch (e) {
    console.error("[templates] select failed, falling back to bundled defaults:", e);
  }
  for (const mk of Object.keys(DEFAULTS)) {
    out[mk] ||= {};
    for (const st of Object.keys(DEFAULTS[mk])) {
      out[mk][st] ||= { subject: DEFAULTS[mk][st].subject, body: DEFAULTS[mk][st].body };
    }
  }
  return out;
}

export async function upsertTemplate(
  mailType: string,
  status: string,
  subject: string,
  body: string,
  editor: string
) {
  await sql`
    insert into templates (mail_type, status, subject, body, updated_by, updated_at)
    values (${mailType}, ${status}, ${subject}, ${body}, ${editor}, now())
    on conflict (mail_type, status) do update
      set subject = excluded.subject,
          body = excluded.body,
          updated_by = excluded.updated_by,
          updated_at = now()
  `;
}

// 会社標準を同梱デフォルトに戻す（編集者操作）
export async function resetTemplate(mailType: string, status: string, editor: string) {
  const d = DEFAULTS[mailType]?.[status];
  if (!d) return;
  await upsertTemplate(mailType, status, d.subject, d.body, editor);
}
