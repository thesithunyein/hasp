import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Mark } from "@/components/mark";

export const Route = createFileRoute("/")({ component: Home });

const SITE = "https://thehasp.vercel.app";
const DEMO_TO = "sithunyein.near";
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
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-10 md:py-10">
        <nav className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <Mark />
            <span className="font-display text-2xl tracking-tight">Hasp</span>
          </a>
          <div className="flex items-center gap-5 text-sm text-mute">
            <a href="#faq" className="hidden hover:text-ink sm:inline">FAQ</a>
            <a href="https://github.com/thesithunyein/hasp" className="hover:text-ink">GitHub</a>
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
              <a href="/shop.html" className="rounded-full border border-line bg-card px-6 py-3 hover:border-ink">See a demo shop</a>
            </div>
            <p className="mt-6 text-sm text-mute">Free · No sign-up · We never hold your money</p>
          </div>
          <div className="md:col-span-5">
            <DemoProduct />
          </div>
        </section>

        <p className="mt-14 border-y border-line py-4 text-center text-sm text-mute">
          Pay with NEAR · USDC · USDT · ETH · SOL · BTC · and 200+ more coins on 30+ chains
        </p>

        <Section id="how" kicker="How it works" title="Three steps.">
          <ol className="grid gap-3 md:grid-cols-3">
            <Step n="1" title="Paste one line">Add your button to any website. No server, no account.</Step>
            <Step n="2" title="Buyer picks a coin">They pay from the wallet they already use.</Step>
            <Step n="3" title="You get USDC">The exact amount lands in your NEAR wallet, in about a minute.</Step>
          </ol>
        </Section>

        <Section id="make" kicker="Get a button" title="Make yours in 10 seconds.">
          <ButtonMaker ready={ready} />
        </Section>

        <Section id="agents" kicker="For AI agents" title="Agents can pay too, with limits.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="text-pretty leading-relaxed text-mute">
              <p>An AI agent can buy at any Hasp checkout. You set the rules first:</p>
              <ul className="mt-3 grid gap-2 text-ink">
                <li>· Which shops it may pay</li>
                <li>· How much per purchase</li>
                <li>· How much per day</li>
              </ul>
              <p className="mt-3">Outside the rules, it stops before asking for a price.</p>
            </div>
            <pre className="overflow-x-auto rounded-card border border-line bg-card p-5 text-[13px] leading-relaxed text-ink">
{`$ node scripts/hasp-agent.mjs buy \
    --to sithunyein.near --usd 1

rule     sithunyein.near is on the list; $1 is within $2 per purchase and $5 left today
quote    0.2866 NEAR in, 1.0 USDC out to sithunyein.near
dry run  nothing sent (add --send to pay)`}
            </pre>
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
          </dl>
        </Section>

        <footer className="mt-16 flex flex-col gap-2 border-t border-line pt-6 text-sm text-mute md:flex-row md:justify-between">
          <p>Built at NEAR HACKATHON 2026. Payments by NEAR Intents.</p>
          <p>
            <a className="underline hover:text-ink" href="https://github.com/thesithunyein/hasp">Source on GitHub</a> · MIT
          </p>
        </footer>
      </div>
    </main>
  );
}

function DemoProduct() {
  return (
    <div className="rounded-card border border-line bg-card p-6 shadow-[0_20px_60px_-30px_rgba(26,23,20,0.35)]">
      <p className="text-xs uppercase tracking-[0.14em] text-mute">Try it for real</p>
      <p className="mt-3 font-display text-3xl">Send a $1 tip</p>
      <p className="mt-2 text-sm leading-relaxed text-mute">
        Pay with any coin you have. It goes to {DEMO_TO}, who built Hasp.
      </p>
      <div className="mt-5 min-h-12" data-hasp-to={DEMO_TO} data-hasp-usd="1" data-hasp-item="A tip for Hasp" data-hasp-label="Tip $1" />
      <p className="mt-4 text-xs text-mute">This is a real payment on NEAR mainnet.</p>
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

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="rounded-card border border-line bg-card p-5">
      <p className="font-display text-2xl text-clasp">{n}</p>
      <p className="mt-2 font-medium">{title}</p>
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
