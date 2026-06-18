// スキーマ作成 + 会社標準テンプレートの初期投入。
// 実行: npm run db:setup   （.env.local の DATABASE_URL を使用）
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が未設定です（.env.local）。");
  process.exit(1);
}
const sql = neon(url);
const defaults = JSON.parse(
  readFileSync(new URL("../lib/defaultTemplates.json", import.meta.url), "utf8")
);

// --- スキーマ ---
await sql`
  create table if not exists users (
    email text primary key,
    name text not null default '',
    role text not null default 'intern' check (role in ('staff','intern')),
    created_at timestamptz not null default now()
  )`;
await sql`
  create table if not exists templates (
    mail_type text not null check (mail_type in ('meeting','doc')),
    status text not null,
    subject text not null default '',
    body text not null default '',
    updated_by text,
    updated_at timestamptz not null default now(),
    primary key (mail_type, status)
  )`;

// --- 初期テンプレ（既にあれば上書きしない） ---
let n = 0;
for (const mk of Object.keys(defaults)) {
  for (const st of Object.keys(defaults[mk])) {
    const t = defaults[mk][st];
    await sql`
      insert into templates (mail_type, status, subject, body, updated_by)
      values (${mk}, ${st}, ${t.subject}, ${t.body}, 'seed')
      on conflict (mail_type, status) do nothing`;
    n++;
  }
}

// --- 初期staff（ADMIN_EMAILS があれば登録） ---
const admins = (process.env.ADMIN_EMAILS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
for (const email of admins) {
  await sql`
    insert into users (email, name, role)
    values (${email}, '', 'staff')
    on conflict (email) do update set role = 'staff'`;
}

console.log(`done: templates upserted=${n}, admins=${admins.length}`);
