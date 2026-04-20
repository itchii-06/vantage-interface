import type { LocaleData } from "./en";

export const ja: LocaleData = {
  nav: {
    hedge: "ヘッジ",
    trade: "トレード",
    docs: "ドキュメント",
    launchApp: "アプリを開く",
  },
  hero: {
    badge: "Perp Hedge DEX",
    headline: "金利上昇リスクをなくす",
    subtext:
      "利回り生成トークンの力でリターンを守る。B Cellarは世界初のPerpHedgeDEXとして、あなたの収益とポートフォリオを保護します。",
    ctaPrimary: "アプリを起動 ↗",
    ctaSecondary: "ドキュメント",
    stats: {
      tvl: "Total Value Locked",
      activeVaults: "アクティブVault",
      positionsProtected: "保護済みポジション",
    },
  },
  vaults: {
    heading: "戦略を選ぶ",
    sub: "各Vaultはパープヘッジで自動的にヘッジされています。",
    metrics: {
      vaultApy: "Vault APY",
      fundingRate: "調達金利",
      netApy: "実質APY",
    },
    capacity: "容量",
    filled: "% 使用中",
    cta: "Zap & 入金 →",
    vaultTypes: ["マネーマーケット RWA", "利回りステーブルコイン", "分散型 RWA バスケット"] as [string, string, string],
  },
  howItWorks: {
    label: "B Cellarとは",
    heading: "他とは違う設計",
    sub: "B Cellarを最も資本効率の高いヘッジプロトコルにする6つの構造的優位性。",
    steps: [
      {
        title: "最小の資本で最大のリスク管理",
        description: "10倍レバレッジで、わずかな資本を使って最大の金利ヘッジを展開。小さなポジション、大きな防御力。",
      },
      {
        title: "調達金利から解放される",
        description: "利回りトークンの収益がショートのFR支払いを相殺。ほぼゼロのコストでヘッジを永続的に維持できます。",
      },
      {
        title: "ヘッジしながら稼ぐ",
        description:
          "バックエンドの資産はショート中も利回りを生成し続ける。攻撃と防御を同時に実現するデュアル利回り構造。",
      },
      {
        title: "LP 2.0：損しない流動性",
        description:
          "強気市場でも収益を維持する次世代LPモデル。デルタニュートラル設計があらゆる市場環境でLPリターンを保護。",
      },
      {
        title: "マージンを働かせる",
        description:
          "担保として預けた利回りトークンはポジションを支えながら利回りを生成し続ける。何も無駄にしない究極の資本効率。",
      },
      {
        title: "金利先物を取引する",
        description:
          "将来の調達金利をロングまたはショート。今日の期待利回りを確定させるか、レートの動向を投機する — 初のオンチェーンIR先物市場。",
      },
    ],
    trustLabels: ["ノンカストディアル", "自動リバランス", "オンチェーン透明性", "24/7 保護"] as [
      string,
      string,
      string,
      string,
    ],
    merge: {
      label: "仕組み",
      heading: "利回りトークンAPY + ショート調達 → 完全保護 & 調達収益",
      yieldTokenLabel: "利回りトークン APY",
      shortLabel: "ショート調達",
      shieldLabel: "保護 & FR 収益",
    },
  },
  faq: {
    heading: "よくある質問",
    items: [
      {
        question: "デルタニュートラルヘッジとは？",
        answer:
          "資産の価格変動を相殺し、金利リスクなど特定のリスクのヘッジや収益獲得に集中できる戦略です。資産と逆方向に動くポジション（例：トークンを保有しながら同量のショートを建てる）を持つことで、正味の「デルタ」がゼロになります。これにより市場の価格変動の影響を受けず、B Cellarが調達金利コストの無力化に専念できます。",
      },
      {
        question: "ヘッジはどのように行うのですか？",
        answer:
          "シンプルでシームレスです。利回り生成トークンを担保として預け、「ヘッジモード」を選択するだけ。最大10倍のレバレッジで、わずかな資本で大きな価値を保護できます。B Cellarのエンジンが自動的に利回りプールの収益を調達金利の相殺に活用し、ポートフォリオを「設定してあとは任せる」シールドで守ります。",
      },
      {
        question: "ヘッジはいつでも解除できますか？",
        answer:
          "もちろんです。資産がロックされることは一切ありません。ヘッジの解除、レバレッジの調整、担保の引き出しはいつでも自由に行えます。B CellarはDeFiの原則に基づいて構築されており、書類手続きや待機期間なしに24時間365日完全な流動性とアクセスを提供します。",
      },
      {
        question: "調達金利を相殺する「魔法の」利回りはどこから来るのですか？",
        answer:
          "当社の流動性プールは高品質な利回り生成資産（stETH/国債など）に裏付けられています。これらの資産からの安定した収益が、ヘッジユーザーの調達コストを賄うために振り向けられます。",
      },
      {
        question: "市場が極端に不安定になった場合はどうなりますか？",
        answer:
          "B Cellarは準備基金とジュニアVaultバッファーを含む多層防御シーケンスを採用しています。極端なブラックスワンイベント時には、低レバレッジの長期ヘッジャーの保護を優先してシステムの安定性を確保します。",
      },
      {
        question: "B CellarはGMXやHyperliquidと何が違うのですか？",
        answer:
          "他のDEXが変動コストの高い投機に特化しているのに対し、B Cellarは資産利回りを使って取引コストを無力化する、目的特化型の「金利インフラ」です。",
      },
    ],
  },
  footer: {
    copyright: "© 2026 B Cellar Finance. All rights reserved.",
    disclaimer:
      "DeFiには固有のリスクが伴います。過去の運用実績は将来の結果を保証するものではありません。これは投資アドバイスではありません。",
  },
};
