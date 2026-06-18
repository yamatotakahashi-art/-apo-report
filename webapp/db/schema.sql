-- ユーザー（ログインしたGoogleアカウント）と役割
create table if not exists users (
  email      text primary key,
  name       text not null default '',
  role       text not null default 'intern' check (role in ('staff', 'intern')),
  created_at timestamptz not null default now()
);

-- 会社標準メールテンプレート（正社員=staff のみ編集可。APIで強制）
create table if not exists templates (
  mail_type  text not null check (mail_type in ('meeting', 'doc')),
  status     text not null,           -- visit / online / internal / followup / other
  subject    text not null default '',
  body       text not null default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (mail_type, status)
);

-- 役割を変えるとき（例）:
--   update users set role = 'staff' where email = 'someone@example.co.jp';
