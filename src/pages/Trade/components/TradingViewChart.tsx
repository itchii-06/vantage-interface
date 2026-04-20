/**
 * TradingViewChart.tsx
 *
 * Embeds a TradingView chart via the widgetembed iframe URL.
 * No external script needed — works on localhost and any origin.
 */

const CHART_HEIGHT = 500;
const IFRAME_STYLE = { height: CHART_HEIGHT, border: "none", display: "block" } as const;

type Props = {
  /** TradingView symbol, e.g. "BINANCE:BTCUSDT" */
  symbol: string;
};

export function TradingViewChart({ symbol }: Props) {
  return (
    <iframe
      key={symbol}
      src={buildSrc(symbol)}
      className="w-full"
      style={IFRAME_STYLE}
      allow="fullscreen"
      title="TradingView Chart"
    />
  );
}

function buildSrc(symbol: string): string {
  const params = new URLSearchParams({
    symbol,
    interval: "240",
    theme: "dark",
    style: "1",
    locale: "en",
    timezone: "Etc/UTC",
    toolbar_bg: "#0C0C0C",
    allow_symbol_change: "1",
    save_image: "1",
    withdateranges: "1",
    hide_volume: "0",
  });
  return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
}
