import { Faq } from "./Faq";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Nav } from "./Nav";
import { Ticker } from "./Ticker";
import { Vaults } from "./Vaults";

const PAGE_STYLE: React.CSSProperties = {
  background: "#07070F",
  minHeight: "100vh",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
};

export function VantageLP() {
  return (
    <div style={PAGE_STYLE}>
      <Nav />
      <Hero />
      <Ticker />
      <Vaults />
      <HowItWorks />
      <Ticker />
      <Faq />
      <Footer />
    </div>
  );
}
