# Realtime Chart — 実装ガイド

Trade ページの全幅チャートパネル（Issue #153）の設計・実装・本番対応手順をまとめたドキュメント。

---

## 概要

TradeBox の上に配置された全幅パネルで、以下の 3 タブをリアルタイムで表示する。

| タブ | 内容 | チャート種別 |
|---|---|---|
| Price | ローソク足（OHLCV）| Candlestick |
| OI | Long / Short Open Interest | Line × 2 |
| Funding Rate | 年率 Funding Rate (%) | Line |

---

## データフロー

```
Vault コントラクト
    │
    ├─ queryFilter (過去ログ)         ← useTradeHistory.ts
    │      IncreasePosition
    │      DecreasePosition
    │      CumulativeFundingUpdated
    │
    └─ WebSocket イベント購読 (リアルタイム)  ← useVaultEvents.ts
           IncreasePosition
           DecreasePosition
           LiquidatePosition
           CumulativeFundingUpdated
                │
                ▼
        ChartPanel.tsx
        ├── allTrades = [...historicalTrades, ...realtimeTrades]
        └── allFunding = [...historicalFunding, ...realtimeFunding]
                │
                ▼
        candleUtils.ts (純粋関数で集計)
        ├── buildCandles()       → CandlestickData[]
        ├── buildOIData()        → { longOI, shortOI }: LineData[]
        └── buildFundingRateData() → LineData[]
                │
                ▼
        lightweight-charts v5 で描画
        PriceChart / OIChart / FundingRateChart
```

---

## ファイル構成

```
src/
├── domain/vantage/chart/
│   ├── types.ts            — TimeFrame / TradeEvent / FundingRateEvent 型定義
│   ├── candleUtils.ts      — 集計ロジック (純粋関数)
│   ├── useTradeHistory.ts  — 過去データ一括取得 (queryFilter)
│   └── useVaultEvents.ts   — リアルタイム WebSocket 購読
│
└── pages/Trade/components/
    ├── ChartPanel.tsx       — タブ管理 + WebSocket 接続の共有
    ├── PriceChart.tsx       — ローソク足チャート
    ├── OIChart.tsx          — Long / Short OI チャート
    └── FundingRateChart.tsx — Funding Rate チャート
```

---

## 現在の対応ネットワーク

| ネットワーク | 過去データ | リアルタイム |
|---|---|---|
| localhost (31337) | queryFilter (RPC) | WebSocket (ws://localhost:8545) |
| その他 | **未対応（空配列）** | **未対応（接続しない）** |

---

## 本番化手順（Option A: WebSocket RPC）

### 1. WebSocket エンドポイントを環境変数で設定する

`useVaultEvents.ts` の `getWsUrl` 関数に TODO コメントが書いてある箇所がそのまま拡張ポイント。

```ts
// src/domain/vantage/chart/useVaultEvents.ts
function getWsUrl(chainId: number): string | null {
  if (chainId === LOCALHOST_CHAIN_ID) return "ws://localhost:8545";

  // ↓ この行のコメントアウトを外す
  return import.meta.env[`VITE_WS_URL_${chainId}`] ?? null;
}
```

### 2. `.env` ファイルに WSS URL を追加する

Alchemy / Infura / QuickNode など WebSocket 対応の RPC プロバイダーの URL を設定する。

```env
# Base Sepolia (chainId 84532)
VITE_WS_URL_84532=wss://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Base Mainnet (chainId 8453)
VITE_WS_URL_8453=wss://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### 3. 過去データの取得元を追加する（useTradeHistory.ts）

現在 localhost 以外では空配列を返す。本番では下記いずれかを追加する。

**Option A-1: 同じ RPC の `queryFilter` を使う**

ブロック数が多いとタイムアウトするため、直近 N ブロック（例: 直近 7 日分）に絞る。

```ts
// useTradeHistory.ts の fetchLocalhost を汎用化した例
const HISTORY_BLOCK_RANGE = 50_400; // ≈ 7 days on Base (2s block)

const latestBlock = await provider.getBlockNumber();
const fromBlock = Math.max(0, latestBlock - HISTORY_BLOCK_RANGE);
vault.queryFilter(filter, fromBlock, "latest");
```

**Option A-2: The Graph (Subgraph) から GraphQL クエリで取得する**

リアルタイム部分は引き続き WebSocket RPC を使い、過去データのみ Subgraph に移行する構成。
`useTradeHistory.ts` の `else` ブロック（現在空配列を返している箇所）に GraphQL クライアントのコードを追加する。

---

## 実装の注意点

### lightweight-charts v5 の API 変更

v4 以前と v5 では API が破壊的に変更されている。

```ts
// v4 以前（廃止）
chart.addCandlestickSeries({ ... });
chart.addLineSeries({ ... });

// v5 以降（現在の実装）
import { CandlestickSeries, LineSeries } from "lightweight-charts";
chart.addSeries(CandlestickSeries, { ... });
chart.addSeries(LineSeries, { ... });
```

### WebSocket 自動再接続

`useVaultEvents.ts` は接続断 (`close` イベント) を検知して 3 秒後に自動再接続する。
`cancelled` フラグでコンポーネントアンマウント後の再接続を防いでいる。

```ts
underlyingWs.addEventListener("close", () => {
  if (!cancelled) reconnectTimer = setTimeout(connect, 3_000);
});
```

### WebSocket 接続の共有

WebSocket は `ChartPanel` が 1 本だけ保持し、3 つのチャートコンポーネントに props 経由でデータを渡す。
タブを切り替えても接続は維持されるため、バックグラウンドでデータが蓄積され続ける。

### OI / Funding Rate のタイムスタンプ重複回避

`lightweight-charts` は同一タイムスタンプを持つ 2 点を受け取るとエラーになる。
`buildOIData` / `buildFundingRateData` では `seen: Set<number>` でインクリメントして回避している。

### `callbacksRef` パターン

`useVaultEvents` は WebSocket コールバックを `useRef` で保持する。
これにより `useEffect` を再実行せずに最新のコールバック関数を参照できる（stale closure 防止）。

```ts
const callbacksRef = useRef(callbacks);
callbacksRef.current = callbacks; // 毎レンダーで最新に更新
```

### ethers v6 の filter 引数

ethers v6 では `queryFilter` / `vault.on` のフィルター引数に `null` は使えない。
ワイルドカードには `undefined` を使う。

```ts
// NG（v5 スタイル）
vault.filters.IncreasePosition(null, null, null, indexToken)

// OK（v6）
vault.filters.IncreasePosition(undefined, undefined, undefined, indexToken)
```

---

## WAD 精度について

Vault コントラクトの USD 値はすべて 1e18 スケール（WAD）。
フロント側では `formatEther(bigint)` で `float` に変換してチャートに渡す。

| 変数 | 精度 |
|---|---|
| `price` | 1e18 WAD → `formatEther` → float |
| `sizeDelta` | 1e18 WAD → `formatEther` → float |
| `annualRateBps` | bps (整数) → `/100` → % |

---

## 関連 Issue / PR

- Issue #153: リアルタイムチャート実装
- PR #21: feat(trade): リアルタイムチャート実装 — ローソク足 / OI / Funding Rate
