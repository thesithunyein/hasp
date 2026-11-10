import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Mark } from "@/components/mark";

export const Route = createFileRoute("/")({ component: Home });

const SITE = "https://thehasp.vercel.app";
const NAMED = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

declare global {
  interface Window {
    Hasp?: { scan: () => void; open: (cfg: { to: string; usd: string; item?: string }) => void };
  }
}

/** Loads /checkout.js once, the same file a merchant's page loads. */
function useCheckoutScript() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.Hasp) {
      setReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-hasp-loader]");
    const script = existing ?? document.createElement("script");
    const done = () => setReady(true);
    script.addEventListener("load", done);
    if (!existing) {
      script.src = "/checkout.js";
      script.async = true;
      script.setAttribute("data-hasp-loader", "");
      document.body.appendChild(script);
    }
    return () => script.removeEventListener("load", done);
  }, []);
  return ready;
}

function validAccount(value: string) {
  const s = value.trim();
  return s.length >= 2 && s.length <= 64 && (/^[0-9a-f]{64}$/.test(s) || NAMED.test(s));
}

function validPrice(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0 && Number(value) <= 10000;
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function Home() {
  const ready = useCheckoutScript();
  useEffect(() => {
    if (ready) window.Hasp?.scan();
  }, [ready]);

  return (
    <main className="glow min-h-screen text-ink">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-10 md:py-10">
        <nav className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <Mark />
            <span className="font-display text-2xl tracking-tight">Hasp</span>
          </a>
          <div className="flex items-center gap-5 text-sm text-mute">
            <a href="#how" className="hidden hover:text-ink sm:inline">How it works</a>
            <a href="#pricing" className="hidden hover:text-ink sm:inline">Pricing</a>
            <a href="#faq" className="hidden hover:text-ink md:inline">FAQ</a>
            <a href="#make" className="rounded-full bg-ink px-4 py-2 text-on-clasp hover:bg-clasp">Get a button</a>
          </div>
        </nav>

        <section className="mt-12 grid gap-10 md:mt-20 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <p className="text-xs uppercase tracking-[0.14em] text-clasp">Crypto checkout</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.02] text-balance md:text-7xl">Get paid in any coin.</h1>
            <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-mute">
              Your buyer pays with the coin they have. You get USDC in your NEAR wallet.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#make" className="rounded-full bg-ink px-6 py-3 text-on-clasp hover:bg-clasp">Get your button</a>
              <a href="#how" className="rounded-full border border-line bg-card px-6 py-3 hover:border-ink">How it works</a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
              <li className="flex items-center gap-2"><IconCheck />Free</li>
              <li className="flex items-center gap-2"><IconUser />No sign-up</li>
              <li className="flex items-center gap-2"><IconShield />We never hold your money</li>
            </ul>
          </div>
          <div className="relative md:col-span-5">
            <FlowArt />
            <div className="relative -mt-6">
              <CheckoutPreview />
            </div>
          </div>
        </section>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 border-y border-line py-5 text-sm text-mute">
          <span>Pay with</span>
          {COINS.map((c) => (
            <span key={c.t} className="flex items-center gap-2 text-ink">
              <CoinBadge {...c} size={26} />
              {c.t}
            </span>
          ))}
          <span>and 200+ more on 30+ chains</span>
        </div>

        <Section id="how" kicker="How it works" title="Three steps.">
          <ol className="grid gap-3 md:grid-cols-3">
            <Step icon={<IconCode />} n="1" title="Paste one line">Add your button to any website. No server, no account.</Step>
            <Step icon={<IconCoins />} n="2" title="Buyer picks a coin">They pay from the wallet they already use.</Step>
            <Step icon={<IconWallet />} n="3" title="You get USDC">The exact amount lands in your NEAR wallet, in about a minute.</Step>
          </ol>
        </Section>

        <Section id="make" kicker="Get a button" title="Make yours in 10 seconds.">
          <ButtonMaker ready={ready} />
        </Section>

        <Section id="features" kicker="Why Hasp" title="Everything a checkout needs.">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Feature icon={<IconCoins />} title="Any coin in">200+ coins on 30+ chains. Your buyer never has to swap first.</Feature>
            <Feature icon={<IconWallet />} title="Exact USDC out">Set $5, get 5 USDC. No price swings on your side.</Feature>
            <Feature icon={<IconShield />} title="No custody">Money goes from the buyer to you. We never hold it.</Feature>
            <Feature icon={<IconCode />} title="Works on any site">Plain HTML, WordPress, Webflow, React. One line.</Feature>
            <Feature icon={<IconRefresh />} title="Automatic refunds">If a payment fails, the buyer gets their coins back.</Feature>
            <Feature icon={<IconPulse />} title="Live status">The buyer sees each step until it says Paid.</Feature>
          </div>
        </Section>

        <Section id="pricing" kicker="Pricing" title="Free to use.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-card border border-line bg-card p-6">
              <p className="text-sm text-mute">Hasp</p>
              <p className="mt-1 font-display text-5xl">$0</p>
              <p className="mt-3 text-sm leading-relaxed text-mute">No monthly fee. No sign-up. No limits on sales.</p>
            </div>
            <div className="rounded-card border border-line bg-card p-6">
              <p className="text-sm text-mute">Network fee</p>
              <p className="mt-1 font-display text-5xl">0.25%</p>
              <p className="mt-3 text-sm leading-relaxed text-mute">Taken by NEAR Intents and already in the price the buyer sees. You get your full price.</p>
            </div>
          </div>
        </Section>

        <Section id="faq" kicker="FAQ" title="Questions.">
          <dl className="grid gap-3 md:grid-cols-2">
            <Faq q="What does it cost?">Hasp is free. NEAR Intents takes 0.25%, and that is already in the price the buyer sees.</Faq>
            <Faq q="Who holds the money?">Nobody. It goes from the buyer to you through NEAR Intents. Hasp never touches it.</Faq>
            <Faq q="What if a payment fails?">The buyer gets their coins back to their own address, automatically.</Faq>
            <Faq q="How do I know I was paid?">Check your NEAR wallet. Before you ship anything, trust your wallet, not the button.</Faq>
            <Faq q="Which coins work?">200+ coins on 30+ chains, including NEAR, ETH, SOL, BTC, USDC and USDT.</Faq>
            <Faq q="What do I need?">A NEAR account, like yourname.near. That is where your USDC goes.</Faq>
            <Faq q="Does it work on my website?">Yes. Any page that can hold one line of HTML: WordPress, Webflow, Shopify pages, or your own code.</Faq>
            <Faq q="Can I use it for many products?">Yes. Make one button per product, each with its own price.</Faq>
          </dl>
        </Section>

        <footer className="mt-16 flex flex-col gap-2 border-t border-line pt-6 text-sm text-mute md:flex-row md:justify-between">
          <p>© 2026 Hasp · Payments by NEAR Intents</p>
          <p className="flex gap-4">
            <a className="hover:text-ink" href="#make">Get a button</a>
            <a className="hover:text-ink" href="#faq">FAQ</a>
            <a className="hover:text-ink" href="https://github.com/thesithunyein/hasp">Open source</a>
          </p>
        </footer>
      </div>
    </main>
  );
}

/** A still picture of the checkout window, for the hero. Not a live button. */
function CheckoutPreview() {
  const rows = [
    { c: COINS[0], name: "NEAR", chain: "NEAR", amt: "1.41" },
    { c: { t: "USDC", bg: "#2563c9", fg: "#ffffff" }, name: "USDC", chain: "Base", amt: "5.07" },
    { c: COINS[1], name: "ETH", chain: "Arbitrum", amt: "0.0024" },
    { c: COINS[2], name: "SOL", chain: "Solana", amt: "0.061" },
  ];
  return (
    <div className="tilt rounded-card border border-line bg-card p-5" aria-hidden="true">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Pay with crypto</p>
          <p className="mt-1 font-display text-2xl">$5 · Coffee beans</p>
        </div>
        <span className="grid size-8 place-items-center rounded-full bg-paper text-mute">×</span>
      </div>
      <p className="mt-3 text-sm text-mute">Pick a coin to pay with.</p>
      <ul className="mt-3 grid gap-2">
        {rows.map((r, i) => (
          <li key={r.name + r.chain} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${i === 0 ? "border-ink" : "border-line"}`}>
            <span className="flex items-center gap-3">
              <CoinBadge {...r.c} size={28} />
              <span>
                <span className="block text-sm font-medium">{r.name}</span>
                <span className="block text-xs text-mute">on {r.chain}</span>
              </span>
            </span>
            <span className="text-sm tabular-nums text-mute">≈ {r.amt}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-full bg-ink py-3 text-center text-sm text-on-clasp">Continue</div>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-mute"><IconShield />Powered by NEAR Intents</p>
    </div>
  );
}

function ButtonMaker({ ready }: { ready: boolean }) {
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("5");
  const [item, setItem] = useState("A coffee");
  const [copied, setCopied] = useState(false);

  const account = to.trim().toLowerCase();
  const okTo = validAccount(account);
  const okUsd = validPrice(usd);
  const snippet = useMemo(
    () =>
      `<script src="${SITE}/checkout.js"\n        data-to="${escapeAttr(account || "yourname.near")}" data-usd="${escapeAttr(usd.trim() || "5")}" data-item="${escapeAttr(item.trim())}"></script>`,
    [account, usd, item],
  );
  const previewKey = `${account}|${usd}|${item}`;

  useEffect(() => {
    if (ready && okTo && okUsd) window.Hasp?.scan();
  }, [ready, okTo, okUsd, previewKey]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-12">
      <div className="grid gap-4 md:col-span-5">
        <Field label="Your NEAR account" hint="Where your USDC goes.">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="yourname.near" spellCheck={false} autoComplete="off" className="h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-ink" />
          {to && !okTo ? <span className="mt-1 block text-sm text-[#9d2c2c]">That is not a NEAR account. Try yourname.near.</span> : null}
        </Field>
        <Field label="Price (USD)" hint="You get exactly this much USDC.">
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="h-12 w-full rounded-xl border border-line bg-card px-4 tabular-nums outline-none focus:border-ink" />
          {!okUsd ? <span className="mt-1 block text-sm text-[#9d2c2c]">Use a price like 5 or 4.50.</span> : null}
        </Field>
        <Field label="What are you selling?" hint="The buyer sees this.">
          <input value={item} onChange={(e) => setItem(e.target.value)} maxLength={80} className="h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-ink" />
        </Field>
      </div>
      <div className="md:col-span-7">
        <div className="rounded-card border border-line bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-mute">Paste this into your website</p>
            <button type="button" onClick={copy} className="rounded-full bg-ink px-4 py-2 text-sm text-on-clasp">
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-paper p-4 text-[13px] leading-relaxed">{snippet}</pre>
          <p className="mt-5 text-sm text-mute">Preview</p>
          <div className="mt-2 min-h-12">
            {okTo && okUsd ? (
              <div key={previewKey} data-hasp-to={account} data-hasp-usd={usd.trim()} data-hasp-item={item.trim()} />
            ) : (
              <p className="text-sm text-mute">Type your NEAR account to see your button.</p>
            )}
          </div>
          {okTo && okUsd ? (
            <p className="mt-3 text-xs text-mute">This preview is live. Paying it sends real money to {account}.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-8 border-t border-line pt-10 md:mt-20">
      <p className="text-xs uppercase tracking-[0.14em] text-mute">{kicker}</p>
      <h2 className="mt-3 mb-6 font-display text-3xl text-balance md:text-4xl">{title}</h2>
      {children}
    </section>
  );
}

function Step({ icon, n, title, children }: { icon: ReactNode; n: string; title: string; children: ReactNode }) {
  return (
    <li className="rounded-card border border-line bg-card p-5 transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-paper text-clasp shadow-[inset_0_0_0_1px_var(--color-line)]">{icon}</span>
        <span className="font-display text-xl text-line">{n}</span>
      </div>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-mute">{children}</p>
    </li>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-ink">{label}</span>
      <span className="mt-0.5 block text-xs text-mute">{hint}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <dt className="font-medium">{q}</dt>
      <dd className="mt-1 text-pretty text-sm leading-relaxed text-mute">{children}</dd>
    </div>
  );
}

/* ---------- art and icons: inline SVG, no image files ---------- */

const COINS = [
  { t: "NEAR", bg: "#1a1714", fg: "#fbfaf6" },
  { t: "ETH", bg: "#5b6bb5", fg: "#ffffff" },
  { t: "SOL", bg: "#6c4bd6", fg: "#ffffff" },
  { t: "BTC", bg: "#e08a2c", fg: "#ffffff" },
  { t: "USDT", bg: "#2f8a74", fg: "#ffffff" },
];

function CoinBadge({ t, bg, fg, size = 28 }: { t: string; bg: string; fg: string; size?: number }) {
  const id = `g-${t}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={bg} />
      <circle cx="20" cy="20" r="19" fill={`url(#${id})`} />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={fg} strokeOpacity="0.25" />
      <text x="20" y="24" textAnchor="middle" fontSize={t.length > 3 ? 9 : 11} fontWeight="600" fill={fg} fontFamily="Outfit, system-ui, sans-serif">{t}</text>
    </svg>
  );
}

/** Coins from different chains flow into one USDC coin. */
function FlowArt() {
  const starts = [
    { x: 40, y: 40 },
    { x: 24, y: 104 },
    { x: 40, y: 168 },
    { x: 96, y: 22 },
    { x: 96, y: 186 },
  ];
  return (
    <svg viewBox="0 0 400 210" className="w-full" role="img" aria-label="Coins from many chains turn into USDC">
      <defs>
        <linearGradient id="usdc-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8fe0" />
          <stop offset="1" stopColor="#2563c9" />
        </linearGradient>
        <radialGradient id="usdc-shine" cx="35%" cy="28%" r="70%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#1a1714" floodOpacity="0.18" />
        </filter>
      </defs>
      {starts.map((p, i) => (
        <path key={i} className="flow-line" d={`M${p.x + 18} ${p.y} C ${200} ${p.y}, ${210} 104, ${300} 104`} fill="none" stroke="#9a5b32" strokeOpacity="0.35" strokeWidth="1.5" />
      ))}
      {COINS.map((c, i) => (
        <g key={c.t} className="coin-float" filter="url(#soft)">
          <g transform={`translate(${starts[i].x - 18} ${starts[i].y - 18}) scale(0.9)`}>
            <CoinBadge {...c} size={40} />
          </g>
        </g>
      ))}
      <circle className="pulse-ring" cx="330" cy="104" r="34" fill="none" stroke="#2563c9" strokeWidth="2" />
      <g filter="url(#soft)">
        <circle cx="330" cy="104" r="34" fill="url(#usdc-face)" />
        <circle cx="330" cy="104" r="34" fill="url(#usdc-shine)" />
        <circle cx="330" cy="104" r="27" fill="none" stroke="#ffffff" strokeOpacity="0.4" />
        <text x="330" y="110" textAnchor="middle" fontSize="15" fontWeight="600" fill="#ffffff" fontFamily="Outfit, system-ui, sans-serif">USDC</text>
      </g>
      <text x="330" y="160" textAnchor="middle" fontSize="11" fill="#6e675f" fontFamily="Outfit, system-ui, sans-serif">in your NEAR wallet</text>
    </svg>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function IconCode() {
  return <Icon><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m13.5 5-3 14" /></Icon>;
}
function IconCoins() {
  return <Icon><ellipse cx="9" cy="7" rx="5" ry="2.5" /><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" /><path d="M10 15.4c.9 1.2 2.9 2.1 5 2.1 2.8 0 5-1.1 5-2.5v-4c0-1.2-1.6-2.2-3.8-2.4" /><path d="M20 15v3.5c0 1.4-2.2 2.5-5 2.5-2.1 0-3.9-.6-4.6-1.5" /></Icon>;
}
function IconWallet() {
  return <Icon><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a1 1 0 0 1 1 1v2" /><rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M16 13.5h.01" /><path d="M20 11h-3.5a2.5 2.5 0 0 0 0 5H20" /></Icon>;
}
function IconCheck() {
  return <span className="text-clasp"><Icon><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.3 2.3 4.7-4.9" /></Icon></span>;
}
function IconUser() {
  return <span className="text-clasp"><Icon><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.9-3.4 3.7-5.5 7-5.5s6.1 2.1 7 5.5" /></Icon></span>;
}
function IconShield() {
  return <span className="text-clasp"><Icon><path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2z" /><path d="m9 12 2.2 2.2L15.5 10" /></Icon></span>;
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-card p-5">
      <span className="grid size-10 place-items-center rounded-2xl bg-paper text-clasp shadow-[inset_0_0_0_1px_var(--color-line)]">{icon}</span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-mute">{children}</p>
    </div>
  );
}
function IconRefresh() {
  return <Icon><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" /></Icon>;
}
function IconPulse() {
  return <Icon><path d="M3 12h4l2.5-6 5 12 2.5-6H21" /></Icon>;
}
