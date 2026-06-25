// 会社標準メールテンプレートの既定値（既存アプリから抽出した defaultTemplates.json を型付けして提供）。
// 将来は案件単位のテンプレ（Neon 保存・staff 編集）で上書きする想定。Phase 1 は既定値のみ。
import defaults from "@/lib/defaultTemplates.json";
import type { MailType, Status, MailTemplate } from "@/lib/report/engine";

type TemplateMap = Record<MailType, Record<Status, MailTemplate>>;

export const DEFAULT_TEMPLATES = defaults as unknown as TemplateMap;

export function getTemplate(mailType: MailType, status: Status): MailTemplate {
  const byType = DEFAULT_TEMPLATES[mailType] || DEFAULT_TEMPLATES.meeting;
  return byType[status] || byType.other;
}
