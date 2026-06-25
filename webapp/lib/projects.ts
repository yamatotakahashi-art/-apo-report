import { getSql } from "./db";

export interface Project {
  id: string;
  name: string;
  description: string;
  slack_channel: string;
  archived: boolean;
  created_at: string;
  appo?: number;
  material?: number;
}
export type TemplateKind = "slack" | "email_material" | "email_appo";
export interface ProjectDetail extends Project {
  members: string[];
  cc: string[];
  mentions: string[];
  templates: Record<TemplateKind, { subject: string; body: string }>;
}

const EMPTY_TEMPLATES = {
  slack: { subject: "", body: "" },
  email_material: { subject: "", body: "" },
  email_appo: { subject: "", body: "" },
};

// 一覧（今月の件数集計＝非PII付き）
export async function listProjects(): Promise<Project[]> {
  const sql = getSql();
  const rows = (await sql`
    select p.id, p.name, p.description, p.slack_channel, p.archived, p.created_at,
      coalesce(sum(case when s.outcome = 'appointment' then s.count end), 0) as appo,
      coalesce(sum(case when s.outcome = 'material'    then s.count end), 0) as material
    from projects p
    left join report_stats s
      on s.project_id = p.id and s.day >= date_trunc('month', now())::date
    group by p.id
    order by p.archived asc, p.created_at desc
  `) as any[];
  return rows.map((r) => ({ ...r, archived: !!r.archived, appo: Number(r.appo), material: Number(r.material) }));
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const sql = getSql();
  const prows = (await sql`select id, name, description, slack_channel, archived, created_at from projects where id = ${id}`) as any[];
  if (!prows.length) return null;
  const [members, cc, mentions, tpls] = await Promise.all([
    sql`select user_email from project_members where project_id = ${id} order by user_email` as Promise<any[]>,
    sql`select email from project_cc where project_id = ${id} order by email` as Promise<any[]>,
    sql`select mention from project_mentions where project_id = ${id} order by mention` as Promise<any[]>,
    sql`select kind, subject, body from project_templates where project_id = ${id}` as Promise<any[]>,
  ]);
  const templates = { ...EMPTY_TEMPLATES } as ProjectDetail["templates"];
  for (const t of tpls) templates[t.kind as TemplateKind] = { subject: t.subject, body: t.body };
  return {
    ...(prows[0] as Project),
    archived: !!prows[0].archived,
    members: members.map((m) => m.user_email),
    cc: cc.map((c) => c.email),
    mentions: mentions.map((m) => m.mention),
    templates,
  };
}

export async function createProject(name: string, description: string, slackChannel: string): Promise<string> {
  const sql = getSql();
  const id = crypto.randomUUID();
  await sql`insert into projects (id, name, description, slack_channel) values (${id}, ${name}, ${description}, ${slackChannel})`;
  return id;
}

export async function updateProjectBasic(
  id: string,
  d: { name: string; description: string; slack_channel: string; archived: boolean },
) {
  const sql = getSql();
  await sql`
    update projects set name = ${d.name}, description = ${d.description},
      slack_channel = ${d.slack_channel}, archived = ${d.archived}
    where id = ${id}
  `;
}

// 置き換え型（全削除→再投入）。要素は少数想定なので逐次でOK。
async function replaceList(table: "project_cc" | "project_mentions" | "project_members", col: string, id: string, values: string[]) {
  const sql = getSql();
  if (table === "project_cc") await sql`delete from project_cc where project_id = ${id}`;
  else if (table === "project_mentions") await sql`delete from project_mentions where project_id = ${id}`;
  else await sql`delete from project_members where project_id = ${id}`;
  const uniq = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  for (const v of uniq) {
    if (table === "project_cc") await sql`insert into project_cc (project_id, email) values (${id}, ${v}) on conflict do nothing`;
    else if (table === "project_mentions") await sql`insert into project_mentions (project_id, mention) values (${id}, ${v}) on conflict do nothing`;
    else await sql`insert into project_members (project_id, user_email) values (${id}, ${v.toLowerCase()}) on conflict do nothing`;
  }
}
export const setCc = (id: string, v: string[]) => replaceList("project_cc", "email", id, v);
export const setMentions = (id: string, v: string[]) => replaceList("project_mentions", "mention", id, v);
export const setMembers = (id: string, v: string[]) => replaceList("project_members", "user_email", id, v);

export async function upsertTemplate(id: string, kind: TemplateKind, subject: string, body: string, editor: string) {
  const sql = getSql();
  await sql`
    insert into project_templates (project_id, kind, subject, body, updated_by, updated_at)
    values (${id}, ${kind}, ${subject}, ${body}, ${editor}, now())
    on conflict (project_id, kind) do update
      set subject = excluded.subject, body = excluded.body, updated_by = excluded.updated_by, updated_at = now()
  `;
}
