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
};

function emptyRow(account: string): Row {
  return {
    phase: "open",
    deposit_address: null,
    amount_in: null,
    amount_out: null,
    amount_out_usd: null,
    account_id: account,
    deadline: null,
    notice: null,
  };
}

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

async function load(account: string): Promise<Row> {
  const db = await sql();
  const rows = await db<Row>`
    select phase, deposit_address, amount_in, amount_out, amount_out_usd,
           account_id, deadline, notice
    from hasp_agent where account_id = ${account}
  `;
  return rows[0] ?? emptyRow(account);
}

function deadlineDate(value: Row["deadline"]): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function clearToOpen(account: string, notice: string) {
  const db = await sql();
  await db`
    update hasp_agent set
      phase = 'open',
      deposit_address = null,
      amount_in = null,
      amount_out = null,
      amount_out_usd = null,
      deadline = null,
      notice = ${notice},
      updated_at = now()
    where account_id = ${account} and phase = 'awaiting'
  `;
}

async function markSettled(account: string) {
  const db = await sql();
  await db`
    update hasp_agent set
      phase = 'settled',
      notice = 'Settled. This agent’s clasp is shut.',
      updated_at = now()
    where account_id = ${account} and phase = 'awaiting'
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

async function sync(account: string): Promise<ClaspView> {
  const row = await load(account);
  if (row.phase === "awaiting" && !row.deposit_address) {
    await clearToOpen(account, "Deposit failed. Nothing was deposited.");
    return viewOf(await load(account));
  }
  if (row.phase !== "awaiting" || !row.deposit_address) return viewOf(row);

  let chainStatus: string | null = null;
  try {
    chainStatus = await fetchStatus(row.deposit_address);
  } catch {
    return viewOf(row, null);
  }

  if (chainStatus === "SUCCESS") {
    await markSettled(account);
    return viewOf(await load(account), chainStatus);
  }

  if (chainStatus === "FAILED" || chainStatus === "REFUNDED") {
    await clearToOpen(account, "Deposit failed. Nothing was kept.");
    return viewOf(await load(account), chainStatus);
  }

  const deadline = deadlineDate(row.deadline);
  const expired = deadline !== null && deadline.getTime() < Date.now();
  const stillWaiting =
    chainStatus === null ||
    chainStatus === "PENDING_DEPOSIT" ||
    chainStatus === "INCOMPLETE_DEPOSIT";
  if (expired && stillWaiting) {
    await clearToOpen(account, "The deposit window closed. Nothing was deposited.");
    return viewOf(await load(account), chainStatus);
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

function readAccount(input: unknown): { account: string } {
  if (!input || typeof input !== "object") return { account: "" };
  const raw = input as { account?: unknown };
  return {
    account: typeof raw.account === "string" ? raw.account.trim().toLowerCase() : "",
  };
}

export const readClasp = createServerFn({ method: "POST" })
  .validator(readAccount)
  .handler(async ({ data }) => {
    if (!validAccount(data.account)) return viewOf(emptyRow(data.account));
    return sync(data.account);
  });

export const checkRule = createServerFn({ method: "POST" })
  .validator(readInput)
  .handler(async ({ data }) => {
    if (!validAccount(data.account)) {
      const clasp = viewOf(emptyRow(data.account));
      return {
        outcome: "dropped" as const,
        reason: "That is not a NEAR account. Nothing was deposited.",
        quotedOut: null,
        quotedUsd: null,
        clasp,
      };
    }
    const current = await sync(data.account);
    if (current.phase === "settled") {
      return {
        outcome: "dropped" as const,
        reason: "This agent already used its clasp.",
        quotedOut: null,
        quotedUsd: null,
        clasp: current,
      };
    }
    if (current.phase === "awaiting") {
      return {
        outcome: "dropped" as const,
        reason: "This agent already has a deposit open.",
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
      return { outcome: "failed" as const, message, clasp: current };
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
    if (!validAccount(data.account)) {
      return {
        outcome: "dropped" as const,
        reason: "That is not a NEAR account. Nothing was deposited.",
        clasp: viewOf(emptyRow(data.account)),
      };
    }
    const current = await sync(data.account);
    if (current.phase !== "open") {
      return {
        outcome: "dropped" as const,
        reason:
          current.phase === "settled"
            ? "This agent already used its clasp."
            : "This agent already has a deposit open.",
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
    const locked = await db<{ account_id: string }>`
      insert into hasp_agent (account_id, phase)
      values (${data.account}, 'awaiting')
      on conflict (account_id) do update
        set phase = 'awaiting', notice = null, updated_at = now()
        where hasp_agent.phase = 'open'
      returning account_id
    `;
    if (locked.length === 0) {
      const clasp = await sync(data.account);
      return {
        outcome: "dropped" as const,
        reason: "This agent’s clasp was taken. Nothing new was deposited.",
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
        await clearToOpen(data.account, "Deposit failed. No address was issued.");
        return {
          outcome: "failed" as const,
          message: "Deposit failed. No address was issued. Nothing was deposited.",
          clasp: viewOf(await load(data.account)),
        };
      }
      await db`
        update hasp_agent set
          phase = 'awaiting',
          deposit_address = ${address},
          amount_in = ${amountIn},
          amount_out = ${amountOut},
          amount_out_usd = ${amountUsd},
          deadline = ${deadline},
          notice = 'Nothing is deposited until this NEAR arrives.',
          updated_at = now()
        where account_id = ${data.account}
      `;
      return {
        outcome: "opened" as const,
        clasp: viewOf(await load(data.account), "PENDING_DEPOSIT"),
      };
    } catch (error) {
      await clearToOpen(data.account, "Deposit failed.");
      const message = error instanceof Error ? error.message : "Deposit failed.";
      return {
        outcome: "failed" as const,
        message: `Deposit failed. ${message} Nothing was deposited.`,
        clasp: viewOf(await load(data.account)),
      };
    }
  });

export const refreshClasp = createServerFn({ method: "POST" })
  .validator(readAccount)
  .handler(async ({ data }) => {
    if (!validAccount(data.account)) return viewOf(emptyRow(data.account));
    return sync(data.account);
  });
