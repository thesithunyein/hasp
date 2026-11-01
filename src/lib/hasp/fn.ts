import { createServerFn } from "@tanstack/react-start";
import {
  NEAR_ASSET,
  USDC_ASSET,
  fitsAmount,
  parseNearToYocto,
  validAccount,
} from "@/lib/hasp/rule";

const ONECLICK = "https://1click.chaindefuser.com";

type Phase = "open" | "awaiting" | "settled";

type Row = {
  phase: Phase;
  deposit_address: string | null;
  amount_in: string | null;
  amount_out: string | null;
  amount_out_usd: string | null;
  account_id: string | null;
  deadline: string | Date | null;
  notice: string | null;
};

export type ClaspView = {
  phase: Phase;
  depositAddress: string | null;
  amountIn: string | null;
  amountOut: string | null;
  amountOutUsd: string | null;
  accountId: string | null;
  notice: string | null;
  chainStatus: string | null;
};

type QuoteBody = {
  amountInFormatted?: string;
  amountOutFormatted?: string;
  amountOutUsd?: string;
  depositAddress?: string;
  deadline?: string;
};

type QuoteResponse = {
  quote?: QuoteBody;
  correlationId?: string;
};

function viewOf(row: Row, chainStatus: string | null = null): ClaspView {
  return {
    phase: row.phase,
    depositAddress: row.deposit_address,
    amountIn: row.amount_in,
    amountOut: row.amount_out,
    amountOutUsd: row.amount_out_usd,
    accountId: row.account_id,
    notice: row.notice,
    chainStatus,
  };
}

async function sql() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function load(): Promise<Row> {
  const db = await sql();
  const rows = await db<Row>`
    select phase, deposit_address, amount_in, amount_out, amount_out_usd,
           account_id, deadline, notice
    from hasp_clasp where id = 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Clasp is missing.");
  return row;
}

function deadlineDate(value: Row["deadline"]): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function clearToOpen(notice: string) {
  const db = await sql();
  await db`
    update hasp_clasp set
      phase = 'open',
      deposit_address = null,
      amount_in = null,
      amount_out = null,
      amount_out_usd = null,
      account_id = null,
      deadline = null,
      notice = ${notice},
      updated_at = now()
    where id = 1 and phase = 'awaiting'
  `;
}

async function markSettled() {
  const db = await sql();
  await db`
    update hasp_clasp set
      phase = 'settled',
      notice = 'Settled. The clasp is shut.',
      updated_at = now()
    where id = 1 and phase = 'awaiting'
  `;
}

async function fetchStatus(depositAddress: string): Promise<string | null> {
  const url = new URL("/v0/status", ONECLICK);
  url.searchParams.set("depositAddress", depositAddress);
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const body = (await res.json()) as { status?: string };
  return typeof body.status === "string" ? body.status : null;
}

async function sync(): Promise<ClaspView> {
  const row = await load();
  if (row.phase === "awaiting" && !row.deposit_address) {
    await clearToOpen("Deposit failed. Nothing was deposited.");
    return viewOf(await load());
  }
  if (row.phase !== "awaiting" || !row.deposit_address) return viewOf(row);

  let chainStatus: string | null = null;
  try {
    chainStatus = await fetchStatus(row.deposit_address);
  } catch {
    return viewOf(row, null);
  }

  if (chainStatus === "SUCCESS") {
    await markSettled();
    const next = await load();
    return viewOf(next, chainStatus);
  }

  if (chainStatus === "FAILED" || chainStatus === "REFUNDED") {
    await clearToOpen("Deposit failed. Nothing was kept.");
    const next = await load();
    return viewOf(next, chainStatus);
  }

  const deadline = deadlineDate(row.deadline);
  const expired = deadline !== null && deadline.getTime() < Date.now();
  const stillWaiting =
    chainStatus === null ||
    chainStatus === "PENDING_DEPOSIT" ||
    chainStatus === "INCOMPLETE_DEPOSIT";
  if (expired && stillWaiting) {
    await clearToOpen("The deposit window closed. Nothing was deposited.");
    const next = await load();
    return viewOf(next, chainStatus);
  }

  return viewOf(row, chainStatus);
}

async function requestQuote(amountYocto: string, account: string, dry: boolean) {
  const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const res = await fetch(`${ONECLICK}/v0/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      dry,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: NEAR_ASSET,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: USDC_ASSET,
      amount: amountYocto,
      recipient: account,
      recipientType: "INTENTS",
      refundTo: account,
      refundType: "ORIGIN_CHAIN",
      deadline,
    }),
  });
  if (!res.ok) {
    throw new Error(`Quote refused (${res.status}).`);
  }
  return (await res.json()) as QuoteResponse;
}

function readInput(input: unknown): { amount: string; account: string } {
  if (!input || typeof input !== "object") {
    throw new Error("Missing amount and account.");
  }
  const raw = input as { amount?: unknown; account?: unknown };
  return {
    amount: typeof raw.amount === "string" ? raw.amount : "",
    account: typeof raw.account === "string" ? raw.account.trim().toLowerCase() : "",
  };
}

export const readClasp = createServerFn({ method: "GET" }).handler(async () => {
  return sync();
});

export const checkRule = createServerFn({ method: "POST" })
  .validator(readInput)
  .handler(async ({ data }) => {
    const current = await sync();
    if (current.phase === "settled") {
      return {
        outcome: "dropped" as const,
        reason: "Already used. The clasp is shut.",
        quotedOut: null,
        quotedUsd: null,
        clasp: current,
      };
    }
    if (current.phase === "awaiting") {
      return {
        outcome: "dropped" as const,
        reason: "A deposit is already open. Nothing else is quoted.",
        quotedOut: null,
        quotedUsd: null,
        clasp: current,
      };
    }
    if (!validAccount(data.account)) {
      return {
        outcome: "dropped" as const,
        reason: "That is not a NEAR account. Nothing was deposited.",
        quotedOut: null,
        quotedUsd: null,
        clasp: current,
      };
    }
    const yocto = parseNearToYocto(data.amount);
    if (yocto === null) {
      return {
        outcome: "dropped" as const,
        reason: "Amount is not a NEAR value. Nothing was deposited.",
        quotedOut: null,
        quotedUsd: null,
        clasp: current,
      };
    }

    let quotedOut: string | null = null;
    let quotedUsd: string | null = null;
    try {
      const quote = await requestQuote(yocto.toString(), data.account, true);
      quotedOut = quote.quote?.amountOutFormatted ?? null;
      quotedUsd = quote.quote?.amountOutUsd ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quote failed.";
      return {
        outcome: "failed" as const,
        message,
        clasp: current,
      };
    }

    if (!fitsAmount(yocto)) {
      return {
        outcome: "dropped" as const,
        reason: "Above 0.02 NEAR. Quote dropped. Nothing was deposited.",
        quotedOut,
        quotedUsd,
        clasp: current,
      };
    }

    return {
      outcome: "fits" as const,
      amountIn: quoteAmountIn(data.amount),
      amountOut: quotedOut ?? "",
      amountOutUsd: quotedUsd ?? "",
      account: data.account,
      yocto: yocto.toString(),
      clasp: current,
    };
  });

function quoteAmountIn(amount: string): string {
  return amount.trim().replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export const openDeposit = createServerFn({ method: "POST" })
  .validator(readInput)
  .handler(async ({ data }) => {
    const current = await sync();
    if (current.phase !== "open") {
      return {
        outcome: "dropped" as const,
        reason:
          current.phase === "settled"
            ? "Already used. The clasp is shut."
            : "A deposit is already open.",
        clasp: current,
      };
    }
    if (!validAccount(data.account)) {
      return {
        outcome: "dropped" as const,
        reason: "That is not a NEAR account. Nothing was deposited.",
        clasp: current,
      };
    }
    const yocto = parseNearToYocto(data.amount);
    if (yocto === null || !fitsAmount(yocto)) {
      return {
        outcome: "dropped" as const,
        reason: "The amount breaks the rule. Nothing was deposited.",
        clasp: current,
      };
    }

    const db = await sql();
    const locked = await db<{ id: number }>`
      update hasp_clasp set phase = 'awaiting', updated_at = now(), notice = null
      where id = 1 and phase = 'open'
      returning id
    `;
    if (locked.length === 0) {
      const clasp = await sync();
      return {
        outcome: "dropped" as const,
        reason: "The clasp was taken. Nothing new was deposited.",
        clasp,
      };
    }

    try {
      const quote = await requestQuote(yocto.toString(), data.account, false);
      const address = quote.quote?.depositAddress;
      const amountIn = quote.quote?.amountInFormatted ?? quoteAmountIn(data.amount);
      const amountOut = quote.quote?.amountOutFormatted ?? "";
      const amountUsd = quote.quote?.amountOutUsd ?? "";
      const deadline = quote.quote?.deadline ?? new Date(Date.now() + 10 * 60 * 1000).toISOString();
      if (!address) {
        await clearToOpen("Deposit failed. No address was issued.");
        const clasp = await load();
        return {
          outcome: "failed" as const,
          message: "Deposit failed. No address was issued. Nothing was deposited.",
          clasp: viewOf(clasp),
        };
      }
      await db`
        update hasp_clasp set
          phase = 'awaiting',
          deposit_address = ${address},
          amount_in = ${amountIn},
          amount_out = ${amountOut},
          amount_out_usd = ${amountUsd},
          account_id = ${data.account},
          deadline = ${deadline},
          notice = 'Nothing is deposited until this NEAR arrives.',
          updated_at = now()
        where id = 1
      `;
      const clasp = await load();
      return { outcome: "opened" as const, clasp: viewOf(clasp, "PENDING_DEPOSIT") };
    } catch (error) {
      await clearToOpen("Deposit failed.");
      const clasp = await load();
      const message = error instanceof Error ? error.message : "Deposit failed.";
      return {
        outcome: "failed" as const,
        message: `Deposit failed. ${message} Nothing was deposited.`,
        clasp: viewOf(clasp),
      };
    }
  });

export const refreshClasp = createServerFn({ method: "POST" }).handler(async () => {
  return sync();
});
