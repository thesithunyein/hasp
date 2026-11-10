import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { Mark } from "@/components/mark";
import { checkRule, openDeposit, refreshClasp, type ClaspView } from "@/lib/hasp/fn";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [clasp, setClasp] = useState<ClaspView | null>(null);
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("0.02");
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [fit, setFit] = useState<{ out: string; usd: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const phase = clasp?.phase ?? "open";

  async function onCheck(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFit(null);
    setLine(null);
    try {
      const result = await checkRule({ data: { amount, account } });
      setClasp(result.clasp);
      if (result.outcome === "fits") {
        setFit({ out: result.amountOut, usd: result.amountOutUsd });
        setLine("Inside the rule. Nothing is deposited yet.");
      } else if (result.outcome === "dropped") {
        setLine(result.reason);
      } else {
        setLine(result.message);
      }
    } catch {
      setLine("Deposit failed. The quote could not be read. Nothing was deposited.");
    } finally {
      setBusy(false);
    }
  }

  async function onOpen() {
    setBusy(true);
    try {
      const result = await openDeposit({ data: { amount, account } });
      setClasp(result.clasp);
      setFit(null);
      if (result.outcome === "opened") {
        setLine("Nothing is deposited until this NEAR arrives.");
      } else if (result.outcome === "dropped") {
        setLine(result.reason);
      } else {
        setLine(result.message);
      }
    } catch {
      setLine("Deposit failed. Nothing was deposited.");
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setBusy(true);
    try {
      const view = await refreshClasp({ data: { account } });
      setClasp(view);
      setLine(view.notice);
    } catch {
      setLine("Could not read settlement. Nothing is marked deposited.");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!clasp?.depositAddress) return;
    try {
      await navigator.clipboard.writeText(clasp.depositAddress);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-10 md:grid-cols-12 md:px-10 md:py-16">
        <header className="md:col-span-6">
          <div className="flex items-center gap-4">
            <Mark />
            <p className="font-display text-2xl tracking-tight">Hasp</p>
          </div>
          <h1 className="font-display mt-10 text-5xl leading-none text-balance text-ink md:text-6xl">
            An agent spends only through this clasp.
          </h1>
          <p className="mt-6 max-w-sm text-pretty text-mute">
            Outside the rule, the quote is dropped. Nothing is deposited.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6">
            <Fact k="At most" v="0.02 NEAR" />
            <Fact k="Into" v="USDC" />
            <Fact k="Times" v="Once each" />
          </dl>
        </header>

        <section className="md:col-span-6 md:pt-6">
          <div className="rounded-card border border-line bg-card p-6 md:p-8">
            {phase === "settled" ? (
              <Settled line={line} out={clasp?.amountOut} />
            ) : phase === "awaiting" && clasp?.depositAddress ? (
              <Awaiting
                clasp={clasp}
                line={line}
                busy={busy}
                copied={copied}
                onCopy={onCopy}
                onRefresh={onRefresh}
              />
            ) : (
              <form onSubmit={onCheck} className="flex flex-col gap-5">
                <Field label="Agent" hint="One account. One clasp.">
                  <input
                    className="h-12 w-full rounded-xl border border-line bg-card px-4 text-ink outline-none focus:border-ink"
                    value={account}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="name.near"
                    onChange={(event) => {
                      setAccount(event.target.value);
                      setFit(null);
                      setClasp(null);
                      setLine(null);
                    }}
                  />
                </Field>
                <Field label="Amount" hint="NEAR, at most 0.02.">
                  <input
                    className="h-12 w-full rounded-xl border border-line bg-card px-4 text-ink tabular-nums outline-none focus:border-ink"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setFit(null);
                    }}
                  />
                </Field>
                <Field label="Pays" hint="Locked.">
                  <p className="flex h-12 items-center rounded-xl border border-line px-4 text-mute">USDC</p>
                </Field>
                {line ? <p className="text-pretty text-sm leading-relaxed text-ink">{line}</p> : null}
                {fit ? (
                  <p className="font-display text-3xl tabular-nums text-ink">
                    {fit.out || "—"} <span className="text-mute">USDC</span>
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-12 flex-1 rounded-xl bg-ink px-5 text-on-clasp disabled:opacity-50"
                  >
                    {busy ? "Reading" : "Check"}
                  </button>
                  {fit ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onOpen}
                      className="h-12 flex-1 rounded-xl bg-clasp px-5 text-on-clasp disabled:opacity-50"
                    >
                      Open deposit
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </div>
          <p className="mt-6 text-sm text-pretty text-mute">
            Settlement is NEAR Intents. Hasp holds no keys.
          </p>
        </section>
      </div>
    </main>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-sm text-mute">{k}</dt>
      <dd className="mt-1 font-display text-xl text-ink">{v}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink">{label}</span>
      <span className="mt-1 block text-sm text-mute">{hint}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Settled({ line, out }: { line: string | null; out: string | null | undefined }) {
  return (
    <div>
      <p className="font-display text-4xl text-balance">This clasp is shut.</p>
      <p className="mt-4 text-pretty text-sm leading-relaxed text-mute">
        {line ?? "Settled. Nothing further is deposited."}
      </p>
      {out ? <p className="mt-6 font-display text-3xl tabular-nums">{out} USDC</p> : null}
    </div>
  );
}

function Awaiting({
  clasp,
  line,
  busy,
  copied,
  onCopy,
  onRefresh,
}: {
  clasp: ClaspView;
  line: string | null;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onRefresh: () => void;
}) {
  return (
    <div>
      <p className="font-display text-4xl text-balance">Send the NEAR.</p>
      <p className="mt-4 text-pretty text-sm leading-relaxed text-ink">
        {line ?? "Nothing is deposited until this NEAR arrives."}
      </p>
      {clasp.accountId ? (
        <p className="mt-2 text-pretty text-sm leading-relaxed text-mute">
          Send it from {clasp.accountId}. A refund goes back to that account, not to whoever sent it.
        </p>
      ) : null}
      <p className="mt-6 font-display text-3xl tabular-nums">
        {clasp.amountIn} <span className="text-mute">NEAR</span>
      </p>
      {clasp.amountOut ? (
        <p className="mt-1 text-sm text-mute tabular-nums">Quoted {clasp.amountOut} USDC</p>
      ) : null}
      <p className="mt-6 break-all rounded-xl border border-line p-4 text-sm leading-relaxed">
        {clasp.depositAddress}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onCopy} className="h-12 flex-1 rounded-xl border border-line px-5">
          {copied ? "Copied" : "Copy address"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRefresh}
          className="h-12 flex-1 rounded-xl bg-ink px-5 text-on-clasp disabled:opacity-50"
        >
          {busy ? "Reading" : "Read status"}
        </button>
      </div>
    </div>
  );
}
