-- ============================================================
-- Phase 2 マイグレーション：案件（プロジェクト）管理
-- Neon の SQL Editor で1回実行してください（再実行しても安全＝IF NOT EXISTS）。
-- ※ エンド顧客データは保存しません。ここに入るのは「設定」だけです。
-- ============================================================

-- 既存（無ければ作成）。ログインユーザーと役割。
create table if not exists users (
  email      text primary key,
  name       text not null default '',
  role       text not null default 'intern' check (role in ('staff', 'intern')),
  created_at timestamptz not null default now()
);

-- 案件（プロジェクト）本体
create table if not exists projects (
  id            text primary key,                 -- アプリ側で生成（uuid）
  name          text not null,
  description   text not null default '',
  slack_channel text not null default '',
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 案件メンバー（表示・担当者候補）。役割(staff/intern)は users 側で管理。
create table if not exists project_members (
  project_id text not null references projects(id) on delete cascade,
  user_email text not null,
  primary key (project_id, user_email)
);

-- 案件固定CC（社内＋依頼主/発注元。エンド顧客は入れない）
create table if not exists project_cc (
  project_id text not null references projects(id) on delete cascade,
  email      text not null,
  primary key (project_id, email)
);

-- Slack メンション対象（@表記など）
create table if not exists project_mentions (
  project_id text not null references projects(id) on delete cascade,
  mention    text not null,
  primary key (project_id, mention)
);

-- 案件単位のテンプレート（会社標準）。staff のみ編集（APIで強制）。
create table if not exists project_templates (
  project_id text not null references projects(id) on delete cascade,
  kind       text not null check (kind in ('slack', 'email_material', 'email_appo')),
  subject    text not null default '',
  body       text not null default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (project_id, kind)
);

-- 件数集計（非PII＝会社名等は持たない）。案件一覧の「今月件数」用。
create table if not exists report_stats (
  project_id text not null references projects(id) on delete cascade,
  day        date not null,
  outcome    text not null check (outcome in ('appointment', 'material')),
  count      integer not null default 0,
  primary key (project_id, day, outcome)
);

-- 動作確認用のサンプル案件（任意・不要なら消してOK）
insert into projects (id, name, description, slack_channel)
values ('sample', 'サンプル案件（AD研修）', '動作確認用', '#sales-sample')
on conflict (id) do nothing;
