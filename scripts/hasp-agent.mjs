// An AI agent's checkout: it buys through the same NEAR Intents quote a person uses on a Hasp
// button, but only inside its rule (scripts/agent-rule.json): merchants on its list, at most a
// set amount per purchase and per day. The rule is checked before any quote is asked for.
//
//   node scripts/hasp-agent.mjs buy --to sithunyein.near --usd 1 --item "A coffee"          # dry run
//   HASP_AGENT_ACCOUNT=agent.near HASP_AGENT_KEY='ed25519:...' \
//     node scripts/hasp-agent.mjs buy --to sithunyein.near --usd 1 --item "A coffee" --send  # pays
//
// It pays in NEAR from its own account and the merchant receives exact USDC on NEAR. The key is
// read from the environment and never written anywhere. The rule is the agent's own discipline:
// a key that can transfer NEAR could be used without this script, so give the agent an account
// that holds only what it may spend.
//
// Exit codes: 0 done (or dry run), 2 stopped by the rule, 1 failed.

import { readFileSync, writeFileSync } from "node:fs";
import { checkRule, dollars, validAccount } from "./agent-rule.mjs";

const API = "https://1click.chaindefuser.com";
const NEAR = "nep141:wrap.near";
const USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const RPC = process.env.HASP_RPC?.trim() || "https://free.rpc.fastnear.com";
const RULE_FILE = process.env.HASP_AGENT_RULE?.trim() || new URL("./agent-rule.json", import.meta.url);
const LOG_FILE = process.env.HASP_AGENT_LOG?.trim() || new URL("../.hasp-agent-log.json", import.meta.url);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function line(label, text) {
  console.log(`${label.padEnd(8)} ${text}`);
}

function short(amount) {
  return String(amount ?? "").replace(/(\.\d{4})\d+$/, "$1");
}

class Stop extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function main() {
  if (process.argv[2] !== "buy") {
    throw new Stop('Usage: node scripts/hasp-agent.mjs buy --to <merchant.near> --usd <price> [--item "text"] [--send]', 1);
  }
  const to = String(arg("to") ?? "").trim().toLowerCase();
  const usd = String(arg("usd") ?? "").trim();
  const item = String(arg("item") ?? "").trim();
  const send = process.argv.includes("--send");

  const rule = readJson(RULE_FILE, null);
  if (!rule) throw new Stop("The rule file could not be read. Nothing was quoted.", 1);
  const log = readJson(LOG_FILE, []);
  const verdict = checkRule(rule, log, { to, usd });
  if (!verdict.ok) {
    line("rule", `STOPPED: ${verdict.reason}`);
    line("result", "nothing was quoted or sent");
    process.exitCode = 2;
    return;
  }
  line("rule", `${to} is on the list; ${dollars(verdict.cents)} is within ${dollars(verdict.per)} per purchase and ${dollars(verdict.perDay - verdict.spent)} left today`);

  const agent = process.env.HASP_AGENT_ACCOUNT?.trim().toLowerCase() || "";
  if (send && !validAccount(agent)) throw new Stop("Set HASP_AGENT_ACCOUNT to the agent's NEAR account. Nothing was sent.", 1);

  const quote = await requestQuote({ to, cents: verdict.cents, refundTo: agent || to, dry: !send });
  line("quote", `${short(quote.amountInFormatted)} NEAR in, ${quote.amountOutFormatted} USDC out to ${to}${item ? ` for ${item}` : ""}`);
  if (!send) {
    line("dry run", "nothing sent (add --send to pay)");
    return;
  }

  const hash = await payDeposit({ agent, depositAddress: quote.depositAddress, amount: quote.amountIn });
  line("sent", `${short(quote.amountInFormatted)} NEAR to ${quote.depositAddress}: https://nearblocks.io/txns/${hash}`);
  await fetch(`${API}/v0/deposit/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ txHash: hash, depositAddress: quote.depositAddress, nearSenderAccount: agent }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);

  const status = await waitForStatus(quote.depositAddress);
  const out = status?.swapDetails?.amountOutFormatted;
  line("intents", `${status?.status ?? "UNKNOWN"}${out ? `: ${out} USDC reached ${to}` : ""}`);
  line("status", `${API}/v0/status?depositAddress=${quote.depositAddress}`);
  writeFileSync(LOG_FILE, `${JSON.stringify([...log, { at: Date.now(), to, cents: verdict.cents, item, depositAddress: quote.depositAddress, tx: hash, status: status?.status ?? "UNKNOWN" }], null, 2)}\n`);
  if (status?.status !== "SUCCESS") process.exitCode = 1;
}

async function requestQuote({ to, cents, refundTo, dry }) {
  const res = await fetch(`${API}/v0/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      dry,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: 100,
      originAsset: NEAR,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: USDC,
      amount: String(cents * 10_000),
      refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient: to,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      referral: "hasp",
    }),
  }).catch((error) => {
    throw new Stop(`No quote (${error?.name ?? "network error"}). Nothing was sent.`, 1);
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.quote) throw new Stop(`Quote refused: ${body.message ?? res.status}. Nothing was sent.`, 1);
  return body.quote;
}

async function payDeposit({ agent, depositAddress, amount }) {
  const secret = process.env.HASP_AGENT_KEY?.trim();
  if (!secret?.startsWith("ed25519:")) throw new Stop("Set HASP_AGENT_KEY to the agent account's key (ed25519:...). Nothing was sent.", 1);
  if (!/^[0-9a-f]{64}$/.test(depositAddress ?? "")) throw new Stop("NEAR Intents gave an unexpected deposit address. Nothing was sent.", 1);
  const [{ Account }, { JsonRpcProvider }, { KeyPairSigner }, { actionCreators }] = await Promise.all([
    import("@near-js/accounts"),
    import("@near-js/providers"),
    import("@near-js/signers"),
    import("@near-js/transactions"),
  ]);
  const provider = new JsonRpcProvider({ url: RPC });
  const account = new Account(agent, provider, KeyPairSigner.fromSecretKey(secret));
  const outcome = await account.signAndSendTransaction({
    receiverId: depositAddress,
    actions: [actionCreators.transfer(BigInt(amount))],
    throwOnFailure: true,
  });
  return outcome.transaction.hash;
}

async function waitForStatus(depositAddress) {
  let last = null;
  for (let i = 0; i < 36; i += 1) {
    last = await fetch(`${API}/v0/status?depositAddress=${depositAddress}`, { signal: AbortSignal.timeout(15_000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (["SUCCESS", "REFUNDED", "FAILED"].includes(last?.status)) return last;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return last;
}

main().catch((error) => {
  console.log(error instanceof Stop ? error.message : `Failed: ${error?.message ?? error}`);
  process.exitCode = error instanceof Stop ? error.code : 1;
});
