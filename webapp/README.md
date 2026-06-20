# 営業報告・メールジェネレーター（社内ログイン版 webapp）

既存の単体HTML版（リポジトリ直下の `index.html` / `demo/`）はそのまま残し、こちらは
**Google ログイン必須・役割ベース**の社内Webアプリ版です。

- 解析・メール生成・Slack送信などの画面ロジックは**既存のバニラ版をそのまま流用**（`public/legacy/index.html`）。
- 変えたのは2点だけ：
  1. **会社標準テンプレートを Neon(Postgres) に集中保存**。`正社員(staff)` のみ編集でき、`インターン(intern)` は閲覧・利用のみ（サーバ側で強制）。
  2. **アクセスをGoogleログインで制限**（社内ドメインのみ）。
- 「個人カスタム」テンプレは従来どおり各自のブラウザ(localStorage)に保存。

## 構成

```
webapp/
  app/
    page.tsx                      ← ログイン確認＋ヘッダ＋iframe(/legacy/index.html)
    signin/page.tsx               ← Googleログイン画面
    api/auth/[...nextauth]/route.ts
    api/me/route.ts               ← ログイン中ユーザーの役割・任意のGAS設定
    api/templates/route.ts        ← GET=全員 / PUT=staffのみ
  auth.ts / auth.config.ts        ← Auth.js v5（Google・ドメイン制限・役割をJWTに焼込み）
  middleware.ts                   ← / と /legacy/* をログイン必須に
  lib/db.ts                       ← Neon 接続
  lib/templates.ts                ← テンプレ取得/更新
  lib/defaultTemplates.json       ← 会社標準の初期値（既存アプリから抽出）
  db/schema.sql / db/seed.mjs     ← テーブル作成＋初期投入
  public/legacy/index.html        ← 既存アプリ（SERVER_MODEでAPI連携）
  open-next.config.ts             ← Cloudflare(OpenNext)アダプタ設定
  wrangler.jsonc                  ← Cloudflare Workers 設定（nodejs_compat等）
```

**ホスティング**：Cloudflare Workers（OpenNext アダプタ `@opennextjs/cloudflare`）。無料枠で商用利用OK。
DB＝Neon、認証＝Google はホスティングに依らず共通なので、必要なら他社へも移せます。

## セットアップ手順

### 1. 必要なアカウント / 値
- **Neon**：プロジェクトを作成し「Pooled connection」文字列を取得 → `DATABASE_URL`
- **Google Cloud**：OAuth クライアントID（種別：Webアプリ）を作成
  - 承認済みリダイレクトURI：
    - `http://localhost:3000/api/auth/callback/google`
    - `https://<本番ワーカーのURL>/api/auth/callback/google`（例 `https://apo-report-webapp.<account>.workers.dev/...`。デプロイ後に確定）
  - → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- `AUTH_SECRET`：`openssl rand -base64 33` で生成

### 2. テーブル作成（Neon）
NeonのSQL Editorで `db/schema.sql` を実行（`users` と `templates` を作成）。
※ テンプレの初期投入は任意（未投入でも同梱デフォルトを表示し、staffが編集した時にDB保存される）。
ローカルで一括投入したい場合のみ：`cp .env.example .env.local && npm install && npm run db:setup`。

### 3. Cloudflare Workers へデプロイ（OpenNext）

**A. ダッシュボード連携（おすすめ・push毎に自動デプロイ）**
1. https://dash.cloudflare.com → Workers & Pages → **Create** → **Import a repository**（Workers側）→ GitHub連携 → このリポジトリを選択
2. ビルド設定：
   - **Root directory**：`webapp`
   - **Build command**：`npx opennextjs-cloudflare build`
   - **Deploy command**：`npx wrangler deploy`
3. **Variables and Secrets** に環境変数を登録（`DATABASE_URL` / `AUTH_SECRET` / `AUTH_GOOGLE_SECRET` は “Secret/暗号化” で、残りは通常変数で）：
   `AUTH_SECRET` `AUTH_GOOGLE_ID` `AUTH_GOOGLE_SECRET` `DATABASE_URL` `ALLOWED_EMAIL_DOMAINS` `ADMIN_EMAILS`（任意で `GAS_URL` `SLACK_WEBHOOKS`）
4. デプロイ → 本番URL（例 `https://apo-report-webapp.<account>.workers.dev`）を確認
5. Google OAuthの「承認済みリダイレクトURI」に `https://<本番URL>/api/auth/callback/google` を追加

**B. CLI（手元から1回で出す）**
```bash
cd webapp
npm install
npx wrangler login           # ブラウザでCloudflareにログイン
# 秘密情報を登録（対話で値を貼る）
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_SECRET
# 通常変数はダッシュボード、または wrangler.jsonc の [vars] に
npm run deploy               # opennextjs-cloudflare build && deploy
```

`nodejs_compat` と互換日付は `wrangler.jsonc` に入っているので自動適用されます。
ローカル動作確認は `npm run dev`（通常のNext）または `npm run preview`（Cloudflare相当で確認）。

## 役割（権限）の運用
- 初回ログイン時に `users` に登録され、`ADMIN_EMAILS` に含まれるメールは `staff`、それ以外は `intern`。
- 後から変更するには Neon の SQL で：
  ```sql
  update users set role = 'staff' where email = 'someone@example.co.jp';  -- 昇格
  update users set role = 'intern' where email = 'someone@example.co.jp'; -- 降格
  ```

## セキュリティ メモ
- サインインは `ALLOWED_EMAIL_DOMAINS` のドメイン＋メール検証済みのみ許可（`auth.ts`）。**必ず社内ドメインを設定**すること（空だと全Googleアカウントを通してしまう）。
- テンプレ編集は `PUT /api/templates` でサーバ側が `role==='staff'` を検証（UIで隠すだけに依存しない）。
- 顧客データは従来どおり**各自のブラウザ内のみ**（解析結果はサーバに保存しない）。外部送信はSlack(GAS)向けのみで、フィードバックは送信前に伏せ字化。
- 任意：`GAS_URL` / `SLACK_WEBHOOKS` を環境変数で設定すると、全員が各自で入力せずSlack送信を使える。

## 既存HTML版との関係
- `public/legacy/index.html` は `demo/index.html` のコピーに、`SERVER_MODE` 分岐（テンプレAPI・役割ゲート）を足したもの。
- ロジック改善はこれまで通り `demo/` で行い、固まったら `public/legacy/index.html` に反映（将来は1ファイルに寄せて `SERVER_MODE` フラグで共用するのが理想）。
