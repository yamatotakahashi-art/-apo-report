-- ============================================================
-- Phase 2-A マイグレーション：案件に「報告画面が自動で使う」項目を追加
-- Neon の SQL Editor で1回実行（再実行しても安全）。顧客データは保存しません。
-- ============================================================

-- 案件に：サービス名／サービスURL／面談リンク（報告画面の差し込み・自動入力用）
alter table projects add column if not exists service_name text not null default '';
alter table projects add column if not exists service_url  text not null default '';
alter table projects add column if not exists meeting_url  text not null default '';

-- 案件ごとの送付資料リスト（資料請求の報告でチェック選択する候補）
create table if not exists project_docs (
  project_id text not null references projects(id) on delete cascade,
  name       text not null,
  primary key (project_id, name)
);
