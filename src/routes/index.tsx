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
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12">
        <nav className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mark />
            <p className="font-display text-2xl tracking-tight">Hasp</p>
          </div>
          <div className="flex items-center gap-5 text-sm text-mute">
            <a href="#make" className="hover:text-ink">Make a button</a>
            <a href="#agents" className="hidden hover:text-ink sm:inline">For agents</a>
            <a href="https://github.com/thesithunyein/hasp" className="hover:text-ink">GitHub</a>
          </div>
        </nav>

        <section className="mt-12 grid gap-10 md:mt-16 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <p className="text-xs uppercase tracking-[0.14em] text-mute">Checkout for almost any coin</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.02] text-balance md:text-6xl">
              Take payment in any coin. Get USDC on NEAR.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-mute">
              One script tag on your page. Your buyer pays from NEAR, Ethereum, Base, Arbitrum, Solana, Bitcoin and dozens of other chains.
              NEAR Intents converts it, and the exact USDC you asked for lands in your NEAR account.
            </p>
            <ul className="mt-6 grid max-w-xl gap-2 text-sm text-ink sm:grid-cols-3">
              <li className="rounded-xl border border-line bg-card px-3 py-2">No server to run</li>
              <li className="rounded-xl border border-line bg-card px-3 py-2">No sign-up</li>
              <li className="rounded-xl border border-line bg-card px-3 py-2">Hasp never holds funds</li>
            </ul>
          </div>
          <div className="md:col-span-5">
            <DemoProduct />
          </div>
        </section>

        <Section id="how" kicker="How it works" title="Four steps, no account anywhere.">
          <ol className="grid gap-3 md:grid-cols-4">
            <Step n="1" title="You add the tag">
              Your NEAR account and a price in dollars go in the tag. That is all Hasp needs.
            </Step>
            <Step n="2" title="The buyer picks a coin">
              From 200+ coins on 30+ chains, with a live estimate. They give an address of their own for a refund.
            </Step>
            <Step n="3" title="NEAR Intents quotes it">
              It works out the exact input for your exact USDC and opens a one-time deposit address on the buyer's chain.
            </Step>
            <Step n="4" title="USDC arrives">
              The buyer sends, Intents swaps, and the USDC lands in your NEAR account. The button shows Paid.
            </Step>
          </ol>
        </Section>

        <Section id="make" kicker="Make a button" title="Your button, ready to paste.">
          <ButtonMaker ready={ready} />
        </Section>

        <Section id="agents" kicker="For AI agents" title="An agent can pay at the same checkout, inside a rule.">
          <div className="grid gap-6 md:grid-cols-2">
            <p className="text-pretty leading-relaxed text-mute">
              <code className="rounded bg-card px-1.5 py-0.5 text-ink">scripts/hasp-agent.mjs</code> buys through the same NEAR Intents quote a person uses.
              Before it asks for a quote, it checks a rule: only merchants on its list, at most a set amount per purchase and per day. Outside the rule it stops, and nothing is quoted or sent.
              It signs with its own NEAR key, so the rule is the agent's own discipline, not a lock on the key.
            </p>
            <pre className="overflow-x-auto rounded-card border border-line bg-card p-5 text-sm leading-relaxed text-ink">
{`node scripts/hasp-agent.mjs buy \\
  --to sithunyein.near --usd 1 --item "A coffee"

rule     sithunyein.near is on the list; $1 is within $2 per purchase and $5 left today
quote    0.2866 NEAR in, 1.0 USDC out to sithunyein.near for A coffee
dry run  nothing sent (add --send to pay)`}
            </pre>
          </div>
        </Section>

        <Section id="limits" kicker="What Hasp does not do" title="Plain limits.">
          <ul className="grid gap-3 text-pretty text-sm leading-relaxed text-mute md:grid-cols-2">
            <Limit>The "Paid" message and the hasp:paid event come from the buyer's browser. Before you ship something, confirm the payment with the NEAR Intents status link or your NEAR account.</Limit>
            <Limit>Without a NEAR Intents partner key, 1Click adds a 0.25% fee, paid by the buyer as part of the quoted amount. Hasp adds no fee of its own.</Limit>
            <Limit>A buyer who sends less than the quote, or after the address goes cold, gets a refund to the address they gave, not the item.</Limit>
            <Limit>BNB Chain and Tron have high minimums on NEAR Intents, so they only appear for large prices.</Limit>
          </ul>
        </Section>

        <footer className="mt-16 border-t border-line pt-6 text-sm text-mute">
          Built at NEAR HACKATHON 2026. Settlement by the NEAR Intents 1Click API. The idea is the "universal checkout widget" from{" "}
          <a className="underline hover:text-ink" href="https://crypto.news/near-co-founder-pitches-ai-pets-private-trading/">Illia Polosukhin's list of things to build on NEAR</a>.
          {" "}Source on <a className="underline hover:text-ink" href="https://github.com/thesithunyein/hasp">GitHub</a>, MIT.
        </footer>
      </div>
    </main>
  );
}

function DemoProduct() {
  return (
    <div className="rounded-card border border-line bg-card p-6 shadow-[0_20px_60px_-30px_rgba(26,23,20,0.35)]">
      <p className="text-xs uppercase tracking-[0.14em] text-mute">A real button</p>
      <p className="mt-3 font-display text-3xl">Tip the builder</p>
      <p className="mt-2 text-sm leading-relaxed text-mute">
        $1 to <span className="text-ink">{DEMO_TO}</span>, who built Hasp. Pay with any coin you hold. Nothing is shipped; it is a tip, and a way to see the whole flow on mainnet.
      </p>
      <div className="mt-5 min-h-12" data-hasp-to={DEMO_TO} data-hasp-usd="1" data-hasp-item="A tip for Hasp" data-hasp-label="Tip $1" />
      <p className="mt-4 text-xs text-mute">
        The same button on a plain HTML page: <a className="underline hover:text-ink" href="/shop.html">the demo shop</a>.
      </p>
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
        <Field label="Your NEAR account" hint="The USDC is paid here.">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="yourname.near" spellCheck={false} autoComplete="off" className="h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-ink" />
          {to && !okTo ? <span className="mt-1 block text-sm text-[#9d2c2c]">That is not a NEAR account.</span> : null}
        </Field>
        <Field label="Price in US dollars" hint="Paid out as exactly this much USDC.">
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="h-12 w-full rounded-xl border border-line bg-card px-4 tabular-nums outline-none focus:border-ink" />
          {!okUsd ? <span className="mt-1 block text-sm text-[#9d2c2c]">Use a price like 5 or 4.50, up to 10,000.</span> : null}
        </Field>
        <Field label="What it is for" hint="Shown to the buyer.">
          <input value={item} onChange={(e) => setItem(e.target.value)} maxLength={80} className="h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-ink" />
        </Field>
      </div>
      <div className="md:col-span-7">
        <div className="rounded-card border border-line bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-mute">Paste this where the button should go</p>
            <button type="button" onClick={copy} className="rounded-full bg-ink px-4 py-2 text-sm text-on-clasp">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-paper p-4 text-[13px] leading-relaxed">{snippet}</pre>
          <p className="mt-5 text-sm text-mute">Preview</p>
          <div className="mt-2 min-h-12">
            {okTo && okUsd ? (
              <div key={previewKey} data-hasp-to={account} data-hasp-usd={usd.trim()} data-hasp-item={item.trim()} />
            ) : (
              <p className="text-sm text-mute">Enter your NEAR account to see your button.</p>
            )}
          </div>
          {okTo && okUsd ? (
            <p className="mt-3 text-xs text-mute">The preview is live: paying it sends real money to {account}.</p>
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

function Limit({ children }: { children: ReactNode }) {
  return <li className="rounded-xl border border-line bg-card px-4 py-3">{children}</li>;
}
