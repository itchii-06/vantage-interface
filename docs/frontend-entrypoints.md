# Frontend Entrypoints

`vantage-interface` リポジトリには2つの独立したViteアプリが同居している。
ランディングページとDeFiアプリ本体を分離することで、それぞれの要件に最適化したビルド・デプロイが可能。

## 2つのエントリーポイント

| コマンド | Vite設定 | ソースルート | 用途 | 想定デプロイ先 |
|---|---|---|---|---|
| `pnpm start-home` | `vite.landing.config.ts` | `landing/` | ランディングページ（LP） | `vantage.finance` |
| `pnpm start` / `pnpm start-app` | `vite.config.ts` | `src/` | DeFiアプリ本体 | `app.vantage.finance` |

## なぜ分離しているか

- **ランディングページ** はSEOと初回表示速度が重要 → ethers.js等の重いDeFiライブラリを含まない軽量バンドル
- **アプリ本体** はウォレット接続・オンチェーン操作が中心 → バンドルサイズより機能優先
- 本番では別ドメイン or サブドメインにデプロイし、LP → CTA → アプリの導線を構成する想定

## ローカル開発

```bash
# ランディングページのみ起動（port 3010）
pnpm start-home

# アプリ本体を起動（port 3010）
pnpm start

# アプリ本体を別ポートで起動（port 3011）
pnpm start-app
```

> **注意:** `start-home` と `start` はどちらもデフォルトで port 3010 を使用するため、同時起動はできない。
> 両方確認したい場合は `start-home`（3010）+ `start-app`（3011）を使う。

## ビルド

```bash
# ランディングページをビルド
pnpm build-home

# アプリ本体をビルド
pnpm build-app
```

## 関連ファイル

- [`vite.landing.config.ts`](../vite.landing.config.ts) — ランディング用Vite設定
- [`landing/`](../landing/) — ランディングページのソース
- [`src/`](../src/) — アプリ本体のソース
- [`package.json`](../package.json) — 全スクリプト定義
