# 音楽教室向け 電子チケット管理システム

文書番号: RS-MTS-001 | プロジェクトID: eec56ceb-72f1-4a57-89a5-60f6e7440812

## 概要

音楽教室の生徒管理・チケット管理・レッスン実績管理・講師報酬計算を一元管理するWebシステムです。

### 主な機能

| 機能 | 内容 |
|---|---|
| チケット管理 | 月謝制・回数券制の発行、残高管理、期限アラート |
| レッスン消化 | 個人/グループレッスンのチケット消化（アトミックトランザクション） |
| 報酬計算 | 固定単価・歩合方式の自動計算、月次確定ロック |
| CSV出力 | 月次実績・発行台帳・残高一覧の3帳票 |
| 監査ログ | チケット操作・消化・マスタ変更・ログインの全記録 |
| QRコード会員証 | 生徒スマホでの会員証表示（QRコード付き） |

### ロール

| ロール | 主な機能 |
|---|---|
| 管理者 | 全機能、マスタ管理、チケット発行、月次締め、報酬管理 |
| 講師 | 担当レッスン消化、自身の報酬確認、担当生徒確認 |
| 生徒 | チケット残高確認、受講履歴、QR会員証 |

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite + Tailwind CSS |
| バックエンド | NestJS + TypeScript + Prisma ORM |
| データベース | PostgreSQL 15 |
| 接続プール | PgBouncer |
| リバースプロキシ | Nginx |
| コンテナ | Docker / Docker Compose |
| CI/CD | GitHub Actions |

---

## ディレクトリ構成

```
.
├── backend/                # NestJS API サーバー
│   ├── prisma/
│   │   ├── schema.prisma   # DBスキーマ（9エンティティ）
│   │   └── seed.ts         # 初期データ
│   └── src/
│       ├── auth/           # JWT認証
│       ├── students/       # 生徒CRUD
│       ├── instructors/    # 講師CRUD + 報酬設定
│       ├── tickets/        # チケット種別・発行・残高
│       ├── lessons/        # レッスン消化（個人/グループ）
│       ├── rewards/        # 報酬計算・月次確定
│       ├── csv/            # CSV出力（3帳票）
│       └── audit/          # 監査ログ
├── frontend/               # React SPAフロントエンド
│   └── src/
│       ├── pages/
│       │   ├── admin/      # 管理者画面（8画面）
│       │   ├── instructor/ # 講師画面（4画面）
│       │   └── student/    # 生徒画面（2画面、モバイル対応）
│       └── api/client.ts   # Axios APIクライアント
├── nginx/conf.d/           # Nginx設定（SSL・プロキシ）
├── scripts/backup.sh       # DB日次バックアップ
├── .github/workflows/      # CI/CDパイプライン
├── docker-compose.yml      # 開発環境
└── docker-compose.prod.yml # 本番環境
```

---

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
# .envを編集してDB_PASSWORDとJWT_SECRETを設定
```

### 2. 開発環境起動

```bash
# コンテナ起動
docker compose up -d

# DBマイグレーション
docker compose exec backend npx prisma migrate dev

# 初期データ投入（管理者・サンプル講師・生徒）
docker compose exec backend npx prisma db seed
```

### 3. アクセス

| URL | 説明 |
|---|---|
| http://localhost:5173 | フロントエンド |
| http://localhost:3000/api/docs | Swagger API ドキュメント |
| http://localhost:3000/health | ヘルスチェック |

### 4. デフォルトログイン情報（初期データ）

| ロール | メール | パスワード |
|---|---|---|
| 管理者 | admin@musicschool.com | Admin@123456 |
| 講師 | yamada@musicschool.com | Teacher@123 |
| 生徒 | tanaka@example.com | Student@123 |

> **本番環境では必ずパスワードを変更してください。**

---

## 本番デプロイ

```bash
# SSL証明書取得（Let's Encrypt）
certbot certonly --standalone -d yourdomain.com

# 本番起動
docker compose -f docker-compose.prod.yml up -d

# マイグレーション
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# バックアップCron設定（毎日03:00）
echo "0 3 * * * /opt/music-school/scripts/backup.sh" | crontab -
```

### 本番デプロイチェックリスト

- [ ] `NODE_ENV=production` になっているか
- [ ] `DB_PASSWORD` を強固なものに変更したか
- [ ] `JWT_SECRET` を32文字以上のランダム文字列に変更したか
- [ ] 外部からのDBポート(5432)アクセスが遮断されているか
- [ ] SSL証明書の自動更新Cronが設定されているか
- [ ] バックアップCronが正常動作するか（手動実行テスト済か）

---

## API エンドポイント一覧

Swagger UI: `GET /api/docs`

| カテゴリ | エンドポイント例 |
|---|---|
| 認証 | `POST /auth/login` |
| 生徒 | `GET/POST /students`, `GET/PATCH/DELETE /students/:id` |
| 講師 | `GET/POST /instructors`, 報酬設定 `POST /instructors/:id/reward-settings` |
| チケット種別 | `GET/POST /tickets/types`, `PATCH/DELETE /tickets/types/:id` |
| チケット発行 | `POST /tickets/issue`, `GET /tickets/student/:id/active` |
| レッスン消化 | `POST /lessons/consume`, `POST /lessons/consume/group` |
| 報酬計算 | `GET /rewards/preview/:yearMonth`, `POST /rewards/close/:yearMonth` |
| CSV出力 | `GET /csv/lessons/:yearMonth`, `GET /csv/ticket-ledger`, `GET /csv/ticket-balance` |
| 監査ログ | `GET /audit/logs` |

---

## 開発スケジュール（RFP準拠）

| フェーズ | 期間 | 内容 |
|---|---|---|
| Phase 1 詳細設計 | 2週間 | 画面詳細設計・DB設計・API設計 ✅ |
| Phase 2 コア機能実装 | 4週間 | マスタ管理・チケット発行・レッスン消化 ✅ |
| Phase 3 報酬・管理実装 | 3週間 | 報酬計算・月次締め・CSV出力 ✅ |
| Phase 4 テスト・修正 | 2週間 | 単体・結合テスト・バグ修正・スマホ実機確認 |
| Phase 5 導入準備 | 1週間 | 初期データ移行・操作マニュアル・説明会 |
