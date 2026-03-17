---
description: 計画→実装→検証→walkthrough までを一気通貫で回す標準手順
---

# 開発ループ

## 0. 作業開始前（必須）

新しいタスクを開始する際、エージェントは自ら Issue を確認し、適切な Worktree 環境を構築せよ。

### ステップ 1: タスクの取得

1. `gh issue list --state open --assignee "" --limit 10` を実行し、優先度の高い未着手タスクを確認する。
2. 作業する Issue を決定したら、`gh issue edit [番号] --add-assignee "@me"` で自分をアサインする。

### ステップ 2: Worktree の作成

Issue 番号に基づいた独立した環境を作成する。

新しいタスクを開始する前に、必ず git worktree で作業ブランチを作成する。

```bash
# 1. メインリポジトリのルートで実行する
git worktree add ../vantage-interface-{機能名} feature/{機能名}

# 2. 作成したworktreeに移動する
cd ../vantage-interface-{機能名}
```

### 依存関係について

pnpm を使用しているため、手動のシンボリックリンク（ln -s）は厳禁とする（循環参照エラーの原因となるため）。

基本戦略: Worktree へ移動後、直ちに pnpm install を実行せよ。

効率化: pnpm は Content-addressable store を使用するため、再インストールは極めて高速であり、ディスク容量もほとんど消費しない。

独立性: .next/ や dist/ は各 Worktree で独立して生成されるため、安全に並列ビルドが可能。

### 命名規則

| 対象                    | 形式                            | 例                                |
| ----------------------- | ------------------------------- | --------------------------------- |
| ブランチ名              | `feature/issue-{番号}-{機能名}` | `feature/issue-1-add-user-export` |
| worktree ディレクトリ名 | `aibow-issue-{番号}-{機能名}`   | `aibow-issue-1-add-user-export`   |

---

## 1. 入力の抽出

以下を明確にしてから進める。Issue の本文から以下を読み取り、不足があれば質問せよ。

- 目的（何を満たすか）
- 制約（互換性・性能・期限・安全）
- 完了条件（どうなったら OK か）

不足がある場合は質問をする。

---

## 2. Planning（必須）

- Implementation Plan と Task List を Artifacts で提示する
- Plan には以下を含める
  - 影響を受けるパッケージ・ファイルの一覧
  - codegen や db:generate など、実行が必要なコマンド
  - 検証手順（テスト・手動確認・スクショまたは録画）
- **Proceed の承認があるまで実装しない**
- **TDD で進める場合は Plan に以下を含める**
  - 作成するテストケースの一覧
  - テストファイルの保存先

## 2.5 テスト作成（TDD 指定時）

- 実装前にテストコードを作成し Artifacts で提示する
- **テスト内容の承認があるまで実装を開始しない**
- Vantage でのテスト実行コマンド
  - ユニットテスト: `pnpm test`
  - 特定ファイル: `pnpm test {ファイルパス}`
  - カバレッジ: `pnpm test:cov`

---

## 3. 実装

- 最小差分で進める
- 破壊的変更になり得る場合は先にリスクと回避策を提示し、承認待ちにする
- 新しいライブラリの追加が必要な場合は実装前にユーザーに確認する

---

## 4. 検証

- リポジトリ構成からテスト手段を推定し、可能なら実行する
- 失敗したら「原因 → 最小修正 → 再実行」で解消する
- 自動生成ファイル（`gql/`・`dist/`）の更新漏れがないか確認する

---

## 5. 成果物

- Review Changes（diff）で確認可能にする
- Walkthrough を Artifacts で作成する
  - 再現手順
  - 確認観点
  - 実行したコマンドとその結果
- UI 変更がある場合はスクショを添える

### 保存判断とディレクトリ振り分け

| 条件                             | 保存先                                         | ディレクトリ作成 |
| -------------------------------- | ---------------------------------------------- | ---------------- |
| アーキテクチャ・設計の意思決定   | `.agent/docs/persistent/decisions/`            | 必要             |
| 複数パッケージをまたぐ複雑な実装 | `.agent/docs/persistent/implementation-plans/` | 必要             |
| Walkthrough・調査結果            | `.agent/docs/tmp/`                             | 必要             |
| 小さな変更・バグ修正             | 保存不要                                       | 不要             |

ディレクトリが必要な場合は`{YYYY-MM-DD}-{機能名}/`の形式で作成する。

### 保存ファイル名

| ドキュメント        | ファイル名               |
| ------------------- | ------------------------ |
| Implementation Plan | `implementation-plan.md` |
| Task                | `task.md`                |
| Walkthrough         | `walkthrough.md`         |
| 調査結果            | `research.md`            |

- 古いドキュメントは削除せず残す（意思決定の履歴として活用できる）

---

## 6. 作業完了後

### PR の作成

```bash
gh pr create \
  --title "{機能名の説明}" \
  --body "$(cat <<'EOF'
## 概要
{何を・なぜ実装したか}

## 変更内容
- {変更点1}
- {変更点2}

## 影響範囲
- {影響を受けるパッケージ・ファイル}

## 完了条件の確認
- [ ] {完了条件1}
- [ ] {完了条件2}

## 動作確認
- [ ] `pnpm test`がグリーン
- [ ] `pnpm build`が成功
- [ ] UI変更がある場合はスクショを添付済み

## 関連情報
- 実装計画: `.agent/docs/persistent/implementation-plans/{YYYY-MM-DD}-{機能名}/`
EOF
)"
```

### worktree の削除

```bash
# メインリポジトリに戻る
cd ../vantage-interface

# worktreeを削除する
git worktree remove ../vantage-interface-{機能名}
```
