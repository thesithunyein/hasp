import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Mark } from "@/components/mark";

export const Route = createFileRoute("/payments")({ component: Payments });

const TRANSFERS = "https://transfers.main.fastnear.com/v0/transfers";
const USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const INTENTS = "intents.near";
const NAMED = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

type Transfer = {
  transaction_id: string | null;
  receipt_id: string;
  block_timestamp: string;
  other_account_id: string;
  asset_id: string;
  amount: string;
  human_amount: number;
};

type Page = { transfers: Transfer[]; resume_token: string | null };

function validAccount(value: string) {
  const s = value.trim();
  return s.length >= 2 && s.length <= 64 && (/^[0-9a-f]{64}$/.test(s) || NAMED.test(s));
}

/** USDC paid to the account by NEAR Intents, newest first. */
async function fetchPayments(account: string, resume: string | null): Promise<Page> {
  const res = await fetch(TRANSFERS, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account_id: account, asset_id: USDC, direction: "receiver", desc: true, limit: 50, resume_token: resume }),
  });
  if (!res.ok) throw new Error(`The payments service did not answer (${res.status}). Try again in a minute.`);
  const body = (await res.json()) as Partial<Page>;
  const transfers = (body.transfers ?? []).filter((t) => t.other_account_id === INTENTS && BigInt(t.amount) > 0n);
  return { transfers, resume_token: body.resume_token ?? null };
}

function when(ns: string) {
  const date = new Date(Number(BigInt(ns) / 1_000_000n));
  return date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function usdc(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function Payments() {
  const [input, setInput] = useState("");
  const [account, setAccount] = useState("");
  const [rows, setRows] = useState<Transfer[]>([]);
  const [resume, setResume] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const load = useCallback(async (who: string, more: string | null) => {
    setState("loading");
    setError("");
    try {
      const page = await fetchPayments(who, more);
      setRows((prev) => (more ? [...prev, ...page.transfers] : page.transfers));
      setResume(page.resume_token);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("account")?.trim().toLowerCase() ?? "";
    if (fromUrl && validAccount(fromUrl)) {
      setInput(fromUrl);
      setAccount(fromUrl);
      void load(fromUrl, null);
    }
  }, [load]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const who = input.trim().toLowerCase();
    if (!validAccount(who)) {
      setError("That is not a NEAR account. Try yourname.near.");
      setState("error");
      return;
    }
    setAccount(who);
    window.history.replaceState(null, "", `/payments?account=${encodeURIComponent(who)}`);
    void load(who, null);
  }

  const total = rows.reduce((sum, t) => sum + (t.human_amount || 0), 0);
  const monthAgo = BigInt(Date.now() - 30 * 86_400_000) * 1_000_000n;
  const month = rows.filter((t) => BigInt(t.block_timestamp) >= monthAgo).reduce((sum, t) => sum + (t.human_amount || 0), 0);

  return (
    <main className="glow min-h-screen text-ink">
      <div className="mx-auto max-w-3xl px-5 py-6 md:px-10 md:py-10">
        <nav className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <Mark />
            <span className="font-display text-2xl tracking-tight">Hasp</span>
          </a>
          <a href="/#make" className="rounded-full bg-ink px-4 py-2 text-sm text-on-clasp hover:bg-clasp">Get a button</a>
        </nav>

        <p className="mt-12 text-xs uppercase tracking-[0.14em] text-clasp">Payments</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">See what you were paid.</h1>
        <p className="mt-3 text-pretty text-mute">Enter your NEAR account. Every USDC payment from NEAR Intents shows here, newest first.</p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="yourname.near"
            spellCheck={false}
            autoComplete="off"
            aria-label="Your NEAR account"
            className="h-12 flex-1 rounded-xl border border-line bg-card px-4 outline-none focus:border-ink"
          />
          <button type="submit" className="h-12 rounded-full bg-ink px-6 text-on-clasp hover:bg-clasp">
            Show payments
          </button>
        </form>
        {state === "error" ? <p className="mt-3 text-sm text-[#9d2c2c]">{error}</p> : null}

        {account && state !== "error" ? (
          <section className="mt-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Payments" value={state === "loading" && rows.length === 0 ? "…" : String(rows.length) + (resume ? "+" : "")} />
              <Stat label="Last 30 days" value={state === "loading" && rows.length === 0 ? "…" : `${usdc(month)} USDC`} />
              <Stat label="All shown" value={state === "loading" && rows.length === 0 ? "…" : `${usdc(total)} USDC`} />
            </div>

            <div className="mt-6 overflow-hidden rounded-card border border-line bg-card">
              {rows.length === 0 && state === "done" ? (
                <div className="p-8 text-center">
                  <p className="font-medium">No payments yet.</p>
                  <p className="mt-1 text-sm text-mute">
                    When a buyer pays your button, the USDC shows here within a minute. <a href="/#make" className="underline">Get your button</a>.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map((t) => (
                    <li key={t.receipt_id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div>
                        <p className="font-medium tabular-nums">+{usdc(t.human_amount)} USDC</p>
                        <p className="mt-0.5 text-sm text-mute">{when(t.block_timestamp)} · from NEAR Intents</p>
                      </div>
                      {t.transaction_id ? (
                        <a href={`https://nearblocks.io/txns/${t.transaction_id}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-clasp underline">
                          Receipt
                        </a>
                      ) : null}
                    </li>
                  ))}
                  {state === "loading" ? <li className="px-5 py-4 text-sm text-mute">Loading…</li> : null}
                </ul>
              )}
            </div>

            {resume && state === "done" ? (
              <button type="button" onClick={() => void load(account, resume)} className="mt-4 rounded-full border border-line bg-card px-5 py-2.5 text-sm hover:border-ink">
                Show older payments
              </button>
            ) : null}

            <p className="mt-6 text-xs leading-relaxed text-mute">
              This list shows every USDC payment that NEAR Intents sent to {account}, including ones that did not come from a Hasp button. Data from FastNEAR.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-card px-5 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}
